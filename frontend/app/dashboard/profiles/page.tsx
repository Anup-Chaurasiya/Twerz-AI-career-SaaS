'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { profilesApi } from '@/lib/api/endpoints';
import { Profile } from '@/types';
import { formatDate, getStatusColor, getProfileDisplayName } from '@/lib/utils';
import { useCreditStore } from '@/lib/stores/creditStore';
import { handleApiError } from '@/lib/apiError';

export default function ProfilesListPage() {
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const fetchBalance = useCreditStore((s) => s.fetchBalance);

  const { data, isLoading, isFetching, error: queryError } = useQuery({
    queryKey: ['profiles', 'list', page],
    queryFn: async () => {
      const res = await profilesApi.list(page, 10);
      return res.data;
    },
  });

  const profiles: Profile[] = data?.items ?? [];
  const totalPages = data?.pages ?? 1;
  const loading = isLoading || isFetching;
  const listError = queryError ? handleApiError(queryError).message : '';

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB.');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const res = await profilesApi.upload(file);
      await fetchBalance();
      router.push(`/dashboard/profiles/${res.data.profile_id}`);
    } catch (err: unknown) {
      const apiErr = handleApiError(err);
      setError(apiErr.message);
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="page-scroll">
      <div className="fade-slide-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>My Profiles</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Upload your base resumes to tailor for different jobs.</p>
        </div>
      </div>

      <div className="widget-card fade-slide-in stagger-1" style={{ marginBottom: 32 }}>
        {(error || listError) && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '12px 16px', borderRadius: 6, marginBottom: 20, color: 'var(--red)', fontSize: 13 }}>
            {error || listError}
          </div>
        )}
        <div
          className={`upload-zone ${dragOver ? 'dragover' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <input type="file" ref={fileInputRef} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} style={{ display: 'none' }} accept=".pdf,application/pdf" />
          {uploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="spinner spinner-lg" style={{ marginBottom: 16 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Parsing Resume...</div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 8 }}>This usually takes about 10 seconds.</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📤</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Click to upload or drag and drop</div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 8 }}>PDF only (Max 5MB)</div>
            </>
          )}
        </div>
      </div>

      <div className="widget-card fade-slide-in stagger-2" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(1,169,219,0.08)' }}>
          <div className="section-label" style={{ margin: 0 }}>Uploaded Profiles</div>
        </div>
        
        {loading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3].map(i => <div key={i} style={{ height: 50, background: 'rgba(1,169,219,0.04)', borderRadius: 8, animation: 'shimmer 1.5s infinite' }} />)}
          </div>
        ) : profiles.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 40, marginBottom: 16 }}>📄</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>No profiles yet</div>
            <p style={{ fontSize: 14 }}>Upload your first resume above to get started.</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map(p => (
                    <tr key={p.id} onClick={() => router.push(`/dashboard/profiles/${p.id}`)}>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{getProfileDisplayName(p)}</td>
                      <td><span className={`badge ${getStatusColor(p.status)}`}>{p.status}</span></td>
                      <td>{formatDate(p.created_at)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 11 }} onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/profiles/${p.id}`); }}>View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(1,169,219,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Page {page} of {totalPages}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
                  <button className="btn-ghost" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
