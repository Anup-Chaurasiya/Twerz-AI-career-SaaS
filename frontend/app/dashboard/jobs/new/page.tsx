'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { profilesApi, jobsApi } from '@/lib/api/endpoints';
import { Profile } from '@/types';
import { getProfileDisplayName } from '@/lib/utils';

export default function NewJobPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    profileId: '',
    company: '',
    role: '',
    description: '',
    language: 'english'
  });

  useEffect(() => {
    profilesApi.list(1, 50).then(res => {
      const readyProfiles = res.data.items.filter(p => p.status === 'READY');
      setProfiles(readyProfiles);
      if (readyProfiles.length > 0) setFormData(f => ({ ...f, profileId: readyProfiles[0].id.toString() }));
      setLoading(false);
    }).catch(() => {
      setError('Failed to load profiles. Please try again.');
      setLoading(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.profileId || !formData.company || !formData.role || !formData.description) {
      setError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true); setError('');
    try {
      const res = await jobsApi.create({
        profile_id: Number(formData.profileId),
        job_description: {
          company: formData.company,
          role: formData.role,
          description: formData.description,
          output_language: formData.language as any
        }
      });
      // Navigate to detail — free analyze-fit + generate gate happens there
      router.push(`/dashboard/jobs/${res.data.job_id}`);
    } catch (err: any) {
      if (err.response?.status === 429) setError('Not enough credits. Please upgrade your plan.');
      else setError(err.response?.data?.detail || 'Failed to create job.');
      setSubmitting(false);
    }
  };

  return (
    <div className="page-scroll">
      <Link href="/dashboard/jobs" style={{ fontSize: 13, color: 'var(--text-dim)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24, transition: 'color 0.2s' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Back to Jobs
      </Link>

      <div className="fade-slide-in" style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>New Job Application</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Tailor your resume for a specific role. Tip: install the Apply Assist Chrome extension from{" "}
          <code style={{ fontFamily: 'JetBrains Mono', fontSize: 11 }}>extension/</code> to
          capture JDs and fill Greenhouse/Lever apply forms.
        </p>
      </div>

      <div className="widget-card fade-slide-in stagger-1" style={{ maxWidth: 720 }}>
        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '12px 16px', borderRadius: 6, marginBottom: 24, color: 'var(--red)', fontSize: 13 }}>{error}</div>}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div className="spinner spinner-lg" /></div>
        ) : profiles.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📄</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>No ready profiles</div>
            <p style={{ fontSize: 14 }}>You need to upload and process a base resume first.</p>
            <Link href="/dashboard/profiles" className="btn-primary" style={{ fontSize: 12, padding: '10px 20px', marginTop: 16, display: 'inline-flex', textDecoration: 'none' }}>Go to Profiles</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, fontFamily: 'JetBrains Mono', textTransform: 'uppercase', letterSpacing: 1 }}>Base Profile *</label>
              <select className="input-field" value={formData.profileId} onChange={e => setFormData({...formData, profileId: e.target.value})} required>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{getProfileDisplayName(p)} (Ready)</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, fontFamily: 'JetBrains Mono', textTransform: 'uppercase', letterSpacing: 1 }}>Company Name *</label>
                <input type="text" className="input-field" placeholder="e.g. Stripe" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, fontFamily: 'JetBrains Mono', textTransform: 'uppercase', letterSpacing: 1 }}>Role Title *</label>
                <input type="text" className="input-field" placeholder="e.g. Senior Frontend Engineer" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} required />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, fontFamily: 'JetBrains Mono', textTransform: 'uppercase', letterSpacing: 1 }}>Job Description *</label>
              <textarea className="input-field" placeholder="Paste the full job description here..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={8} required />
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>The AI will extract keywords and requirements from this text.</div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, fontFamily: 'JetBrains Mono', textTransform: 'uppercase', letterSpacing: 1 }}>Output Language</label>
              <select className="input-field" value={formData.language} onChange={e => setFormData({...formData, language: e.target.value})}>
                <option value="english">English (Default)</option>
                <option value="norwegian">Norwegian</option>
                <option value="french">French</option>
                <option value="german">German</option>
                <option value="spanish">Spanish</option>
                <option value="italian">Italian</option>
                <option value="russian">Russian</option>
              </select>
            </div>

            <div style={{ marginTop: 12, paddingTop: 20, borderTop: '1px solid rgba(1,169,219,0.08)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button type="button" className="btn-ghost" onClick={() => router.push('/dashboard/jobs')} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Processing...</> : 'Generate Tailored Resume ✨'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
