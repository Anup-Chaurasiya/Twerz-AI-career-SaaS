'use client';
import { useState, useEffect } from 'react';
import { adminApi } from '@/lib/api/endpoints';
import { Tenant } from '@/types';
import { formatDate } from '@/lib/utils';

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTenants = () => {
    setLoading(true);
    adminApi.listTenants(1, 100).then(res => {
      setTenants(res.data.items);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    adminApi.listTenants(1, 100).then(res => {
      if (cancelled) return;
      setTenants(res.data.items);
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleOpenModal = (t?: Tenant) => {
    if (t) { setEditId(t.id); setName(t.name); }
    else { setEditId(null); setName(''); }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editId) await adminApi.updateTenant(editId, name);
      else await adminApi.createTenant(name);
      setShowModal(false);
      fetchTenants();
    } catch {
      alert('Failed to save tenant.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tenant?')) return;
    try {
      await adminApi.deleteTenant(id);
      fetchTenants();
    } catch {
      alert('Failed to delete tenant.');
    }
  };

  return (
    <div className="fade-slide-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Tenants (B2B)</h2>
        <button className="btn-primary" onClick={() => handleOpenModal()} style={{ fontSize: 12, padding: '8px 16px' }}>+ New Tenant</button>
      </div>

      <div className="widget-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24 }}><div className="spinner" /></div>
        ) : tenants.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 0' }}>No tenants found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Created At</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-dim)' }}>{t.id}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</td>
                    <td>{formatDate(t.created_at)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11, marginRight: 8 }} onClick={() => handleOpenModal(t)}>Edit</button>
                      <button className="btn-danger" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => handleDelete(t.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="confirm-backdrop">
          <div className="confirm-card" style={{ width: 400 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{editId ? 'Edit' : 'Create'} Tenant</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Tenant Name</label>
                <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
