'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api/endpoints';
import { formatDate } from '@/lib/utils';

export default function AdminCompliancePage() {
  const [dataRequests, setDataRequests] = useState<Array<Record<string, unknown>>>([]);
  const [flagged, setFlagged] = useState<{ ip_collisions?: Array<Record<string, unknown>>; refund_clustering?: Array<Record<string, unknown>> }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminApi.listDataRequests(), adminApi.getFlaggedAccounts()]).then(([reqRes, flagRes]) => {
      setDataRequests(reqRes.data.items as Array<Record<string, unknown>>);
      setFlagged(flagRes.data as typeof flagged);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;

  return (
    <div className="fade-slide-in">
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Compliance & Abuse</h2>

      <div className="widget-card" style={{ marginBottom: 24 }}>
        <div className="section-label">Data Request Log (DPDP/GDPR)</div>
        {dataRequests.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 12 }}>No export/delete requests yet.</p> : (
          <table className="data-table admin-table" style={{ marginTop: 12 }}>
            <thead><tr><th>Time</th><th>User</th><th>Action</th><th>IP</th></tr></thead>
            <tbody>
              {dataRequests.map(r => (
                <tr key={String(r.id)}>
                  <td>{formatDate(String(r.created_at))}</td>
                  <td>{String(r.user_email || r.user_id)}</td>
                  <td><span className="badge badge-processing">{String(r.action)}</span></td>
                  <td>{String(r.ip || '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="widget-card">
          <div className="section-label">IP Collisions (24h)</div>
          {(flagged.ip_collisions || []).length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 12 }}>None detected.</p> : (
            (flagged.ip_collisions || []).map((c, i) => (
              <div key={i} style={{ fontSize: 13, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {String(c.signup_ip)} — {String(c.count)} signups
              </div>
            ))
          )}
        </div>
        <div className="widget-card">
          <div className="section-label">Refund Clustering (7d)</div>
          {(flagged.refund_clustering || []).length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 12 }}>None detected.</p> : (
            (flagged.refund_clustering || []).map((c, i) => (
              <div key={i} style={{ fontSize: 13, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {String(c.email)} — {String(c.refund_count_7d)} refunds
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
