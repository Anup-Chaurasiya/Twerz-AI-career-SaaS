'use client';
import { useState } from 'react';
import client from '@/lib/api/client';

export default function AccountSettingsPage() {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');

  const handleExport = async () => {
    setExporting(true);
    setMessage('');
    try {
      const res = await client.get('/account/export');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ats-beater-export.json';
      a.click();
      URL.revokeObjectURL(url);
      setMessage('Export downloaded.');
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Permanently delete your account and all data? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await client.delete('/account');
      localStorage.removeItem('token');
      window.location.href = '/';
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Delete failed');
      setDeleting(false);
    }
  };

  return (
    <div className="page-scroll">
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Account</h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
        Export or delete your data (GDPR-style trust controls).
      </p>
      <div className="widget-card" style={{ maxWidth: 520 }}>
        <button className="btn-primary" onClick={handleExport} disabled={exporting} style={{ marginBottom: 12 }}>
          {exporting ? 'Exporting…' : 'Download my data'}
        </button>
        <button className="btn-secondary" onClick={handleDelete} disabled={deleting} style={{ display: 'block', color: 'var(--red)' }}>
          {deleting ? 'Deleting…' : 'Delete account'}
        </button>
        {message && <p style={{ marginTop: 12, fontSize: 13 }}>{message}</p>}
      </div>
    </div>
  );
}
