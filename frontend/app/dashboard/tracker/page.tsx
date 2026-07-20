'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { jobsApi } from '@/lib/api/endpoints';
import { Job } from '@/types';
import { formatDate } from '@/lib/utils';

const COLUMNS = ['SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN'] as const;

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TrackerPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftNotes, setDraftNotes] = useState('');
  const [draftFollowUp, setDraftFollowUp] = useState('');
  const [draftStatus, setDraftStatus] = useState('SAVED');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    jobsApi.list(1, 50).then((res) => {
      setJobs(res.data.items);
      setLoading(false);
    }).catch(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const startEdit = (j: Job, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(j.id);
    setDraftNotes(j.application_notes || '');
    setDraftFollowUp(toDatetimeLocalValue(j.follow_up_at));
    setDraftStatus(j.application_status || 'SAVED');
    setError(null);
  };

  const saveEdit = async (jobId: number) => {
    setSaving(true);
    setError(null);
    try {
      const res = await jobsApi.updateApplication(jobId, {
        application_status: draftStatus,
        application_notes: draftNotes,
        follow_up_at: draftFollowUp ? new Date(draftFollowUp).toISOString() : null,
      });
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, ...res.data } : j))
      );
      setEditingId(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-scroll">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Application Tracker</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Move roles through Saved → Applied → Interview → Offer. Set follow-up dates for reminders.
        </p>
      </div>

      {error && (
        <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</div>
      )}

      {loading ? (
        <div className="spinner spinner-lg" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {COLUMNS.map((col) => {
            const items = jobs.filter((j) => (j.application_status || 'SAVED') === col);
            return (
              <div key={col} className="widget-card" style={{ minHeight: 280, padding: 12 }}>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, letterSpacing: 1, color: 'var(--text-dim)', marginBottom: 12 }}>
                  {col} · {items.length}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map((j) => (
                    <div
                      key={j.id}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: 'rgba(1,169,219,0.06)',
                        border: '1px solid rgba(1,169,219,0.12)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <Link
                        href={`/dashboard/jobs/${j.id}`}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{j.job_description.role}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{j.job_description.company}</div>
                        <div style={{ fontSize: 11, marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                          <span style={{
                            color: j.fit_label === 'STRONG' ? 'var(--green)' : j.fit_label === 'STRETCH' ? 'var(--amber)' : j.fit_label === 'MISMATCH' ? 'var(--red)' : 'var(--teal)',
                            fontWeight: 600,
                          }}>
                            Fit {j.fit_score ?? '—'}
                            {j.fit_label ? ` · ${j.fit_label}` : ''}
                          </span>
                          <span style={{ color: 'var(--text-dim)' }}>ATS {j.ats_score_after ?? '—'}</span>
                          {j.evidence_counts && (
                            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                              S{j.evidence_counts.supported}/P{j.evidence_counts.partial}/M{j.evidence_counts.missing}
                            </span>
                          )}
                        </div>
                      </Link>
                      {j.follow_up_at && editingId !== j.id && (
                        <div style={{ fontSize: 10, color: 'var(--amber)', marginTop: 4 }}>
                          Follow up {formatDate(j.follow_up_at)}
                        </div>
                      )}
                      {j.application_notes && editingId !== j.id && (
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {j.application_notes}
                        </div>
                      )}

                      {editingId === j.id ? (
                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                          <select
                            value={draftStatus}
                            onChange={(e) => setDraftStatus(e.target.value)}
                            style={{ fontSize: 11, padding: 6, borderRadius: 4, background: 'var(--deep)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}
                          >
                            {COLUMNS.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <input
                            type="datetime-local"
                            value={draftFollowUp}
                            onChange={(e) => setDraftFollowUp(e.target.value)}
                            style={{ fontSize: 11, padding: 6, borderRadius: 4, background: 'var(--deep)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}
                          />
                          <textarea
                            value={draftNotes}
                            onChange={(e) => setDraftNotes(e.target.value)}
                            placeholder="Notes"
                            rows={2}
                            style={{ fontSize: 11, padding: 6, borderRadius: 4, background: 'var(--deep)', color: 'var(--text-primary)', border: '1px solid var(--card-border)', resize: 'vertical' }}
                          />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn-primary"
                              style={{ fontSize: 10, padding: '4px 8px' }}
                              disabled={saving}
                              onClick={() => saveEdit(j.id)}
                            >
                              {saving ? '…' : 'Save'}
                            </button>
                            <button
                              className="btn-ghost"
                              style={{ fontSize: 10, padding: '4px 8px' }}
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="btn-ghost"
                          style={{ fontSize: 10, padding: '4px 0', marginTop: 6 }}
                          onClick={(e) => startEdit(j, e)}
                        >
                          Edit follow-up
                        </button>
                      )}
                    </div>
                  ))}
                  {!items.length && (
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: 8 }}>No jobs</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
