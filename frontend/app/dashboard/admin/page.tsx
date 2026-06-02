'use client';
import { useState, useEffect } from 'react';
import { adminApi } from '@/lib/api/endpoints';
import { AdminOverview } from '@/types';

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getOverview().then(res => {
      setData(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;
  if (!data) return <div className="card-warning" style={{ color: 'var(--red)' }}>Failed to load overview data.</div>;

  const kpis = [
    { label: 'Total Users', value: data.total_users, icon: '👥', color: 'var(--teal)' },
    { label: 'Total Jobs', value: data.total_jobs, icon: '💼', color: 'var(--orange)' },
    { label: 'Total Roasts', value: data.total_roasts, icon: '🔥', color: 'var(--red)' },
    { label: 'Completed Jobs', value: data.completed_jobs, icon: '✅', color: 'var(--green)' },
    { label: 'Tokens Used', value: (((data.llm_summary?.total_input_tokens || 0) + (data.llm_summary?.total_output_tokens || 0)) / 1000).toFixed(1) + 'k', icon: '🧠', color: 'var(--purple)' },
  ];

  return (
    <div className="fade-slide-in">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {kpis.map(k => (
          <div key={k.label} className="widget-card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>{k.label}</div>
              <div style={{ fontSize: 18 }}>{k.icon}</div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: k.color, fontFamily: 'JetBrains Mono' }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="widget-card">
          <div className="section-label">System Health</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(1,169,219,0.04)', borderRadius: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>API Status</span>
              <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>● Operational</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(1,169,219,0.04)', borderRadius: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>LaTeX Renderer</span>
              <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>● Connected</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
