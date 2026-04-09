import React from 'react';
import { api } from '../../services/api';

interface PrintJob {
  jobId: string;
  documentName: string;
  downloadUrl?: string;
}

interface PrintNotificationsProps {
  jobs: PrintJob[];
  onDismiss: (jobId: string) => void;
}

export function PrintNotifications({ jobs, onDismiss }: PrintNotificationsProps) {
  if (jobs.length === 0) return null;

  const handleDownload = (job: PrintJob) => {
    const url = api.getPrintDownloadUrl(job.jobId);
    window.open(url, '_blank');
    onDismiss(job.jobId);
  };

  return (
    <div style={styles.container}>
      {jobs.map((job) => (
        <div key={job.jobId} style={styles.notification}>
          <div style={styles.icon}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M5 6V2h10v4M5 14h10v4H5zM2 6h16v8H2z"
                stroke="#2563eb"
                strokeWidth="1.5"
                fill="none"
              />
            </svg>
          </div>
          <div style={styles.content}>
            <strong style={styles.docName}>{job.documentName}</strong>
            <span style={styles.readyText}>Documento pronto para download</span>
          </div>
          <div style={styles.actions}>
            <button
              className="btn-primary"
              style={styles.downloadBtn}
              onClick={() => handleDownload(job)}
            >
              Baixar PDF
            </button>
            <button
              className="btn-outline"
              style={styles.dismissBtn}
              onClick={() => onDismiss(job.jobId)}
            >
              &times;
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    zIndex: 100,
    maxWidth: '400px',
  },
  notification: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'white',
    padding: '14px 16px',
    borderRadius: '10px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
    border: '1px solid #e2e8f0',
    animation: 'slideIn 0.3s ease',
  },
  icon: {
    flexShrink: 0,
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  docName: {
    fontSize: '13px',
    color: '#1e293b',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  readyText: {
    fontSize: '11px',
    color: '#64748b',
  },
  actions: {
    display: 'flex',
    gap: '6px',
    flexShrink: 0,
  },
  downloadBtn: {
    fontSize: '12px',
    padding: '4px 10px',
  },
  dismissBtn: {
    fontSize: '16px',
    padding: '2px 6px',
    lineHeight: 1,
    border: 'none',
    background: 'none',
    color: '#94a3b8',
  },
};
