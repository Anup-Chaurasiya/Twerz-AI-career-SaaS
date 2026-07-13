'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { profilesApi } from '@/lib/api/endpoints';
import { Profile, ResumeInfo } from '@/types';
import { getStatusColor, groupSkillsByCategory, formatDateRange, getExperienceList, getEducationList } from '@/lib/utils';

export default function ProfileDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<ResumeInfo>({});
  const [saving, setSaving] = useState(false);
  
  const [enhancing, setEnhancing] = useState(false);
  const [enhancePreview, setEnhancePreview] = useState<{ before: ResumeInfo; after: ResumeInfo } | null>(null);
  
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const fetchProfile = async () => {
      try {
        const res = await profilesApi.get(Number(id));
        setProfile(res.data);
        if (res.data.status === 'PROCESSING' || res.data.status === 'PENDING') {
          setLoading(false);
          interval = setTimeout(fetchProfile, 3000);
        } else {
          setLoading(false);
          setEditData(res.data.resume_info || {});
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load profile');
        setLoading(false);
      }
    };
    fetchProfile();
    return () => clearTimeout(interval);
  }, [id]);

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const res = await profilesApi.update(Number(id), editData);
      setProfile(res.data);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleEnhance = async () => {
    setEnhancing(true); setError('');
    try {
      const before = profile?.resume_info || {};
      const res = await profilesApi.enhance(Number(id));
      setProfile(res.data);
      setEditData(res.data.resume_info || {});
      setEnhancePreview({ before, after: res.data.resume_info || {} });
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError("You've enhanced this profile 3 times today. Come back tomorrow for more.");
      }
      else setError(err.response?.data?.detail || 'Failed to enhance profile.');
    } finally {
      setEnhancing(false);
    }
  };

  const handleKeepOriginal = async () => {
    if (!enhancePreview) return;
    setSaving(true);
    setError('');
    try {
      const res = await profilesApi.update(Number(id), enhancePreview.before);
      setProfile(res.data);
      setEditData(res.data.resume_info || {});
      setEnhancePreview(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to restore original profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await profilesApi.delete(Number(id));
      router.push('/dashboard/profiles');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete profile');
      setDeleting(false);
      setShowConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="page-scroll" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="page-scroll">
        <div className="widget-card card-warning" style={{ color: 'var(--red)' }}>{error}</div>
        <Link href="/dashboard/profiles" className="btn-secondary" style={{ marginTop: 24, display: 'inline-block' }}>← Back to Profiles</Link>
      </div>
    );
  }

  if (!profile) return null;

  const experience = getExperienceList(profile.resume_info);
  const education = getEducationList(profile.resume_info);
  const skillGroups = groupSkillsByCategory(profile.resume_info?.skills);
  const skillCategories = Object.keys(skillGroups);

  return (
    <div className="page-scroll">
      <Link href="/dashboard/profiles" style={{ fontSize: 13, color: 'var(--text-dim)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24, transition: 'color 0.2s' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Back to Profiles
      </Link>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '12px 16px', borderRadius: 6, marginBottom: 24, color: 'var(--red)', fontSize: 13 }}>{error}</div>}

      {profile.status === 'FAILED' && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '16px 20px', borderRadius: 6, marginBottom: 24, fontSize: 13, color: 'var(--red)', lineHeight: 1.6 }}>
          <strong>Resume processing failed.</strong> This usually means <code style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>GEMINI_API_KEY</code> is missing or invalid in your backend <code style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>.env</code>.
          Get a key from Google AI Studio, restart the backend, then upload again.
        </div>
      )}

      {(profile.status === 'PROCESSING' || profile.status === 'PENDING') && (
        <div style={{ background: 'rgba(251,65,0,0.08)', border: '1px solid rgba(251,65,0,0.2)', padding: '16px 20px', borderRadius: 6, marginBottom: 24, fontSize: 13, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="spinner" style={{ width: 16, height: 16, borderTopColor: 'var(--amber)' }} />
          AI is structuring your resume…
        </div>
      )}

      <div className="widget-card fade-slide-in" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              {profile.resume_info?.name || `Profile #${profile.id}`}
              <span className={`badge ${getStatusColor(profile.status)}`}>{profile.status}</span>
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 16 }}>
              {profile.resume_info?.email && <span>📧 {profile.resume_info.email}</span>}
              {(profile.resume_info?.mobile_number || profile.resume_info?.phone) && (
                <span>📱 {profile.resume_info.mobile_number || profile.resume_info.phone}</span>
              )}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn-secondary" onClick={handleEnhance} disabled={enhancing || profile.status !== 'READY'} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {enhancing ? <><div className="spinner" style={{ width: 14, height: 14, borderTopColor: 'var(--teal)' }} /> Enhancing...</> : '✨ Enhance Profile'}
            </button>
            <button className="btn-ghost" onClick={() => isEditing ? handleSave() : setIsEditing(true)} disabled={saving || profile.status !== 'READY'} style={{ color: isEditing ? 'var(--green)' : '' }}>
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : '✏️ Edit'}
            </button>
            <button className="btn-danger" onClick={() => setShowConfirm(true)}>🗑️ Delete</button>
          </div>
        </div>
      </div>

      {enhancePreview && (
        <div className="widget-card fade-slide-in" style={{ marginBottom: 24, borderColor: 'rgba(245,158,11,0.28)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <div className="section-label">AI Enhancement Preview</div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>AI rewrote your profile to sound more professional. This is free, up to 3 times per day.</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-ghost" onClick={handleKeepOriginal} disabled={saving}>Keep Original</button>
              <button className="btn-primary" onClick={() => setEnhancePreview(null)} disabled={saving} style={{ padding: '8px 16px', fontSize: 11 }}>Accept Changes</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Before</div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 260, overflow: 'auto', padding: 12, borderRadius: 6, background: 'rgba(15,27,46,0.7)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>{JSON.stringify(enhancePreview.before, null, 2)}</pre>
            </div>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>After</div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 260, overflow: 'auto', padding: 12, borderRadius: 6, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.16)', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>{JSON.stringify(enhancePreview.after, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}

      <div className="fade-slide-in stagger-1" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
        {/* Summary */}
        <div className="widget-card">
          <div className="section-label">Professional Summary</div>
          {isEditing ? (
            <textarea className="input-field" value={editData.summary || ''} onChange={e => setEditData({...editData, summary: e.target.value})} rows={4} />
          ) : (
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{profile.resume_info?.summary || 'No summary provided.'}</p>
          )}
        </div>

        {/* Experience */}
        <div className="widget-card">
          <div className="section-label">Experience</div>
          {!experience.length ? (
            <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>No experience found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {experience.map((exp, i) => (
                <div key={i} style={{ paddingBottom: i !== experience.length - 1 ? 20 : 0, borderBottom: i !== experience.length - 1 ? '1px solid rgba(1,169,219,0.08)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{exp.role}</div>
                    <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono', color: 'var(--text-dim)' }}>
                      {formatDateRange(exp.start_date, exp.end_date, exp.duration)}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--teal)', marginBottom: 12 }}>{exp.company_name || exp.company}</div>
                  {exp.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>{exp.description}</p>}
                  {exp.achievements && exp.achievements.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {exp.achievements.map((ach, j) => <li key={j} style={{ marginBottom: 4 }}>{ach}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Two Column: Skills & Education */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {/* Skills */}
          <div className="widget-card">
            <div className="section-label">Skills</div>
            {!skillCategories.length ? (
              <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>No skills found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {skillCategories.map((cat) => (
                  <div key={cat}>
                    <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{cat}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {skillGroups[cat].map((name, i) => (
                        <span key={`${cat}-${i}`} style={{ background: 'rgba(1,169,219,0.08)', border: '1px solid rgba(1,169,219,0.2)', padding: '4px 10px', borderRadius: 4, fontSize: 12, color: 'var(--text-primary)' }}>{name}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Education */}
          <div className="widget-card">
            <div className="section-label">Education</div>
            {!education.length ? (
              <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>No education found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {education.map((edu, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{edu.degree}</div>
                    <div style={{ fontSize: 13, color: 'var(--teal)', marginBottom: 4 }}>{edu.institution}</div>
                    <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono', color: 'var(--text-dim)' }}>
                      {formatDateRange(edu.start_date, edu.end_date, edu.duration)}
                      {(edu.grade || edu.gpa) && ` | ${edu.grade || edu.gpa}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="confirm-backdrop">
          <div className="confirm-card">
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>Delete Profile</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>Are you sure you want to delete this profile? This action cannot be undone.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn-ghost" onClick={() => setShowConfirm(false)} disabled={deleting}>Cancel</button>
              <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
