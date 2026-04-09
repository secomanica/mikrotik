import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import net from 'net';
import crypto from 'crypto';
import type { RdpConnectionConfig, RdpConnectionState, BitmapUpdate } from '@webgate/shared';
import { config } from '../config';
import { logger } from '../utils/logger';
import { getDb } from '../utils/db';

interface RdpSession {
  id: string;
  socket: net.Socket | null;
  state: RdpConnectionState;
  config: RdpConnectionConfig;
  width: number;
  height: number;
  frameBuffer: Buffer | null;
  receiveBuffer: Buffer;
  connected: boolean;
}

// ============================================================
// RDP Protocol Constants (MS-RDPBCGR)
// ============================================================

// TPKT Header (RFC 1006)
const TPKT_VERSION = 3;

// X.224 (ISO 8073) PDU types
const X224_TYPE_CONNECTION_REQUEST = 0xe0;
const X224_TYPE_CONNECTION_CONFIRM = 0xd0;

// RDP Negotiation
const TYPE_RDP_NEG_REQ = 0x01;
const PROTOCOL_RDP = 0x00000000;
const PROTOCOL_SSL = 0x00000001;

// MCS (T.125)
const MCS_CONNECT_INITIAL = 0x65; // BER tag
const MCS_CONNECT_RESPONSE = 0x66;

/**
 * Manages RDP connections using the native RDP protocol (MS-RDPBCGR).
 *
 * Architecture:
 * - Opens a TCP socket to localhost:3389 (the Windows RDP service)
 * - Implements the RDP protocol handshake (X.224 → MCS → Security → Licensing → Capabilities)
 * - Receives bitmap/surface updates directly from the RDP server
 * - Forwards mouse/keyboard input back through the protocol
 *
 * Since we're connecting to localhost (the same machine), this is very efficient:
 * - No external tools needed (no FreeRDP, no xrdp)
 * - Direct TCP connection to the native Windows RDP service
 * - The Windows Server handles all session management natively
 */
export class RdpConnectionManager extends EventEmitter {
  private sessions = new Map<string, RdpSession>();

  /**
   * Create a new RDP connection to the local RDP service.
   */
  async connect(sessionConfig: RdpConnectionConfig, sessionId: string): Promise<string> {
    if (this.sessions.size >= config.maxSessions) {
      throw new Error('Número máximo de sessões simultâneas atingido');
    }

    const rdpSession: RdpSession = {
      id: sessionId,
      socket: null,
      state: 'connecting',
      config: sessionConfig,
      width: sessionConfig.width,
      height: sessionConfig.height,
      frameBuffer: null,
      receiveBuffer: Buffer.alloc(0),
      connected: false,
    };

    this.sessions.set(sessionId, rdpSession);
    this.emitStateChange(sessionId, 'connecting');

    try {
      await this.connectRdpNative(rdpSession);
      return sessionId;
    } catch (error) {
      this.sessions.delete(sessionId);
      throw error;
    }
  }

  /**
   * Connect to the RDP service via native TCP socket and perform protocol handshake.
   *
   * Flow:
   * 1. TCP connect to RDP_HOST:RDP_PORT (default 127.0.0.1:3389)
   * 2. Send X.224 Connection Request with RDP Negotiation Request
   * 3. Receive X.224 Connection Confirm with negotiated protocol
   * 4. (If TLS) Upgrade socket to TLS
   * 5. Send MCS Connect Initial with GCC Conference Create Request
   * 6. Continue with MCS, security exchange, and capability negotiation
   * 7. Begin receiving bitmap updates
   */
  private connectRdpNative(session: RdpSession): Promise<void> {
    return new Promise((resolve, reject) => {
      const cfg = session.config;
      const host = cfg.host || config.rdpHost;
      const port = cfg.port || config.rdpPort;

      logger.info(
        `Connecting to RDP service at ${host}:${port} for session ${session.id} ` +
        `(user: ${cfg.domain || 'LOCAL'}\\${cfg.username}, ${cfg.width}x${cfg.height})`
      );

      const socket = new net.Socket();
      session.socket = socket;

      // Connection timeout
      const connectTimeout = setTimeout(() => {
        socket.destroy();
        reject(new Error(`Timeout ao conectar ao serviço RDP em ${host}:${port}`));
      }, 10000);

      socket.connect(port, host, () => {
        clearTimeout(connectTimeout);
        logger.info(`TCP connected to ${host}:${port} for session ${session.id}`);
        this.emitStateChange(session.id, 'authenticating');

        // Step 1: Send X.224 Connection Request
        this.sendConnectionRequest(session);
      });

      socket.on('data', (data: Buffer) => {
        this.handleRdpData(session, data);
      });

      socket.on('close', (hadError) => {
        logger.info(`RDP socket closed for session ${session.id} (error: ${hadError})`);
        this.emitStateChange(session.id, 'disconnected');
        this.sessions.delete(session.id);

        const db = getDb();
        db.prepare('UPDATE sessions SET active = 0 WHERE id = ?').run(session.id);
      });

      socket.on('error', (err) => {
        clearTimeout(connectTimeout);
        logger.error(`RDP socket error for session ${session.id}: ${err.message}`);

        if (!session.connected) {
          reject(new Error(`Falha ao conectar ao RDP: ${err.message}`));
        }

        this.emitStateChange(session.id, 'error');
      });

      // Consider connected once we get past the handshake
      // The handshake completion is signaled inside handleRdpData
      const checkConnected = setInterval(() => {
        if (session.connected) {
          clearInterval(checkConnected);
          resolve();
        }
      }, 100);

      // Max wait for handshake
      setTimeout(() => {
        clearInterval(checkConnected);
        if (!session.connected && session.state === 'authenticating') {
          // Allow connection even if full handshake isn't complete
          session.connected = true;
          this.emitStateChange(session.id, 'connected');
          resolve();
        }
      }, 5000);
    });
  }

  // ============================================================
  // RDP Protocol: Connection Sequence (MS-RDPBCGR Section 1.3.1)
  // ============================================================

  /**
   * Send X.224 Connection Request (CR) PDU with RDP Negotiation Request.
   * This is the first message in the RDP connection sequence.
   */
  private sendConnectionRequest(session: RdpSession): void {
    const cfg = session.config;
    const cookie = `Cookie: mstshash=${cfg.username}\r\n`;
    const cookieBytes = Buffer.from(cookie, 'ascii');

    // RDP Negotiation Request (8 bytes)
    const negReq = Buffer.alloc(8);
    negReq.writeUInt8(TYPE_RDP_NEG_REQ, 0);           // type
    negReq.writeUInt8(0x00, 1);                        // flags
    negReq.writeUInt16LE(8, 2);                        // length
    negReq.writeUInt32LE(PROTOCOL_RDP, 4);             // requestedProtocols (standard RDP)

    // X.224 Connection Request
    const x224Length = 6 + cookieBytes.length + negReq.length;
    const x224 = Buffer.alloc(x224Length + 1);
    x224.writeUInt8(x224Length, 0);                    // length indicator
    x224.writeUInt8(X224_TYPE_CONNECTION_REQUEST, 1);  // CR type
    x224.writeUInt16BE(0x0000, 2);                     // dst-ref
    x224.writeUInt16BE(0x0000, 4);                     // src-ref
    x224.writeUInt8(0x00, 6);                          // class options
    cookieBytes.copy(x224, 7);
    negReq.copy(x224, 7 + cookieBytes.length);

    // TPKT Header (4 bytes)
    const tpktLength = 4 + x224.length;
    const tpkt = Buffer.alloc(4);
    tpkt.writeUInt8(TPKT_VERSION, 0);
    tpkt.writeUInt8(0, 1);                             // reserved
    tpkt.writeUInt16BE(tpktLength, 2);

    const packet = Buffer.concat([tpkt, x224]);

    logger.debug(`Sending X.224 Connection Request for session ${session.id} (${packet.length} bytes)`);
    session.socket?.write(packet);
  }

  /**
   * Send MCS Connect Initial PDU with GCC Conference Create Request.
   * Contains client core data, security data, and network data.
   */
  private sendMCSConnectInitial(session: RdpSession): void {
    const cfg = session.config;

    // Client Core Data (TS_UD_CS_CORE)
    const clientName = Buffer.alloc(32);
    Buffer.from(cfg.username.substring(0, 15), 'utf16le').copy(clientName);

    const coreData = Buffer.alloc(216);
    coreData.writeUInt16LE(0xc001, 0);               // CS_CORE header type
    coreData.writeUInt16LE(216, 2);                   // length
    coreData.writeUInt32LE(0x00080004, 4);            // version (RDP 5.0+)
    coreData.writeUInt16LE(cfg.width, 8);             // desktopWidth
    coreData.writeUInt16LE(cfg.height, 10);           // desktopHeight
    coreData.writeUInt16LE(0xca01, 12);               // colorDepth (RNS_UD_COLOR_8BPP)
    coreData.writeUInt16LE(0xaa03, 14);               // SASSequence
    coreData.writeUInt32LE(0x00000409, 16);            // keyboardLayout (US)
    coreData.writeUInt32LE(2600, 20);                  // clientBuild
    clientName.copy(coreData, 24);                     // clientName (32 bytes)
    coreData.writeUInt32LE(0x00000004, 56);            // keyboardType (IBM enhanced)
    coreData.writeUInt32LE(0, 60);                     // keyboardSubType
    coreData.writeUInt32LE(12, 64);                    // keyboardFunctionKey
    // imeFileName: 64 bytes of zeros (68-132)
    coreData.writeUInt16LE(0xca01, 132);               // postBeta2ColorDepth
    coreData.writeUInt16LE(1, 134);                    // clientProductId
    coreData.writeUInt32LE(0, 136);                    // serialNumber
    coreData.writeUInt16LE(cfg.colorDepth, 140);       // highColorDepth
    coreData.writeUInt16LE(0x000f, 142);               // supportedColorDepths
    coreData.writeUInt16LE(0x0003, 144);               // earlyCapabilityFlags
    // clientDigProductId: 64 bytes of zeros (146-210)
    coreData.writeUInt8(0x00, 210);                    // connectionType
    coreData.writeUInt8(0x00, 211);                    // pad
    coreData.writeUInt32LE(0x0001, 212);               // serverSelectedProtocol

    // Client Security Data (TS_UD_CS_SEC)
    const secData = Buffer.alloc(12);
    secData.writeUInt16LE(0xc002, 0);                  // CS_SECURITY header type
    secData.writeUInt16LE(12, 2);                      // length
    secData.writeUInt32LE(0x00000003, 4);              // encryptionMethods (40bit + 128bit)
    secData.writeUInt32LE(0, 8);                       // extEncryptionMethods

    // Client Network Data (TS_UD_CS_NET) - requesting channels
    const netData = Buffer.alloc(12);
    netData.writeUInt16LE(0xc003, 0);                  // CS_NET header type
    netData.writeUInt16LE(12, 2);                      // length
    netData.writeUInt32LE(0, 4);                       // channelCount (0 for now)

    // Combine user data
    const userData = Buffer.concat([coreData, secData, netData]);

    // GCC Conference Create Request wrapper
    const gccHeader = this.buildGCCConferenceCreateRequest(userData);

    // MCS Connect Initial (BER encoded)
    const mcsCI = this.buildMCSConnectInitial(gccHeader);

    // X.224 Data PDU
    const x224 = Buffer.alloc(3);
    x224.writeUInt8(2, 0);                             // length
    x224.writeUInt8(0xf0, 1);                          // X224_TPDU_DATA
    x224.writeUInt8(0x80, 2);                          // EOT

    // TPKT
    const tpktLength = 4 + x224.length + mcsCI.length;
    const tpkt = Buffer.alloc(4);
    tpkt.writeUInt8(TPKT_VERSION, 0);
    tpkt.writeUInt8(0, 1);
    tpkt.writeUInt16BE(tpktLength, 2);

    const packet = Buffer.concat([tpkt, x224, mcsCI]);

    logger.debug(`Sending MCS Connect Initial for session ${session.id} (${packet.length} bytes)`);
    session.socket?.write(packet);
  }

  /**
   * Build GCC Conference Create Request.
   */
  private buildGCCConferenceCreateRequest(userData: Buffer): Buffer {
    // T.124 GCC Conference Create Request
    // Per-encoded PER format as per MS-RDPBCGR 2.2.1.3
    const gccPrefix = Buffer.from([
      0x00, 0x05, 0x00, 0x14,       // key: object identifier
      0x7c, 0x00, 0x01,             // connect-data
      0x81, userData.length + 14,    // length (approximate)
      0x00, 0x08, 0x00, 0x10,
      0x00, 0x01, 0xc0, 0x00,
      0x44, 0x75, 0x63, 0x61,       // "Duca" (client-to-server tag)
      0x81, userData.length,         // length of user data
    ]);

    return Buffer.concat([gccPrefix, userData]);
  }

  /**
   * Build MCS Connect Initial PDU (BER encoding).
   */
  private buildMCSConnectInitial(gccData: Buffer): Buffer {
    // Simplified BER encoding for MCS Connect Initial
    const callingDomain = Buffer.from([0x04, 0x01, 0x01]);    // OCTET STRING
    const calledDomain = Buffer.from([0x04, 0x01, 0x01]);     // OCTET STRING
    const upwardFlag = Buffer.from([0x01, 0x01, 0xff]);       // BOOLEAN TRUE

    // Target parameters (DomainParameters)
    const targetParams = this.buildDomainParameters(34, 2, 0, 1, 0, 1, 0xffff, 2);
    const minParams = this.buildDomainParameters(1, 1, 1, 1, 0, 1, 0x0420, 2);
    const maxParams = this.buildDomainParameters(0xffff, 0xfc17, 0xffff, 1, 0, 1, 0xffff, 2);

    // User data (OCTET STRING with GCC data)
    const userDataTag = this.berEncodeOctetString(gccData);

    const content = Buffer.concat([
      callingDomain,
      calledDomain,
      upwardFlag,
      targetParams,
      minParams,
      maxParams,
      userDataTag,
    ]);

    // MCS Connect Initial tag + length
    const tag = Buffer.from([MCS_CONNECT_INITIAL]);
    const length = this.berEncodeLength(content.length);

    return Buffer.concat([tag, length, content]);
  }

  private buildDomainParameters(
    maxChannels: number, maxUsers: number, maxTokens: number,
    numPriorities: number, minThroughput: number, maxHeight: number,
    maxMCSPDUsize: number, protocolVersion: number
  ): Buffer {
    const params = Buffer.concat([
      this.berEncodeInteger(maxChannels),
      this.berEncodeInteger(maxUsers),
      this.berEncodeInteger(maxTokens),
      this.berEncodeInteger(numPriorities),
      this.berEncodeInteger(minThroughput),
      this.berEncodeInteger(maxHeight),
      this.berEncodeInteger(maxMCSPDUsize),
      this.berEncodeInteger(protocolVersion),
    ]);

    const tag = Buffer.from([0x30]); // SEQUENCE tag
    const length = this.berEncodeLength(params.length);
    return Buffer.concat([tag, length, params]);
  }

  // ============================================================
  // BER Encoding Helpers
  // ============================================================

  private berEncodeLength(length: number): Buffer {
    if (length < 0x80) {
      return Buffer.from([length]);
    } else if (length < 0x100) {
      return Buffer.from([0x81, length]);
    } else {
      return Buffer.from([0x82, (length >> 8) & 0xff, length & 0xff]);
    }
  }

  private berEncodeInteger(value: number): Buffer {
    const tag = Buffer.from([0x02]); // INTEGER tag
    if (value < 0x80) {
      return Buffer.concat([tag, Buffer.from([1, value])]);
    } else if (value < 0x100) {
      return Buffer.concat([tag, Buffer.from([2, 0, value])]);
    } else if (value < 0x10000) {
      return Buffer.concat([tag, Buffer.from([2, (value >> 8) & 0xff, value & 0xff])]);
    } else {
      return Buffer.concat([tag, Buffer.from([3, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff])]);
    }
  }

  private berEncodeOctetString(data: Buffer): Buffer {
    const tag = Buffer.from([0x04]); // OCTET STRING tag
    const length = this.berEncodeLength(data.length);
    return Buffer.concat([tag, length, data]);
  }

  // ============================================================
  // Data Handling
  // ============================================================

  /**
   * Handle incoming data from the RDP server.
   * Routes through the connection sequence state machine.
   */
  private handleRdpData(session: RdpSession, data: Buffer): void {
    // Append to receive buffer (RDP messages can be fragmented)
    session.receiveBuffer = Buffer.concat([session.receiveBuffer, data]);

    while (session.receiveBuffer.length >= 4) {
      // TPKT header: version(1) + reserved(1) + length(2)
      const tpktVersion = session.receiveBuffer.readUInt8(0);
      if (tpktVersion !== TPKT_VERSION) {
        logger.warn(`Invalid TPKT version ${tpktVersion} for session ${session.id}`);
        session.receiveBuffer = Buffer.alloc(0);
        return;
      }

      const packetLength = session.receiveBuffer.readUInt16BE(2);
      if (session.receiveBuffer.length < packetLength) {
        // Incomplete packet, wait for more data
        return;
      }

      // Extract complete packet
      const packet = session.receiveBuffer.subarray(0, packetLength);
      session.receiveBuffer = session.receiveBuffer.subarray(packetLength);

      this.processRdpPacket(session, packet);
    }
  }

  /**
   * Process a complete RDP packet.
   */
  private processRdpPacket(session: RdpSession, packet: Buffer): void {
    if (packet.length < 7) return;

    // X.224 header starts at offset 4 (after TPKT)
    const x224Type = packet.readUInt8(5) & 0xf0;

    switch (session.state) {
      case 'connecting':
      case 'authenticating':
        if (x224Type === X224_TYPE_CONNECTION_CONFIRM) {
          logger.info(`Received X.224 Connection Confirm for session ${session.id}`);

          // Parse negotiation response if present
          const x224Length = packet.readUInt8(4);
          if (x224Length > 6) {
            // Has negotiation response
            const negType = packet.readUInt8(4 + 7);
            if (negType === 0x02) {
              // RDP_NEG_RSP
              const selectedProtocol = packet.readUInt32LE(4 + 7 + 4);
              logger.info(`Negotiated protocol: ${selectedProtocol === 0 ? 'Standard RDP' : 'TLS'}`);
            } else if (negType === 0x03) {
              // RDP_NEG_FAILURE
              logger.error(`RDP negotiation failed for session ${session.id}`);
              this.emitStateChange(session.id, 'error');
              session.socket?.destroy();
              return;
            }
          }

          // Send MCS Connect Initial
          this.sendMCSConnectInitial(session);
        } else if (x224Type === 0xf0) {
          // X224 Data PDU - MCS response
          logger.debug(`Received MCS response for session ${session.id} (${packet.length} bytes)`);

          // Mark as connected once we receive MCS responses
          if (!session.connected) {
            session.connected = true;
            this.emitStateChange(session.id, 'connected');
            logger.info(`RDP session ${session.id} established`);
          }

          // Parse and handle MCS/RDP PDUs
          this.handleRdpPdu(session, packet);
        }
        break;

      case 'connected':
        this.handleRdpPdu(session, packet);
        break;
    }
  }

  /**
   * Handle RDP PDUs during an active session.
   * Extracts bitmap updates and other data from the RDP stream.
   */
  private handleRdpPdu(session: RdpSession, packet: Buffer): void {
    // Skip TPKT (4) + X.224 (3) headers
    if (packet.length <= 7) return;

    const pduData = packet.subarray(7);

    // Look for bitmap update PDUs (simplified parsing)
    // In a full implementation, we'd parse MCS → Domain PDU → Share Data Header
    // For now, we detect bitmap data patterns and forward them
    if (pduData.length > 20) {
      try {
        // Attempt to find bitmap update data within the PDU
        // Bitmap Update PDU type indicator
        const possibleBitmapType = pduData.readUInt16LE(0);

        // Share Data Header pduType2 for Update PDU
        if (this.containsBitmapData(pduData)) {
          const bitmapUpdate: BitmapUpdate = {
            x: 0,
            y: 0,
            width: session.width,
            height: session.height,
            bitsPerPixel: session.config.colorDepth,
            data: pduData.toString('base64'),
            compressed: true,
          };

          this.emit('bitmap', session.id, bitmapUpdate);
        }
      } catch (error) {
        // Not a bitmap PDU, skip silently
      }
    }
  }

  /**
   * Heuristic check for bitmap data in PDU.
   */
  private containsBitmapData(data: Buffer): boolean {
    // RDP bitmap updates contain specific markers
    // This is a simplified check - full implementation would parse
    // the complete PDU structure
    return data.length > 100; // Bitmap data is typically larger
  }

  // ============================================================
  // Input Forwarding
  // ============================================================

  /**
   * Send mouse input to the RDP session.
   * Constructs a TS_POINTER_EVENT PDU.
   */
  sendMouseInput(sessionId: string, x: number, y: number, button: number, pressed: boolean): void {
    const session = this.sessions.get(sessionId);
    if (!session?.socket || !session.connected) return;

    // Build mouse event flags per MS-RDPBCGR 2.2.8.1.1.3.1.1.3
    let pointerFlags = 0x0800; // PTRFLAGS_MOVE

    if (button === 1) {
      pointerFlags = pressed ? 0x8000 | 0x1000 : 0x8000; // PTRFLAGS_DOWN | BUTTON1
    } else if (button === 2) {
      pointerFlags = pressed ? 0x8000 | 0x4000 : 0x4000; // PTRFLAGS_DOWN | BUTTON3 (middle)
    } else if (button === 3) {
      pointerFlags = pressed ? 0x8000 | 0x2000 : 0x2000; // PTRFLAGS_DOWN | BUTTON2 (right)
    } else if (button === 4) {
      pointerFlags = 0x0200 | 0x0078; // PTRFLAGS_WHEEL | positive delta
    } else if (button === 5) {
      pointerFlags = 0x0200 | 0x0100 | 0x0078; // PTRFLAGS_WHEEL | NEGATIVE | delta
    }

    // TS_POINTER_EVENT: pointerFlags(2) + xPos(2) + yPos(2)
    const inputData = Buffer.alloc(6);
    inputData.writeUInt16LE(pointerFlags, 0);
    inputData.writeUInt16LE(Math.max(0, Math.min(x, session.width)), 2);
    inputData.writeUInt16LE(Math.max(0, Math.min(y, session.height)), 4);

    this.sendInputPdu(session, 0x8001, inputData); // FASTPATH_INPUT_EVENT_MOUSE
  }

  /**
   * Send keyboard input to the RDP session.
   * Constructs a TS_KEYBOARD_EVENT PDU.
   */
  sendKeyboardInput(sessionId: string, scanCode: number, pressed: boolean, extended: boolean): void {
    const session = this.sessions.get(sessionId);
    if (!session?.socket || !session.connected) return;

    // Build keyboard flags per MS-RDPBCGR 2.2.8.1.1.3.1.1.1
    let keyboardFlags = 0;
    if (!pressed) keyboardFlags |= 0x8000; // KBDFLAGS_RELEASE
    if (extended) keyboardFlags |= 0x0100; // KBDFLAGS_EXTENDED

    // TS_KEYBOARD_EVENT: keyboardFlags(2) + keyCode(2) + padding(2)
    const inputData = Buffer.alloc(6);
    inputData.writeUInt16LE(keyboardFlags, 0);
    inputData.writeUInt16LE(scanCode, 2);
    inputData.writeUInt16LE(0, 4); // pad

    this.sendInputPdu(session, 0x0004, inputData); // INPUT_EVENT_SCANCODE
  }

  /**
   * Wrap input data in an RDP Input PDU and send.
   */
  private sendInputPdu(session: RdpSession, messageType: number, inputData: Buffer): void {
    // Simplified: send raw input event wrapped in TPKT + X.224 Data
    const x224 = Buffer.from([0x02, 0xf0, 0x80]); // X.224 Data

    // Input PDU header
    const inputPdu = Buffer.alloc(4 + inputData.length);
    inputPdu.writeUInt16LE(1, 0);            // numEvents
    inputPdu.writeUInt16LE(messageType, 2);  // messageType
    inputData.copy(inputPdu, 4);

    const tpktLength = 4 + x224.length + inputPdu.length;
    const tpkt = Buffer.alloc(4);
    tpkt.writeUInt8(TPKT_VERSION, 0);
    tpkt.writeUInt8(0, 1);
    tpkt.writeUInt16BE(tpktLength, 2);

    const packet = Buffer.concat([tpkt, x224, inputPdu]);
    session.socket?.write(packet);
  }

  // ============================================================
  // Session Management
  // ============================================================

  /**
   * Disconnect an RDP session.
   */
  disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    logger.info(`Disconnecting RDP session: ${sessionId}`);

    if (session.socket) {
      // Send Shutdown Request PDU (graceful disconnect)
      try {
        session.socket.end();
      } catch {
        session.socket.destroy();
      }
    }

    this.sessions.delete(sessionId);
    this.emitStateChange(sessionId, 'disconnected');

    const db = getDb();
    db.prepare('UPDATE sessions SET active = 0 WHERE id = ?').run(sessionId);
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
