import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

interface PublishedApp {
  id: string;
  name: string;
  displayName: string;
  executablePath: string;
  commandLineArgs?: string;
  description?: string;
  allowedUsers: string[];
  allowedGroups: string[];
  enabled: boolean;
}

interface AdminPanelProps {
  onBack: () => void;
}

export function AdminPanel({ onBack }: AdminPanelProps) {
  const [apps, setApps] = useState<PublishedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingApp, setEditingApp] = useState<PublishedApp | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [executablePath, setExecutablePath] = useState('');
  const [commandLineArgs, setCommandLineArgs] = useState('');
  const [description, setDescription] = useState('');
  const [allowedUsers, setAllowedUsers] = useState('');
  const [allowedGroups, setAllowedGroups] = useState('');

  const loadApps = async () => {
    setLoading(true);
    try {
      const result = await api.listApps();
      setApps(result.data || []);
    } catch {
      setApps([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadApps();
  }, []);

  const resetForm = () => {
    setName('');
    setDisplayName('');
    setExecutablePath('');
    setCommandLineArgs('');
    setDescription('');
    setAllowedUsers('');
    setAllowedGroups('');
    setEditingApp(null);
    setFormError(null);
  };

  const openAddForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (app: PublishedApp) => {
    setName(app.name);
    setDisplayName(app.displayName);
    setExecutablePath(app.executablePath);
    setCommandLineArgs(app.commandLineArgs || '');
    setDescription(app.description || '');
    setAllowedUsers(app.allowedUsers.join(', '));
    setAllowedGroups(app.allowedGroups.join(', '));
    setEditingApp(app);
    setShowForm(true);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const payload = {
      name,
      displayName,
      executablePath,
      commandLineArgs,
      description,
      allowedUsers: allowedUsers.split(',').map((s) => s.trim()).filter(Boolean),
      allowedGroups: allowedGroups.split(',').map((s) => s.trim()).filter(Boolean),
    };

    try {
      if (editingApp) {
        await api.updateApp(editingApp.id, payload);
      } else {
        await api.createApp(payload);
      }
      setShowForm(false);
      resetForm();
      await loadApps();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao salvar');
    }
  };

  const handleDelete = async (app: PublishedApp) => {
    if (!confirm(`Excluir o aplicativo "${app.displayName}"?`)) return;
    try {
      await api.deleteApp(app.id);
      await loadApps();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleToggle = async (app: PublishedApp) => {
    try {
      await api.toggleApp(app.id, !app.enabled);
      await loadApps();
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button className="btn-outline" onClick={onBack} style={styles.backBtn}>
            &larr; Voltar
          </button>
          <h1 style={styles.title}>Administração - Aplicativos Publicados</h1>
        </div>
        <button className="btn-primary" onClick={openAddForm}>
          + Publicar Aplicativo
        </button>
      </header>

      {/* Form modal */}
      {showForm && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>
              {editingApp ? 'Editar Aplicativo' : 'Publicar Novo Aplicativo'}
            </h2>
            <form onSubmit={handleSubmit} style={styles.form}>
              {formError && <div style={styles.formError}>{formError}</div>}

              <div style={styles.formRow}>
                <div style={styles.field}>
                  <label style={styles.label}>Identificador</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="excel" required />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Nome de Exibição</label>
                  <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Microsoft Excel" required />
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Caminho do Executável</label>
                <input
                  value={executablePath}
                  onChange={(e) => setExecutablePath(e.target.value)}
                  placeholder='C:\Program Files\Microsoft Office\root\Office16\EXCEL.EXE'
                  required
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Argumentos (opcional)</label>
                <input
                  value={commandLineArgs}
                  onChange={(e) => setCommandLineArgs(e.target.value)}
                  placeholder="/r"
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Descrição (opcional)</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Planilhas e análise de dados"
                />
              </div>

              <div style={styles.formRow}>
                <div style={styles.field}>
                  <label style={styles.label}>Usuários Permitidos (separados por vírgula)</label>
                  <input
                    value={allowedUsers}
                    onChange={(e) => setAllowedUsers(e.target.value)}
                    placeholder="joao, maria (vazio = todos)"
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Grupos Permitidos (separados por vírgula)</label>
                  <input
                    value={allowedGroups}
                    onChange={(e) => setAllowedGroups(e.target.value)}
                    placeholder="Financeiro, RH (vazio = todos)"
                  />
                </div>
              </div>

              <div style={styles.formActions}>
                <button type="button" className="btn-outline" onClick={() => { setShowForm(false); resetForm(); }}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingApp ? 'Salvar Alterações' : 'Publicar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Apps table */}
      <main style={styles.main}>
        {loading ? (
          <p style={styles.emptyMsg}>Carregando...</p>
        ) : apps.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyMsg}>Nenhum aplicativo publicado</p>
            <p style={styles.emptyHint}>
              Clique em "Publicar Aplicativo" para disponibilizar aplicativos para os usuários.
            </p>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Aplicativo</th>
                <th style={styles.th}>Executável</th>
                <th style={styles.th}>Acesso</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.id} style={styles.tr}>
                  <td style={styles.td}>
                    <strong>{app.displayName}</strong>
                    <br />
                    <span style={styles.subText}>{app.description || app.name}</span>
                  </td>
                  <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: '12px' }}>
                    {app.executablePath}
                  </td>
                  <td style={styles.td}>
                    {app.allowedUsers.length === 0 && app.allowedGroups.length === 0 ? (
                      <span className="badge badge-success">Todos</span>
                    ) : (
                      <span style={styles.subText}>
                        {[...app.allowedUsers, ...app.allowedGroups.map((g) => `[${g}]`)].join(', ')}
                      </span>
                    )}
                  </td>
                  <td style={styles.td}>
                    <span className={`badge ${app.enabled ? 'badge-success' : 'badge-warning'}`}>
                      {app.enabled ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actionBtns}>
                      <button className="btn-outline" style={styles.actionBtn} onClick={() => openEditForm(app)}>
                        Editar
                      </button>
                      <button className="btn-outline" style={styles.actionBtn} onClick={() => handleToggle(app)}>
                        {app.enabled ? 'Desativar' : 'Ativar'}
                      </button>
                      <button className="btn-danger" style={styles.actionBtn} onClick={() => handleDelete(app)}>
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    background: 'white',
    borderBottom: '1px solid #e2e8f0',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  backBtn: {
    fontSize: '13px',
    padding: '6px 12px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    margin: 0,
  },
  main: {
    flex: 1,
    padding: '24px 32px',
    overflowY: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: 'white',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    fontSize: '12px',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '12px 16px',
    fontSize: '13px',
    verticalAlign: 'middle',
  },
  subText: {
    color: '#94a3b8',
    fontSize: '12px',
  },
  actionBtns: {
    display: 'flex',
    gap: '6px',
  },
  actionBtn: {
    fontSize: '11px',
    padding: '4px 10px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px',
  },
  emptyMsg: {
    color: '#64748b',
    fontSize: '15px',
  },
  emptyHint: {
    color: '#94a3b8',
    fontSize: '13px',
    marginTop: '8px',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  modal: {
    background: 'white',
    borderRadius: '12px',
    padding: '32px',
    width: '100%',
    maxWidth: '640px',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '24px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 500,
    color: '#475569',
  },
  formError: {
    background: '#fee2e2',
    color: '#991b1b',
    padding: '10px',
    borderRadius: '6px',
    fontSize: '13px',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '8px',
  },
};
