import React, { useState } from 'react';

interface LoginPageProps {
  onLogin: (username: string, password: string, domain?: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

export function LoginPage({ onLogin, loading, error }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [domain, setDomain] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    await onLogin(username, password, domain || undefined);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logo}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill="#2563eb" />
              <path d="M12 16h24v16H12z" fill="white" opacity="0.9" />
              <path d="M14 18h20v12H14z" fill="#2563eb" />
              <rect x="20" y="32" width="8" height="2" fill="white" opacity="0.9" />
              <rect x="16" y="35" width="16" height="1" rx="0.5" fill="white" opacity="0.6" />
            </svg>
          </div>
          <h1 style={styles.title}>WebGate RDP</h1>
          <p style={styles.subtitle}>Acesso remoto via navegador</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.field}>
            <label style={styles.label}>Domínio (opcional)</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="DOMÍNIO ou deixe vazio para local"
              autoComplete="domain"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Usuário</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="seu.usuario"
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={styles.button}
            disabled={loading || !username || !password}
          >
            {loading ? 'Conectando...' : 'Entrar'}
          </button>
        </form>

        <div style={styles.footer}>
          <p>Suas credenciais Windows serão usadas para acessar a área de trabalho remota.</p>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
  },
  card: {
    background: 'white',
    borderRadius: '16px',
    padding: '40px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  logo: {
    marginBottom: '16px',
    display: 'flex',
    justifyContent: 'center',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#1e293b',
    margin: '0 0 4px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: '#64748b',
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#475569',
  },
  button: {
    width: '100%',
    padding: '12px',
    fontSize: '15px',
    fontWeight: 600,
    marginTop: '8px',
    borderRadius: '8px',
  },
  error: {
    background: '#fee2e2',
    color: '#991b1b',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
  },
  footer: {
    marginTop: '24px',
    textAlign: 'center',
    fontSize: '12px',
    color: '#94a3b8',
  },
};
