'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/authStore';
import { useCreditStore } from '@/lib/stores/creditStore';
import { profilesApi, jobsApi } from '@/lib/api/endpoints';
import { Profile, Job } from '@/types';
import { formatDate, getStatusColor, getStatusLabel } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { balance } = useCreditStore();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([profilesApi.list(1, 5), jobsApi.list(1, 5)]).then(([p, j]) => {
      if (cancelled) return;
      setProfiles(p.data.items);
      setJobs(j.data.items);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const kpis = [
    { label: 'Profiles', value: profiles.length, icon: '📄', color: 'var(--teal)', href: '/dashboard/profiles' },
    { label: 'Jobs', value: jobs.length, icon: '💼', color: 'var(--orange)', href: '/dashboard/jobs' },
    { label: 'Credits', value: balance?.has_unlimited ? '∞' : (balance?.balance ?? 0), icon: '⚡', color: 'var(--green)', href: '/dashboard/credits' },
    { label: 'Free Today', value: balance?.daily_free_remaining ?? 0, icon: '🎁', color: 'var(--purple)', href: '/dashboard/credits' },
  ];

  return (
    <div className="page-scroll">
      {/* Welcome */}
      <div className="fade-slide-in" style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Dashboard</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-1px', marginBottom: 4 }}>
          Welcome back, <span style={{ color: 'var(--orange)' }}>{user?.name?.split(' ')[0]}</span>
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Your AI resume tailoring hub. Let's land that interview.</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {kpis.map((kpi, i) => (
          <Link key={kpi.label} href={kpi.href} className={`widget-card fade-slide-in stagger-${i + 1}`} style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="kpi-label">{kpi.label}</div>
              <div style={{ fontSize: 20 }}>{kpi.icon}</div>
            </div>
            <div className="kpi-value" style={{ color: kpi.color }}>{kpi.value}</div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="widget-card fade-slide-in stagger-2" style={{ marginBottom: 24 }}>
        <div className="section-label">Quick Actions</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
          <Link href="/dashboard/profiles" className="btn-primary" style={{ fontSize: 12, padding: '10px 20px', textDecoration: 'none' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Upload Resume
          </Link>
          <Link href="/dashboard/jobs/new" className="btn-secondary" style={{ fontSize: 12, padding: '10px 20px', textDecoration: 'none' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            New Job Application
          </Link>
          <Link href="/dashboard/roasts" className="btn-ghost" style={{ fontSize: 12, padding: '10px 20px', textDecoration: 'none' }}>
            🔥 Roast My Resume
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Recent Profiles */}
        <div className="widget-card fade-slide-in stagger-3">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div className="section-label" style={{ margin: 0 }}>Recent Profiles</div>
            <Link href="/dashboard/profiles" style={{ fontSize: 11, color: 'var(--teal)', fontFamily: 'JetBrains Mono' }}>View All →</Link>
          </div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1,2,3].map(i => <div key={i} style={{ height: 44, background: 'rgba(1,169,219,0.04)', borderRadius: 8, animation: 'shimmer 1.5s infinite' }} />)}
            </div>
          ) : profiles.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
              <p style={{ fontSize: 13 }}>No profiles yet</p>
              <Link href="/dashboard/profiles" className="btn-primary" style={{ fontSize: 11, padding: '8px 16px', marginTop: 12, display: 'inline-flex', textDecoration: 'none' }}>Upload Resume</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {profiles.map((p) => (
                <Link key={p.id} href={`/dashboard/profiles/${p.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none', transition: 'all 0.2s ease' }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{p.resume_info?.name || `Profile #${p.id}`}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{formatDate(p.created_at)}</div>
                  </div>
                  <span className={`badge ${getStatusColor(p.status)}`}>{p.status}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Jobs */}
        <div className="widget-card fade-slide-in stagger-4">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div className="section-label" style={{ margin: 0 }}>Recent Jobs</div>
            <Link href="/dashboard/jobs" style={{ fontSize: 11, color: 'var(--teal)', fontFamily: 'JetBrains Mono' }}>View All →</Link>
          </div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1,2,3].map(i => <div key={i} style={{ height: 44, background: 'rgba(1,169,219,0.04)', borderRadius: 8 }} />)}
            </div>
          ) : jobs.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💼</div>
              <p style={{ fontSize: 13 }}>No jobs yet</p>
              <Link href="/dashboard/jobs/new" className="btn-primary" style={{ fontSize: 11, padding: '8px 16px', marginTop: 12, display: 'inline-flex', textDecoration: 'none' }}>Add Job</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {jobs.map((j) => (
                <Link key={j.id} href={`/dashboard/jobs/${j.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none', transition: 'all 0.2s ease' }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{j.job_description.company}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{j.job_description.role}</div>
                  </div>
                  <span className={`badge ${getStatusColor(j.status)}`}>{getStatusLabel(j.status)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
