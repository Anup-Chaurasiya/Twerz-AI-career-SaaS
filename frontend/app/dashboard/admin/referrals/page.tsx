'use client';
import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/api/endpoints';
import { formatDate } from '@/lib/utils';

type ReferralReview = {
  id: number;
  referrer_email?: string;
  referred_email?: string;
  signals: string[];
  bonus_amount: number;
  status: string;
  referrer_signup_ip?: string;
  referred_signup_ip?: string;
  created_at: string;
};

export default function AdminReferralsPage() {
  const [items, setItems] = useState<ReferralReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.listFlaggedReferrals(1, 50, 'pending').then(res => {
      setItems(res.data.items as ReferralReview[]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: number) => {
    setActing(id);
    try {
      await adminApi.approveReferral(id);
      load();
    } catch {
      alert('Failed to approve referral payout.');
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (id: number) => {
    if (!confirm('Reject this referral payout? Credits will not be granted.')) return;
    setActing(id);
    try {
      await adminApi.rejectReferral(id);
      load();
    } catch {
      alert('Failed to reject referral payout.');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="fade-slide-in">
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Referral Payout Review</h2>
      <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24 }}>
        Suspicious referrals are <strong>held before payout</strong>. Approve to grant credits to both users, or reject to deny the bonus.
      </p>
      {loading ? <div className="spinner" /> : items.length === 0 ? (
        <div className="widget-card" style={{ color: 'var(--text-dim)' }}>No pending referral reviews.</div>
      ) : (
        <div className="widget-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table admin-table">
            <thead>
              <tr>
                <th>Referrer</th>
                <th>Referred</th>
                <th>Signals</th>
                <th>Bonus</th>
                <th>IPs</th>
                <th>Held since</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.referrer_email}</td>
                  <td>{item.referred_email}</td>
                  <td>
                    {item.signals.map(s => (
                      <span key={s} className={`badge ${s === 'ip_match' ? 'badge-failed' : 'badge-processing'}`} style={{ marginRight: 4 }}>{s}</span>
                    ))}
                  </td>
                  <td>{item.bonus_amount} cr × 2</td>
                  <td style={{ fontSize: 11 }}>{item.referrer_signup_ip || '—'} / {item.referred_signup_ip || '—'}</td>
                  <td>{formatDate(item.created_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--green)', marginRight: 8 }} disabled={acting === item.id} onClick={() => handleApprove(item.id)}>
                      Approve
                    </button>
                    <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} disabled={acting === item.id} onClick={() => handleReject(item.id)}>
                      Reject
                    </button>
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
