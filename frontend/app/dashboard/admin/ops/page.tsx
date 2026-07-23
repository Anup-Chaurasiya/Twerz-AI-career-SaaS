'use client';
import { useEffect, useState, useCallback } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { adminApi } from '@/lib/api/endpoints';
import { OpsLiveData, CohortRetentionData } from '@/types';

export default function AdminOpsPage() {
  const [live, setLive] = useState<OpsLiveData | null>(null);
  const [cohorts, setCohorts] = useState<CohortRetentionData | null>(null);

  const refresh = useCallback(() => {
    adminApi.getOpsLive().then(res => setLive(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    adminApi.getRetentionCohorts().then(res => setCohorts(res.data)).catch(() => {});
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const cohortChartData = (cohorts?.cohorts || []).map(c => ({
    name: c.cohort_week,
    W0: c.retention[0],
    'W+1': c.retention[1],
    'W+2': c.retention[2],
    'W+3': c.retention[3],
  }));

  return (
    <div className="fade-slide-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Mission Control</h2>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Auto-refreshes every 30s · Last: {live?.timestamp ? new Date(live.timestamp).toLocaleTimeString() : '—'}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div className="widget-card"><div className="section-label">Generating Now</div><div style={{ fontSize: 32, fontWeight: 800, color: 'var(--orange)' }}>{live?.jobs_generating_count ?? '—'}</div></div>
        <div className="widget-card"><div className="section-label">Signups Today</div><div style={{ fontSize: 32, fontWeight: 800, color: 'var(--teal)' }}>{live?.signups_today ?? '—'}</div></div>
        <div className="widget-card"><div className="section-label">Revenue Today</div><div style={{ fontSize: 32, fontWeight: 800 }}>{live?.revenue_credits_today ?? '—'} cr</div></div>
        <div className="widget-card"><div className="section-label">Error Rate (1h)</div><div style={{ fontSize: 32, fontWeight: 800, color: (live?.error_rate_1h_pct ?? 0) > 10 ? 'var(--red)' : 'var(--green)' }}>{live?.error_rate_1h_pct ?? '—'}%</div></div>
      </div>

      {live && live.jobs_generating.length > 0 && (
        <div className="widget-card" style={{ marginBottom: 24 }}>
          <div className="section-label">Active Jobs</div>
          {live.jobs_generating.map(j => (
            <div key={j.id} style={{ fontSize: 12, padding: '4px 0' }}>Job #{j.id} — {j.status} (user {j.user_id.slice(0, 8)}…)</div>
          ))}
        </div>
      )}

      <div className="widget-card" style={{ height: 360 }}>
        <div className="section-label">Weekly Cohort Retention (% generated resume)</div>
        {cohortChartData.length === 0 ? <div className="spinner" style={{ marginTop: 40 }} /> : (
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={cohortChartData}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis unit="%" tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="W0" stroke="#01a9db" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="W+1" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="W+2" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="W+3" stroke="#ef4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
