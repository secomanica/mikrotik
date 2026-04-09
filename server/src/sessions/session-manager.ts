import WebSocket from 'ws';
import type { WsMessage, MouseInput, KeyboardInput, BitmapUpdate } from '@webgate/shared';
import { rdpManager } from '../rdp/connection-manager';
import { logger } from '../utils/logger';
import { config } from '../config';

interface WebSocketSession {
  ws: WebSocket;
  sessionId: string;
  username: string;
  domain: string;
  lastPing: number;
}

/**
 * Manages the bridge between WebSocket clients and RDP sessions.
 * Routes bitmap updates from RDP → WebSocket (client display)
 * and input events from WebSocket → RDP (mouse/keyboard).
 */
export class SessionManager {
  private wsSessions = new Map<string, WebSocketSession>();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Listen for RDP bitmap updates and forward to WebSocket clients
    rdpManager.on('bitmap', (sessionId: string, bitmap: BitmapUpdate) => {
      this.sendToClient(sessionId, { type: 'rdp:bitmap', payload: bitmap, timestamp: Date.now() });
    });

    // Listen for RDP state changes
    rdpManager.on('state', (sessionId: string, state: string) => {
      this.sendToClient(sessionId, {
        type: 'rdp:state',
        payload: { state },
        timestamp: Date.now(),
      });

      // Clean up WebSocket session if RDP disconnected
      if (state === 'disconnected' || state === 'error') {
        const wsSession = this.wsSessions.get(sessionId);
        if (wsSession) {
          wsSession.ws.close(1000, `RDP ${state}`);
          this.wsSessions.delete(sessionId);
        }
      }
    });

    // Start keepalive pings
    this.pingInterval = setInterval(() => this.checkConnections(), 30000);
  }

  /**
   * Register a WebSocket connection for a session.
   */
  registerWebSocket(
    ws: WebSocket,
    sessionId: string,
    username: string,
    domain: string
  ): void {
    // Close existing WebSocket for this session if any
    const existing = this.wsSessions.get(sessionId);
    if (existing) {
      existing.ws.close(1000, 'Replaced by new connection');
    }

    const wsSession: WebSocketSession = {
      ws,
      sessionId,
      username,
      domain,
      lastPing: Date.now(),
    };

    this.wsSessions.set(sessionId, wsSession);

    ws.on('message', (data: WebSocket.Data) => {
      this.handleClientMessage(sessionId, data);
    });

    ws.on('close', () => {
      logger.info(`WebSocket closed for session ${sessionId}`);
      this.wsSessions.delete(sessionId);
    });

    ws.on('pong', () => {
      wsSession.lastPing = Date.now();
    });

    ws.on('error', (error) => {
      logger.error(`WebSocket error for session ${sessionId}: ${error.message}`);
    });

    logger.info(`WebSocket registered for session ${sessionId} (${domain}\\${username})`);
  }

  /**
   * Handle incoming messages from WebSocket client.
   */
  private handleClientMessage(sessionId: string, rawData: WebSocket.Data): void {
    try {
      const message: WsMessage = JSON.parse(rawData.toString());

      switch (message.type) {
        case 'input:mouse': {
          const mouse = message.payload as MouseInput;
          rdpManager.sendMouseInput(
            sessionId,
            mouse.x,
            mouse.y,
            mouse.button,
            mouse.pressed
          );
          break;
        }

        case 'input:keyboard': {
          const key = message.payload as KeyboardInput;
          rdpManager.sendKeyboardInput(
            sessionId,
            key.scanCode,
            key.pressed,
            key.extended
          );
          break;
        }

        case 'input:clipboard': {
          // Forward clipboard data to RDP session
          logger.debug(`Clipboard data received for session ${sessionId}`);
          break;
        }

        default:
          logger.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.error(`Error handling client message for session ${sessionId}: ${error}`);
    }
  }

  /**
   * Send a message to a specific client.
   */
  sendToClient(sessionId: string, message: WsMessage): void {
    const wsSession = this.wsSessions.get(sessionId);
    if (wsSession?.ws.readyState === WebSocket.OPEN) {
      wsSession.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast a message to all connected clients.
   */
  broadcast(message: WsMessage): void {
    for (const [, wsSession] of this.wsSessions) {
      if (wsSession.ws.readyState === WebSocket.OPEN) {
        wsSession.ws.send(JSON.stringify(message));
      }
    }
  }

  /**
   * Check connection health and clean up stale sessions.
   */
  private checkConnections(): void {
    const now = Date.now();
    const timeout = config.sessionTimeout;

    for (const [sessionId, wsSession] of this.wsSessions) {
      if (now - wsSession.lastPing > timeout) {
        logger.info(`Session ${sessionId} timed out`);
        wsSession.ws.close(1000, 'Session timeout');
        this.wsSessions.delete(sessionId);
        rdpManager.disconnect(sessionId);
      } else {
        wsSession.ws.ping();
      }
    }
  }

  /**
   * Get count of active WebSocket connections.
   */
  getActiveCount(): number {
    return this.wsSessions.size;
  }

  /**
   * Shutdown: close all WebSocket connections.
   */
  shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    for (const [, wsSession] of this.wsSessions) {
      wsSession.ws.close(1000, 'Server shutting down');
    }
    this.wsSessions.clear();
  }
}

export const sessionManager = new SessionManager();
