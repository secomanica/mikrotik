import type { WsMessage, WsMessageType } from '@webgate/shared';

type MessageHandler = (message: WsMessage) => void;

/**
 * WebSocket client for RDP streaming and event communication.
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<WsMessageType, Set<MessageHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private url: string = '';

  connect(token: string, sessionId: string): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = `${protocol}//${window.location.host}/rdp?token=${token}&session=${sessionId}`;

    this.doConnect();
  }

  private doConnect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.ws = new WebSocket(this.url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      console.log('[WS] Connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const message: WsMessage = JSON.parse(
          typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data)
        );
        this.dispatch(message);
      } catch (error) {
        console.error('[WS] Failed to parse message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log(`[WS] Disconnected: ${event.code} ${event.reason}`);
      if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WS] Error:', error);
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'User disconnect');
      this.ws = null;
    }
    this.reconnectAttempts = 0;
  }

  send(type: WsMessageType, payload: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('[WS] Not connected, cannot send');
      return;
    }

    const message: WsMessage = { type, payload, timestamp: Date.now() };
    this.ws.send(JSON.stringify(message));
  }

  sendMouse(x: number, y: number, button: number, pressed: boolean): void {
    this.send('input:mouse', { x, y, button, pressed, flags: 0 });
  }

  sendKeyboard(scanCode: number, pressed: boolean, extended: boolean = false): void {
    this.send('input:keyboard', { scanCode, keyCode: 0, pressed, extended });
  }

  sendClipboard(text: string): void {
    this.send('input:clipboard', { text });
  }

  on(type: WsMessageType, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  private dispatch(message: WsMessage): void {
    const handlers = this.handlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => handler(message));
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.reconnectAttempts++;
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.doConnect();
    }, delay);
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsClient = new WebSocketClient();
