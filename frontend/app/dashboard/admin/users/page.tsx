'use client';
import { useState, useEffect } from 'react';
import { adminApi } from '@/lib/api/endpoints';
import { AdminUser, Tenant } from '@/types';
import { formatDate } from '@/lib/utils';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  
  // Credits Modal
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [creditAmount, setCreditAmount] = useState(10);
  const [creditDesc, setCreditDesc] = useState('Manual grant by Admin');
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    adminApi.listTenants(1, 100).then(res => setTenants(res.data.items)).catch(() => {});
  }, []);

  const fetchUsers = () => {
    setLoading(true);
    adminApi.listUsers(page, 20, search).then(res => {
      setUsers(res.data.items);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    const delay = setTimeout(fetchUsers, 300);
    return () => clearTimeout(delay);
  }, [page, search]);

  const handleGrantCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setGranting(true);
    try {
      await adminApi.grantCredits(selectedUser.id, creditAmount, creditDesc);
      setShowCreditsModal(false);
      alert(`Successfully granted ${creditAmount} credits to ${selectedUser.name}`);
    } catch {
      alert('Failed to grant credits.');
    } finally {
      setGranting(false);
    }
  };

  return (
    <div className="fade-slide-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Users Management</h2>
        <input type="text" className="input-field" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 300 }} />
      </div>

      <div className="widget-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24 }}><div className="spinner" /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Tenant</th>
                  <th>Joined</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{u.name}</td>
                    <td>{u.email}</td>
                    <td><span className={`badge ${u.is_super_admin ? 'badge-processing' : 'badge-ready'}`}>{u.is_super_admin ? 'Admin' : 'User'}</span></td>
                    <td>{tenants.find(t => t.id === u.tenant_id)?.name || 'Default'}</td>
                    <td>{formatDate(u.created_at)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11, color: 'var(--teal)' }} onClick={() => { setSelectedUser(u); setShowCreditsModal(true); }}>
                        ⚡ Grant Credits
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreditsModal && selectedUser && (
        <div className="confirm-backdrop">
          <div className="confirm-card" style={{ width: 400 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Grant Credits</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>User: <strong style={{ color: 'var(--text-primary)' }}>{selectedUser.name}</strong> ({selectedUser.email})</p>
            <form onSubmit={handleGrantCredits} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Amount</label>
                <input type="number" className="input-field" value={creditAmount} onChange={e => setCreditAmount(Number(e.target.value))} min={1} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Description</label>
                <input type="text" className="input-field" value={creditDesc} onChange={e => setCreditDesc(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button type="button" className="btn-ghost" onClick={() => setShowCreditsModal(false)} disabled={granting}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={granting}>{granting ? 'Granting...' : 'Grant Credits'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
