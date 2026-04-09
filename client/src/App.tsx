import React, { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useRdp } from './hooks/useRdp';
import { LoginPage } from './components/login/LoginPage';
import { AppPortal } from './components/remoteapp/AppPortal';
import { RdpViewer } from './components/desktop/RdpViewer';
import { AdminPanel } from './components/admin/AdminPanel';

type View = 'portal' | 'rdp' | 'admin';

export function App() {
  const auth = useAuth();
  const rdp = useRdp(auth.token);
  const [view, setView] = useState<View>('portal');

  // Show loading
  if (auth.loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingContent}>
          <h2 style={styles.loadingTitle}>WebGate RDP</h2>
          <p style={styles.loadingText}>Carregando...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!auth.isAuthenticated) {
    return (
      <LoginPage
        onLogin={auth.login}
        loading={auth.loading}
        error={auth.error}
      />
    );
  }

  // Admin panel
  if (view === 'admin') {
    return <AdminPanel onBack={() => setView('portal')} />;
  }

  // RDP viewer
  if (view === 'rdp') {
    return (
      <RdpViewer
        canvasRef={rdp.canvasRef}
        state={rdp.state}
        error={rdp.error}
        onDisconnect={() => {
          rdp.disconnect();
          setView('portal');
        }}
        printJobs={rdp.printJobs}
        onDismissPrintJob={rdp.dismissPrintJob}
      />
    );
  }

  // App portal (default)
  return (
    <div>
      <AppPortal
        onLaunchApp={(appId) => {
          rdp.connect(appId);
          setView('rdp');
        }}
        onLaunchDesktop={() => {
          rdp.connect();
          setView('rdp');
        }}
        onLogout={auth.logout}
        username={auth.user?.username || ''}
        isAdmin={auth.isAdmin}
      />

      {/* Admin access button */}
      {auth.isAdmin && (
        <button
          className="btn-outline"
          style={styles.adminFloatingBtn}
          onClick={() => setView('admin')}
        >
          Painel Admin
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loadingScreen: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
  },
  loadingContent: {
    textAlign: 'center',
    color: 'white',
  },
  loadingTitle: {
    fontSize: '28px',
    fontWeight: 700,
    margin: '0 0 8px 0',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: '14px',
  },
  adminFloatingBtn: {
    position: 'fixed',
    bottom: '24px',
    left: '24px',
    color: '#475569',
    background: 'white',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    borderRadius: '8px',
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: 500,
  },
};
