'use client';
import { useState, useEffect } from 'react';
import { adminApi } from '@/lib/api/endpoints';
import { AdminOverview, HealthMetrics } from '@/types';

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [health, setHealth] = useState<HealthMetrics | null>(null);
  const [publicUsage, setPublicUsage] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingAlert, setTestingAlert] = useState(false);
  const [runningMatrix, setRunningMatrix] = useState(false);

  useEffect(() => {
    Promise.all([
      adminApi.getOverview(),
      adminApi.getHealthMetrics(),
      adminApi.getPublicUsage(),
    ]).then(([overview, healthRes, usageRes]) => {
      setData(overview.data);
      setHealth(healthRes.data);
      setPublicUsage(usageRes.data);
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
    { label: 'LLM Cost', value: `$${(data.llm_summary?.total_estimated_cost_usd || 0).toFixed(2)}`, icon: '🧠', color: 'var(--purple)' },
  ];

  const h24 = health?.windows?.['24h'];
  const usage24 = (publicUsage?.['24h'] as Record<string, unknown>) || {};

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

      <div className="dash-grid-2" style={{ marginBottom: 24 }}>
        <div className="widget-card">
          <div className="section-label">System Health (24h)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            {[
              { label: 'Phase 1 Failures', value: h24?.phase1_failures ?? 0, color: h24?.phase1_failures ? 'var(--red)' : 'var(--green)' },
              { label: 'PDF Failures', value: h24?.pdf_failures ?? 0, color: h24?.pdf_failures ? 'var(--red)' : 'var(--green)' },
              { label: 'Unreadable PDFs', value: h24?.unreadable_pdfs ?? 0, color: h24?.unreadable_pdfs ? 'var(--orange)' : 'var(--green)' },
              { label: 'Refund Rate', value: `${h24?.refund_rate_pct ?? 0}%`, color: (h24?.refund_rate_pct ?? 0) > 5 ? 'var(--red)' : 'var(--green)' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(1,169,219,0.04)', borderRadius: 8 }}>
                <span style={{ fontSize: 13 }}>{row.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="widget-card">
          <div className="section-label">Public Endpoint Usage (24h)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            {[
              { label: 'Total Requests', value: usage24.total_requests ?? 0 },
              { label: 'Unique IPs', value: usage24.unique_ips ?? 0 },
              { label: 'Rate Limited (429)', value: usage24.rate_limited ?? 0 },
              { label: '429 Rate', value: `${usage24.rate_limit_pct ?? 0}%` },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(1,169,219,0.04)', borderRadius: 8 }}>
                <span style={{ fontSize: 13 }}>{row.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)' }}>{String(row.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="widget-card">
        <div className="section-label">Model Status & Alerts</div>
        <div style={{ fontSize: 13, marginTop: 12, marginBottom: 16, color: 'var(--text-dim)' }}>
          Flash: {health?.models?.llm_flash_model} · Pro: {health?.models?.llm_pro_model}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn-ghost" disabled={testingAlert} onClick={async () => {
            setTestingAlert(true);
            try {
              const res = await adminApi.testAlert();
              alert(res.data.message);
            } catch { alert('Alert test failed'); }
            finally { setTestingAlert(false); }
          }}>{testingAlert ? 'Sending...' : 'Test Alert'}</button>
          <button className="btn-ghost" disabled={runningMatrix || health?.golden_matrix?.is_running} onClick={async () => {
            setRunningMatrix(true);
            try {
              const res = await adminApi.runGoldenMatrix();
              alert(res.data.message || `Golden matrix started (run #${res.data.run_id})`);
            } catch { alert('Failed to start golden matrix'); }
            finally { setRunningMatrix(false); }
          }}>{runningMatrix ? 'Starting...' : 'Run Golden Matrix'}</button>
        </div>
        {health?.golden_matrix?.last_run && (
          <div style={{ fontSize: 12, marginTop: 12, color: 'var(--text-dim)' }}>
            Last run: {String((health.golden_matrix.last_run as Record<string, unknown>).status)} — passed: {String((health.golden_matrix.last_run as Record<string, unknown>).passed ?? 'pending')}
          </div>
        )}
      </div>
    </div>
  );
}
