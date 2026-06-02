'use client';
import { useState, useEffect } from 'react';
import { adminApi } from '@/lib/api/endpoints';
import { CreditPack, TimePassTier, PromoCode } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function AdminCreditsConfigPage() {
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConfig = () => {
    setLoading(true);
    adminApi.listCreditPacks(1, 100).then(res => {
      setPacks(res.data.items);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchConfig(); }, []);

  return (
    <div className="fade-slide-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Credit Packs</h2>
        <button className="btn-primary" style={{ fontSize: 12, padding: '8px 16px' }} onClick={() => alert('Editing config is restricted in demo mode.')}>+ New Pack</button>
      </div>

      <div className="widget-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24 }}><div className="spinner" /></div>
        ) : packs.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 0' }}>No credit packs found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Credits</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {packs.sort((a,b) => a.sort_order - b.sort_order).map(p => (
                  <tr key={p.id}>
                    <td style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-dim)' }}>{p.id}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                    <td>{p.credits}</td>
                    <td style={{ fontFamily: 'JetBrains Mono', color: 'var(--teal)' }}>{formatCurrency(p.price_paise)}</td>
                    <td><span className={`badge ${p.is_active ? 'badge-ready' : 'badge-failed'}`}>{p.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => alert('Editing config is restricted in demo mode.')}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
