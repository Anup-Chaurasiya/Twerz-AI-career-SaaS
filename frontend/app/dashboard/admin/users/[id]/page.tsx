'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api/endpoints';
import { AdminUserDetail } from '@/types';
import { formatDate } from '@/lib/utils';

export default function AdminUserDetailPage() {
  const params = useParams();
  const userId = params.id as string;
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getUserDetail(userId).then(res => {
      setDetail(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="spinner" />;
  if (!detail) return <div className="card-warning">User not found.</div>;

  const { account, jobs, roasts, referrals, credits, financials, failures } = detail;

  return (
    <div className="fade-slide-in">
      <Link href="/dashboard/admin/users" style={{ fontSize: 13, color: 'var(--teal)', textDecoration: 'none' }}>← Back to Users</Link>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: '16px 0 8px' }}>{account.name}</h2>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 24 }}>{account.email} · Joined {formatDate(account.created_at)}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div className="widget-card"><div className="section-label">Balance</div><div style={{ fontSize: 24, fontWeight: 700, color: 'var(--teal)' }}>{credits.balance}</div></div>
        <div className="widget-card"><div className="section-label">LLM Cost</div><div style={{ fontSize: 24, fontWeight: 700 }}>${financials.total_llm_cost_usd.toFixed(4)}</div></div>
        <div className="widget-card"><div className="section-label">Revenue</div><div style={{ fontSize: 24, fontWeight: 700 }}>₹{(financials.total_revenue_paise / 100).toFixed(0)}</div></div>
        <div className="widget-card"><div className="section-label">Jobs</div><div style={{ fontSize: 24, fontWeight: 700 }}>{jobs.length}</div></div>
        {financials.cost_negative && <div className="widget-card" style={{ borderColor: 'var(--red)' }}><div className="section-label">Alert</div><div style={{ color: 'var(--red)', fontSize: 13 }}>Cost-negative user</div></div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <div className="widget-card">
          <div className="section-label">Referrals</div>
          <div style={{ fontSize: 13, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>Code: <strong>{referrals.referral_code || '—'}</strong></div>
            <div>Referred: {referrals.referred_count} users</div>
            <div>Bonus granted: {referrals.bonus_granted ? 'Yes' : 'No'}</div>
            <div>Bonus status: <strong>{referrals.bonus_status || 'none'}</strong></div>
            {referrals.referred_by && <div>Referred by: {referrals.referred_by.email}</div>}
          </div>
        </div>
        <div className="widget-card">
          <div className="section-label">Credits</div>
          <div style={{ fontSize: 13, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>Daily free remaining: {credits.daily_free_remaining}</div>
            {credits.active_time_pass && <div>Time pass: {credits.active_time_pass.tier_name} (expires {formatDate(credits.active_time_pass.expires_at)})</div>}
          </div>
        </div>
      </div>

      {failures.failed_jobs.length > 0 && (
        <div className="widget-card" style={{ marginBottom: 24, borderColor: 'rgba(239,68,68,0.3)' }}>
          <div className="section-label">Recent Failures</div>
          {failures.failed_jobs.slice(0, 5).map(j => (
            <div key={j.id} style={{ fontSize: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              Job #{j.id} — {j.status} {j.pdf_error_log && <span style={{ color: 'var(--red)' }}>(PDF error)</span>}
            </div>
          ))}
        </div>
      )}

      <div className="widget-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="section-label" style={{ padding: '16px 16px 0' }}>Jobs Funnel</div>
        <table className="data-table admin-table">
          <thead><tr><th>ID</th><th>Status</th><th>Fit</th><th>ATS</th><th>Application</th><th>Created</th></tr></thead>
          <tbody>
            {jobs.map(j => (
              <tr key={j.id}>
                <td>{j.id}</td>
                <td><span className={`badge badge-${j.status === 'READY' ? 'ready' : j.status === 'FAILED' ? 'failed' : 'processing'}`}>{j.status}</span></td>
                <td>{j.fit_score ?? '—'} {j.fit_label && <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>({j.fit_label})</span>}</td>
                <td>{j.ats_score_before ?? '—'} → {j.ats_score_after ?? '—'}</td>
                <td>{j.application_status ?? '—'}</td>
                <td>{formatDate(j.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {roasts.length > 0 && (
        <div className="widget-card" style={{ marginTop: 24 }}>
          <div className="section-label">Roasts ({roasts.length})</div>
          {roasts.map(r => <div key={r.id} style={{ fontSize: 12, padding: '4px 0' }}>#{r.id} — {r.status}</div>)}
        </div>
      )}
    </div>
  );
}
