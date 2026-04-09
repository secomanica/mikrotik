import React, { useEffect, useCallback, useRef } from 'react';
import { wsClient } from '../../services/websocket';
import { PrintNotifications } from '../print/PrintNotification';
import { FileTransferPanel } from '../filetransfer/FileTransferPanel';

interface RdpViewerProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  state: string;
  error: string | null;
  onDisconnect: () => void;
  printJobs: Array<{ jobId: string; documentName: string; downloadUrl?: string }>;
  onDismissPrintJob: (jobId: string) => void;
}

export function RdpViewer({
  canvasRef,
  state,
  error,
  onDisconnect,
  printJobs,
  onDismissPrintJob,
}: RdpViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showFiles, setShowFiles] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  // Handle mouse events on canvas
  const handleMouseEvent = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>, pressed?: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = Math.round((e.clientX - rect.left) * scaleX);
      const y = Math.round((e.clientY - rect.top) * scaleY);

      let button = 0;
      if (e.buttons & 1) button = 1; // Left
      if (e.buttons & 2) button = 3; // Right
      if (e.buttons & 4) button = 2; // Middle

      wsClient.sendMouse(x, y, button, pressed ?? (e.type === 'mousedown'));
    },
    [canvasRef]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = Math.round((e.clientX - rect.left) * scaleX);
      const y = Math.round((e.clientY - rect.top) * scaleY);

      // Scroll delta → button 3 for scroll
      wsClient.sendMouse(x, y, e.deltaY > 0 ? 4 : 5, true);
    },
    [canvasRef]
  );

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (state !== 'connected') return;
      e.preventDefault();
      wsClient.sendKeyboard(e.keyCode, true, e.location === 3);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (state !== 'connected') return;
      e.preventDefault();
      wsClient.sendKeyboard(e.keyCode, false, e.location === 3);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [state]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    } else {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    }
  }, []);

  // Disable context menu on canvas
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div ref={containerRef} style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <span style={styles.toolbarTitle}>WebGate RDP</span>
          <span
            className={`badge ${state === 'connected' ? 'badge-success' : 'badge-warning'}`}
          >
            {state === 'connected' ? 'Conectado' : state === 'connecting' ? 'Conectando...' : state}
          </span>
        </div>
        <div style={styles.toolbarRight}>
          <button
            className="btn-outline"
            style={styles.toolbarBtn}
            onClick={() => setShowFiles(!showFiles)}
            title="Transferência de Arquivos"
          >
            Arquivos
          </button>
          <button
            className="btn-outline"
            style={styles.toolbarBtn}
            onClick={toggleFullscreen}
            title="Tela Cheia"
          >
            {isFullscreen ? 'Sair Tela Cheia' : 'Tela Cheia'}
          </button>
          <button
            className="btn-danger"
            style={styles.toolbarBtn}
            onClick={onDisconnect}
          >
            Desconectar
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={styles.errorBanner}>
          {error}
        </div>
      )}

      {/* Canvas area */}
      <div style={styles.canvasWrapper}>
        {state === 'connecting' && (
          <div style={styles.overlay}>
            <div style={styles.spinner} />
            <p>Estabelecendo conexão RDP...</p>
          </div>
        )}

        <canvas
          ref={canvasRef}
          width={1920}
          height={1080}
          style={styles.canvas}
          onMouseDown={(e) => handleMouseEvent(e, true)}
          onMouseUp={(e) => handleMouseEvent(e, false)}
          onMouseMove={(e) => handleMouseEvent(e)}
          onWheel={handleWheel}
          onContextMenu={handleContextMenu}
          tabIndex={0}
        />
      </div>

      {/* Side panels */}
      {showFiles && (
        <div style={styles.sidePanel}>
          <FileTransferPanel onClose={() => setShowFiles(false)} />
        </div>
      )}

      {/* Print notifications */}
      <PrintNotifications jobs={printJobs} onDismiss={onDismissPrintJob} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#0f172a',
    position: 'relative',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 16px',
    background: '#1e293b',
    borderBottom: '1px solid #334155',
    zIndex: 10,
  },
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  toolbarTitle: {
    color: 'white',
    fontSize: '15px',
    fontWeight: 600,
  },
  toolbarBtn: {
    fontSize: '12px',
    padding: '5px 12px',
    color: '#e2e8f0',
    borderColor: '#475569',
  },
  errorBanner: {
    background: '#dc2626',
    color: 'white',
    padding: '8px 16px',
    fontSize: '13px',
    textAlign: 'center',
  },
  canvasWrapper: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  canvas: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    cursor: 'default',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(15, 23, 42, 0.9)',
    color: 'white',
    gap: '16px',
    zIndex: 5,
    fontSize: '15px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #334155',
    borderTopColor: '#2563eb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  sidePanel: {
    position: 'absolute',
    top: '49px', // Below toolbar
    right: 0,
    bottom: 0,
    width: '360px',
    background: 'white',
    boxShadow: '-4px 0 12px rgba(0,0,0,0.2)',
    zIndex: 20,
    overflow: 'hidden',
  },
};
