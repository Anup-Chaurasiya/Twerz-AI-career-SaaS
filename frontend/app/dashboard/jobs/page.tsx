'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { jobsApi } from '@/lib/api/endpoints';
import { Job } from '@/types';
import { formatDate, getStatusColor, getStatusLabel, truncate } from '@/lib/utils';

export default function JobListPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const router = useRouter();

  const fetchJobs = async (p = 1) => {
    setLoading(true); setError('');
    try {
      const res = await jobsApi.list(p, 10);
      setJobs(res.data.items);
      setTotalPages(res.data.pages);
      setPage(res.data.page);
    } catch {
      setError('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchJobs(page); }, [page]);

  return (
    <div className="page-scroll">
      <div className="fade-slide-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Job Applications</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Track and manage your tailored resumes.</p>
        </div>
        <Link href="/dashboard/jobs/new" className="btn-primary" style={{ fontSize: 12, padding: '10px 20px', textDecoration: 'none' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Application
        </Link>
      </div>

      <div className="widget-card fade-slide-in stagger-1" style={{ padding: 0, overflow: 'hidden' }}>
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.2)', padding: '12px 16px', color: 'var(--red)', fontSize: 13 }}>
            {error}
          </div>
        )}
        
        {loading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3,4].map(i => <div key={i} style={{ height: 50, background: 'rgba(1,169,219,0.04)', borderRadius: 8, animation: 'shimmer 1.5s infinite' }} />)}
          </div>
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 40, marginBottom: 16 }}>💼</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>No jobs yet</div>
            <p style={{ fontSize: 14 }}>Create your first job application to get a tailored resume.</p>
            <Link href="/dashboard/jobs/new" className="btn-primary" style={{ fontSize: 11, padding: '8px 16px', marginTop: 12, display: 'inline-flex', textDecoration: 'none' }}>Add Job</Link>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map(j => (
                    <tr key={j.id} onClick={() => router.push(`/dashboard/jobs/${j.id}`)}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{j.job_description.company}</td>
                      <td>{truncate(j.job_description.role, 30)}</td>
                      <td>
                        <span className={`badge ${getStatusColor(j.status)}`}>
                          {getStatusLabel(j.status)}
                          {(j.status === 'GENERATING_RESUME' || j.status === 'GENERATING_PDF') && (
                            <span style={{ marginLeft: 6, display: 'inline-block', animation: 'spinPulse 1s linear infinite' }}>⚙️</span>
                          )}
                        </span>
                      </td>
                      <td>{formatDate(j.created_at)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 11 }} onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/jobs/${j.id}`); }}>View</button>
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
