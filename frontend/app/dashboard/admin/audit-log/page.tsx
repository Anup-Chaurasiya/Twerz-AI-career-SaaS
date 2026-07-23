'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api/endpoints';
import { AdminAuditLogEntry } from '@/types';
import { formatDate } from '@/lib/utils';

export default function AdminAuditLogPage() {
  const [items, setItems] = useState<AdminAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');

  useEffect(() => {
    setLoading(true);
    adminApi.listAuditLog(1, 100, action ? { action } : undefined).then(res => {
      setItems(res.data.items);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [action]);

  return (
    <div className="fade-slide-in">
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Admin Audit Log</h2>
      <input type="text" className="input-field" placeholder="Filter by action..." value={action} onChange={e => setAction(e.target.value)} style={{ width: 280, marginBottom: 16 }} />
      {loading ? <div className="spinner" /> : (
        <div className="widget-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table admin-table">
            <thead><tr><th>Time</th><th>Admin</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
            <tbody>
              {items.map(log => (
                <tr key={log.id}>
                  <td>{formatDate(log.created_at)}</td>
                  <td>{log.admin_email || log.admin_user_id || '—'}</td>
                  <td><span className="badge badge-processing">{log.action}</span></td>
                  <td>{log.target_type}{log.target_id ? ` #${log.target_id}` : ''}</td>
                  <td style={{ fontSize: 11, color: 'var(--text-dim)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {log.after ? JSON.stringify(log.after).slice(0, 80) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
