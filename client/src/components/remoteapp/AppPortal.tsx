import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

interface PublishedApp {
  id: string;
  displayName: string;
  description?: string;
  iconBase64?: string;
  executablePath: string;
  enabled: boolean;
}

interface AppPortalProps {
  onLaunchApp: (appId: string) => void;
  onLaunchDesktop: () => void;
  onLogout: () => void;
  username: string;
  isAdmin: boolean;
}

export function AppPortal({ onLaunchApp, onLaunchDesktop, onLogout, username, isAdmin }: AppPortalProps) {
  const [apps, setApps] = useState<PublishedApp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listApps()
      .then((res) => setApps(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.logo}>WebGate RDP</h1>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.username}>{username}</span>
          {isAdmin && <span className="badge badge-success">Admin</span>}
          <button className="btn-outline" onClick={onLogout} style={styles.logoutBtn}>
            Sair
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <h2 style={styles.sectionTitle}>Aplicativos Disponíveis</h2>

        {loading ? (
          <p style={styles.loading}>Carregando aplicativos...</p>
        ) : (
          <div style={styles.grid}>
            {/* Full Desktop option */}
            <button style={styles.appCard} onClick={onLaunchDesktop}>
              <div style={styles.appIcon}>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <rect x="4" y="8" width="40" height="28" rx="3" stroke="#2563eb" strokeWidth="2" fill="none" />
                  <rect x="6" y="10" width="36" height="24" fill="#dbeafe" />
                  <rect x="18" y="36" width="12" height="2" fill="#2563eb" />
                  <rect x="14" y="40" width="20" height="1" fill="#93c5fd" />
                </svg>
              </div>
              <span style={styles.appName}>Área de Trabalho</span>
              <span style={styles.appDesc}>Acesso completo ao desktop</span>
            </button>

            {/* Published apps */}
            {apps.map((app) => (
              <button
                key={app.id}
                style={styles.appCard}
                onClick={() => onLaunchApp(app.id)}
                disabled={!app.enabled}
              >
                <div style={styles.appIcon}>
                  {app.iconBase64 ? (
                    <img
                      src={`data:image/png;base64,${app.iconBase64}`}
                      alt={app.displayName}
                      width={48}
                      height={48}
                    />
                  ) : (
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="8" y="4" width="32" height="40" rx="2" stroke="#64748b" strokeWidth="2" fill="none" />
                      <rect x="12" y="10" width="24" height="2" fill="#94a3b8" />
                      <rect x="12" y="16" width="18" height="2" fill="#94a3b8" />
                      <rect x="12" y="22" width="20" height="2" fill="#94a3b8" />
                    </svg>
                  )}
                </div>
                <span style={styles.appName}>{app.displayName}</span>
                <span style={styles.appDesc}>{app.description || app.executablePath}</span>
              </button>
            ))}
          </div>
        )}

        {apps.length === 0 && !loading && (
          <p style={styles.noApps}>
            Nenhum aplicativo publicado ainda.
            {isAdmin && ' Vá para o painel de administração para publicar aplicativos.'}
          </p>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#f1f5f9',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 32px',
    background: '#1e293b',
    color: 'white',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logo: {
    fontSize: '20px',
    fontWeight: 700,
    margin: 0,
  },
  username: {
    fontSize: '14px',
    color: '#94a3b8',
  },
  logoutBtn: {
    color: 'white',
    borderColor: '#475569',
    fontSize: '13px',
    padding: '6px 14px',
  },
  main: {
    flex: 1,
    padding: '40px',
    overflowY: 'auto',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
  },
  sectionTitle: {
    fontSize: '22px',
    fontWeight: 600,
    color: '#1e293b',
    marginBottom: '24px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '20px',
  },
  appCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '28px 16px',
    background: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    textAlign: 'center',
  },
  appIcon: {
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1e293b',
  },
  appDesc: {
    fontSize: '11px',
    color: '#94a3b8',
    maxWidth: '150px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  loading: {
    textAlign: 'center',
    color: '#64748b',
    padding: '40px',
  },
  noApps: {
    textAlign: 'center',
    color: '#64748b',
    padding: '40px',
    fontSize: '15px',
  },
};
