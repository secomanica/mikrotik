import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../services/api';

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
}

interface FileTransferPanelProps {
  onClose: () => void;
}

export function FileTransferPanel({ onClose }: FileTransferPanelProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const loadFiles = useCallback(async (subPath: string = '') => {
    setLoading(true);
    try {
      const result = await api.listFiles(subPath);
      setFiles(result.data?.files || []);
      setCurrentPath(subPath);
    } catch {
      setFiles([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const navigateTo = (entry: FileEntry) => {
    if (entry.isDirectory) {
      loadFiles(entry.path);
    }
  };

  const navigateUp = () => {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    loadFiles(parts.join('/'));
  };

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        await api.uploadFile(file);
      }
      await loadFiles(currentPath);
    } catch (err) {
      console.error('Upload failed:', err);
    }
    setUploading(false);
  };

  const handleDelete = async (entry: FileEntry) => {
    if (!confirm(`Excluir "${entry.name}"?`)) return;
    try {
      await api.deleteFile(entry.path);
      await loadFiles(currentPath);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '-';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  };

  return (
    <div
      style={styles.container}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>Transferência de Arquivos</h3>
        <button onClick={onClose} style={styles.closeBtn}>&times;</button>
      </div>

      {/* Path bar */}
      <div style={styles.pathBar}>
        <button
          className="btn-outline"
          style={styles.smallBtn}
          onClick={navigateUp}
          disabled={!currentPath}
        >
          &uarr; Voltar
        </button>
        <span style={styles.pathText}>/{currentPath || ''}</span>
      </div>

      {/* Upload area */}
      <div style={styles.uploadArea}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleUpload(e.target.files)}
        />
        <button
          className="btn-primary"
          style={styles.uploadBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Enviando...' : 'Enviar Arquivo'}
        </button>
      </div>

      {/* Drag overlay */}
      {dragOver && (
        <div style={styles.dragOverlay}>
          <p>Solte os arquivos aqui</p>
        </div>
      )}

      {/* File list */}
      <div style={styles.fileList}>
        {loading ? (
          <p style={styles.emptyMsg}>Carregando...</p>
        ) : files.length === 0 ? (
          <p style={styles.emptyMsg}>Nenhum arquivo</p>
        ) : (
          files.map((entry) => (
            <div key={entry.path} style={styles.fileRow}>
              <div
                style={styles.fileInfo}
                onClick={() => navigateTo(entry)}
                role={entry.isDirectory ? 'button' : undefined}
              >
                <span style={styles.fileIcon}>
                  {entry.isDirectory ? '\uD83D\uDCC1' : '\uD83D\uDCC4'}
                </span>
                <div style={styles.fileName}>
                  <span>{entry.name}</span>
                  <span style={styles.fileMeta}>
                    {formatSize(entry.size)} &middot; {new Date(entry.modified).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
              <div style={styles.fileActions}>
                {!entry.isDirectory && (
                  <a
                    href={api.getFileDownloadUrl(entry.path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.actionLink}
                    title="Baixar"
                  >
                    &darr;
                  </a>
                )}
                <button
                  style={styles.deleteBtn}
                  onClick={() => handleDelete(entry)}
                  title="Excluir"
                >
                  &times;
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={styles.footer}>
        <p>Arquivos enviados aparecem como unidade mapeada na sessão RDP</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    position: 'relative',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    borderBottom: '1px solid #e2e8f0',
  },
  title: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 600,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    color: '#64748b',
    padding: '0 4px',
    lineHeight: 1,
  },
  pathBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    fontSize: '12px',
  },
  pathText: {
    color: '#64748b',
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  smallBtn: {
    fontSize: '11px',
    padding: '3px 8px',
  },
  uploadArea: {
    padding: '12px 16px',
    borderBottom: '1px solid #e2e8f0',
  },
  uploadBtn: {
    width: '100%',
    fontSize: '13px',
    padding: '8px',
  },
  dragOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(37, 99, 235, 0.1)',
    border: '3px dashed #2563eb',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    fontSize: '16px',
    color: '#2563eb',
    fontWeight: 600,
  },
  fileList: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 0',
  },
  fileRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 16px',
    borderBottom: '1px solid #f1f5f9',
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flex: 1,
    minWidth: 0,
    cursor: 'pointer',
  },
  fileIcon: {
    fontSize: '18px',
    flexShrink: 0,
  },
  fileName: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    fontSize: '13px',
    gap: '1px',
  },
  fileMeta: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  fileActions: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
  },
  actionLink: {
    color: '#2563eb',
    textDecoration: 'none',
    fontSize: '16px',
    padding: '2px',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: '#dc2626',
    fontSize: '16px',
    padding: '2px',
  },
  emptyMsg: {
    textAlign: 'center',
    color: '#94a3b8',
    padding: '32px',
    fontSize: '13px',
  },
  footer: {
    padding: '10px 16px',
    borderTop: '1px solid #e2e8f0',
    fontSize: '11px',
    color: '#94a3b8',
    textAlign: 'center',
  },
};
