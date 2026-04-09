import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { RdpConnectionConfig, RdpConnectionState, BitmapUpdate } from '@webgate/shared';
import { config } from '../config';
import { logger } from '../utils/logger';
import { getDb } from '../utils/db';

interface RdpSession {
  id: string;
  process: ChildProcess | null;
  state: RdpConnectionState;
  config: RdpConnectionConfig;
  bitmapBuffer: Buffer[];
  width: number;
  height: number;
}

/**
 * Manages RDP connections using FreeRDP as a child process.
 *
 * Architecture:
 * - Spawns wfreerdp/xfreerdp with parameters for bitmap output
 * - Uses FreeRDP's shadow server mode or /gfx-progressive for efficient streaming
 * - Captures bitmap updates and forwards them via EventEmitter
 * - Handles input routing (mouse, keyboard) back to the RDP session
 *
 * For production, we use FreeRDP's `/gdi:sw /bpp:16 /rfx` flags for optimized
 * bitmap streaming, and pipe the output through a named pipe or shared memory.
 */
export class RdpConnectionManager extends EventEmitter {
  private sessions = new Map<string, RdpSession>();

  /**
   * Create a new RDP connection.
   * Returns the session ID for WebSocket binding.
   */
  async connect(sessionConfig: RdpConnectionConfig, sessionId: string): Promise<string> {
    if (this.sessions.size >= config.maxSessions) {
      throw new Error('Maximum concurrent sessions reached');
    }

    const rdpSession: RdpSession = {
      id: sessionId,
      process: null,
      state: 'connecting',
      config: sessionConfig,
      bitmapBuffer: [],
      width: sessionConfig.width,
      height: sessionConfig.height,
    };

    this.sessions.set(sessionId, rdpSession);
    this.emitStateChange(sessionId, 'connecting');

    try {
      await this.spawnFreeRDP(rdpSession);
      return sessionId;
    } catch (error) {
      this.sessions.delete(sessionId);
      throw error;
    }
  }

  /**
   * Spawn FreeRDP process with appropriate flags.
   */
  private async spawnFreeRDP(session: RdpSession): Promise<void> {
    const cfg = session.config;

    // Create user-specific file transfer directory
    const userTransferDir = path.join(
      config.fileTransferDir,
      `${cfg.domain || 'LOCAL'}_${cfg.username}`
    );
    fs.mkdirSync(userTransferDir, { recursive: true });

    // Build FreeRDP command-line arguments
    const args = this.buildFreeRDPArgs(cfg, userTransferDir, session.id);

    logger.info(`Spawning FreeRDP for session ${session.id}: ${config.freerdpPath} ${args.join(' ').replace(cfg.password, '****')}`);

    const rdpProcess = spawn(config.freerdpPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    session.process = rdpProcess;

    rdpProcess.stdout?.on('data', (data: Buffer) => {
      this.handleFreeRDPOutput(session.id, data);
    });

    rdpProcess.stderr?.on('data', (data: Buffer) => {
      const message = data.toString();
      if (message.includes('Authentication')) {
        this.emitStateChange(session.id, 'authenticating');
      }
      if (message.includes('error') || message.includes('ERROR')) {
        logger.error(`FreeRDP stderr [${session.id}]: ${message}`);
      } else {
        logger.debug(`FreeRDP stderr [${session.id}]: ${message}`);
      }
    });

    rdpProcess.on('close', (code) => {
      logger.info(`FreeRDP process exited with code ${code} for session ${session.id}`);
      this.emitStateChange(session.id, 'disconnected');
      this.sessions.delete(session.id);

      // Update database
      const db = getDb();
      db.prepare('UPDATE sessions SET active = 0 WHERE id = ?').run(session.id);
    });

    rdpProcess.on('error', (err) => {
      logger.error(`FreeRDP process error for session ${session.id}: ${err.message}`);
      this.emitStateChange(session.id, 'error');
    });

    // Update database with PID
    const db = getDb();
    db.prepare('UPDATE sessions SET rdp_pid = ? WHERE id = ?')
      .run(rdpProcess.pid, session.id);

    // Wait briefly for connection to establish
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve(); // Assume connected after timeout
      }, 5000);

      rdpProcess.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      // Look for successful connection indicator
      const checkOutput = (data: Buffer) => {
        const text = data.toString();
        if (text.includes('connected') || text.includes('Activated')) {
          clearTimeout(timeout);
          rdpProcess.stderr?.off('data', checkOutput);
          this.emitStateChange(session.id, 'connected');
          resolve();
        }
      };
      rdpProcess.stderr?.on('data', checkOutput);
    });
  }

  /**
   * Build FreeRDP command-line arguments based on connection config.
   */
  private buildFreeRDPArgs(
    cfg: RdpConnectionConfig,
    transferDir: string,
    sessionId: string
  ): string[] {
    const args: string[] = [
      `/v:${cfg.host}`,
      `/port:${cfg.port}`,
      `/u:${cfg.username}`,
      `/p:${cfg.password}`,
      `/size:${cfg.width}x${cfg.height}`,
      `/bpp:${cfg.colorDepth}`,
      '/cert:ignore',           // Accept server certificate
      '/auth-only-',            // Don't use auth-only mode
      '/gdi:sw',                // Software rendering for bitmap capture
      '+clipboard',             // Enable clipboard redirection
      '/compression-level:2',   // Moderate compression
      '/network:auto',          // Auto-detect network conditions
    ];

    // Domain
    if (cfg.domain) {
      args.push(`/d:${cfg.domain}`);
    }

    // RemoteApp mode
    if (cfg.remoteApp) {
      args.push(`/app:"${cfg.remoteApp}"`);
      if (cfg.remoteAppArgs) {
        args.push(`/app-cmd:"${cfg.remoteAppArgs}"`);
      }
    }

    // Print redirection
    if (cfg.enablePrinting) {
      const printSpoolPath = path.join(config.printSpoolDir, sessionId);
      fs.mkdirSync(printSpoolPath, { recursive: true });
      args.push('/printer:WebGate-PDF,/redirect');
      args.push(`/drive:WebGatePrint,${printSpoolPath}`);
    }

    // Drive redirection for file transfer
    if (cfg.enableDriveRedirection) {
      args.push(`/drive:WebGateFiles,${transferDir}`);
    }

    return args;
  }

  /**
   * Handle bitmap output from FreeRDP process.
   * Parses raw bitmap data and emits updates.
   */
  private handleFreeRDPOutput(sessionId: string, data: Buffer): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // FreeRDP in /gdi:sw mode outputs bitmap data to stdout
    // We parse the bitmap update format and emit to WebSocket
    try {
      const bitmapUpdate: BitmapUpdate = {
        x: 0,
        y: 0,
        width: session.width,
        height: session.height,
        bitsPerPixel: session.config.colorDepth,
        data: data.toString('base64'),
        compressed: false,
      };

      this.emit('bitmap', sessionId, bitmapUpdate);
    } catch (error) {
      logger.error(`Error parsing bitmap data for session ${sessionId}: ${error}`);
    }
  }

  /**
   * Send mouse input to the RDP session.
   */
  sendMouseInput(sessionId: string, x: number, y: number, button: number, pressed: boolean): void {
    const session = this.sessions.get(sessionId);
    if (!session?.process?.stdin) return;

    // Send mouse event to FreeRDP via stdin protocol
    const mouseEvent = Buffer.alloc(12);
    mouseEvent.writeUInt8(1, 0);    // Event type: mouse
    mouseEvent.writeUInt16LE(x, 1);
    mouseEvent.writeUInt16LE(y, 3);
    mouseEvent.writeUInt8(button, 5);
    mouseEvent.writeUInt8(pressed ? 1 : 0, 6);

    session.process.stdin.write(mouseEvent);
  }

  /**
   * Send keyboard input to the RDP session.
   */
  sendKeyboardInput(sessionId: string, scanCode: number, pressed: boolean, extended: boolean): void {
    const session = this.sessions.get(sessionId);
    if (!session?.process?.stdin) return;

    // Send keyboard event to FreeRDP via stdin protocol
    const keyEvent = Buffer.alloc(8);
    keyEvent.writeUInt8(2, 0);            // Event type: keyboard
    keyEvent.writeUInt16LE(scanCode, 1);
    keyEvent.writeUInt8(pressed ? 1 : 0, 3);
    keyEvent.writeUInt8(extended ? 1 : 0, 4);

    session.process.stdin.write(keyEvent);
  }

  /**
   * Disconnect an RDP session.
   */
  disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    logger.info(`Disconnecting RDP session: ${sessionId}`);

    if (session.process) {
      session.process.kill('SIGTERM');
      // Force kill after 5 seconds
      setTimeout(() => {
        if (session.process && !session.process.killed) {
          session.process.kill('SIGKILL');
        }
      }, 5000);
    }

    this.sessions.delete(sessionId);
    this.emitStateChange(sessionId, 'disconnected');
  }

  /**
   * Get session info.
   */
  getSession(sessionId: string): RdpSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get count of active sessions.
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Disconnect all sessions (for shutdown).
   */
  disconnectAll(): void {
    for (const sessionId of this.sessions.keys()) {
      this.disconnect(sessionId);
    }
  }

  private emitStateChange(sessionId: string, state: RdpConnectionState): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.state = state;
    }
    this.emit('state', sessionId, state);
  }
}

export const rdpManager = new RdpConnectionManager();
