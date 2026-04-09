import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { wsClient } from '../services/websocket';
import type { BitmapUpdate, WsMessage, PrintNotification } from '@webgate/shared';

type RdpState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface PrintJob {
  jobId: string;
  documentName: string;
  downloadUrl?: string;
}

export function useRdp(token: string | null) {
  const [state, setState] = useState<RdpState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Handle bitmap updates
  useEffect(() => {
    const unsubBitmap = wsClient.on('rdp:bitmap', (msg: WsMessage) => {
      const bitmap = msg.payload as BitmapUpdate;
      renderBitmap(bitmap);
    });

    const unsubState = wsClient.on('rdp:state', (msg: WsMessage) => {
      const { state: rdpState } = msg.payload as { state: RdpState };
      setState(rdpState);
    });

    const unsubPrint = wsClient.on('print:ready', (msg: WsMessage) => {
      const notification = msg.payload as PrintNotification;
      setPrintJobs((prev) => [
        {
          jobId: notification.jobId,
          documentName: notification.documentName,
          downloadUrl: notification.downloadUrl,
        },
        ...prev,
      ]);
    });

    return () => {
      unsubBitmap();
      unsubState();
      unsubPrint();
    };
  }, []);

  const renderBitmap = useCallback((bitmap: BitmapUpdate) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Decode base64 bitmap data and draw to canvas
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, bitmap.x, bitmap.y, bitmap.width, bitmap.height);
    };
    img.src = `data:image/png;base64,${bitmap.data}`;
  }, []);

  const connect = useCallback(
    async (appId?: string) => {
      if (!token) return;

      setState('connecting');
      setError(null);

      try {
        const password = sessionStorage.getItem('webgate_rdp_pass') || '';
        const canvas = canvasRef.current;
        const width = canvas?.clientWidth || 1920;
        const height = canvas?.clientHeight || 1080;

        const result = await api.connectRdp({ width, height, password, appId });

        if (result.success) {
          // Connect WebSocket for bitmap streaming
          wsClient.connect(token, result.data.sessionId);
          setState('connected');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Falha na conexão RDP';
        setError(message);
        setState('error');
      }
    },
    [token]
  );

  const disconnect = useCallback(async () => {
    wsClient.disconnect();
    try {
      await api.disconnectRdp();
    } catch {
      // Ignore
    }
    setState('disconnected');
  }, []);

  const dismissPrintJob = useCallback((jobId: string) => {
    setPrintJobs((prev) => prev.filter((j) => j.jobId !== jobId));
  }, []);

  return {
    state,
    error,
    canvasRef,
    printJobs,
    connect,
    disconnect,
    dismissPrintJob,
  };
}
