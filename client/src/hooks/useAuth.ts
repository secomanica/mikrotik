import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

interface User {
  username: string;
  domain: string;
  displayName: string;
  groups: string[];
  isAdmin: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('webgate_token'),
    loading: true,
    error: null,
  });

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem('webgate_token');
    if (token) {
      api.setToken(token);
      api.getSession()
        .then((res) => {
          setState({
            user: res.data,
            token,
            loading: false,
            error: null,
          });
        })
        .catch(() => {
          localStorage.removeItem('webgate_token');
          api.setToken(null);
          setState({ user: null, token: null, loading: false, error: null });
        });
    } else {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  // Listen for auth expiration
  useEffect(() => {
    const handler = () => {
      localStorage.removeItem('webgate_token');
      setState({ user: null, token: null, loading: false, error: 'Sessão expirada' });
    };
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, []);

  const login = useCallback(async (username: string, password: string, domain?: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const result = await api.login(username, password, domain);
      if (result.success && result.token && result.user) {
        api.setToken(result.token);
        localStorage.setItem('webgate_token', result.token);
        // Store password temporarily in sessionStorage for RDP connection
        sessionStorage.setItem('webgate_rdp_pass', password);
        setState({
          user: result.user,
          token: result.token,
          loading: false,
          error: null,
        });
        return true;
      } else {
        setState((s) => ({
          ...s,
          loading: false,
          error: result.error || 'Falha na autenticação',
        }));
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro de conexão';
      setState((s) => ({ ...s, loading: false, error: message }));
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Ignore logout errors
    }
    api.setToken(null);
    localStorage.removeItem('webgate_token');
    sessionStorage.removeItem('webgate_rdp_pass');
    setState({ user: null, token: null, loading: false, error: null });
  }, []);

  return {
    user: state.user,
    token: state.token,
    loading: state.loading,
    error: state.error,
    isAuthenticated: !!state.user,
    isAdmin: state.user?.isAdmin ?? false,
    login,
    logout,
  };
}
