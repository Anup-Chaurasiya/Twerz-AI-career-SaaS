'use client';
import { useEffect, useState } from 'react';
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { adminApi } from '@/lib/api/endpoints';

const COLORS = ['#01a9db', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#38bdf8', '#84cc16'];

export default function AdminCostsPage() {
  const [costs, setCosts] = useState<Array<{ purpose: string; request_count: number; estimated_cost_usd: number }>>([]);
  const [freeTier, setFreeTier] = useState<Record<string, number>>({});
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([adminApi.getLlmCosts(days), adminApi.getFreeTierUsage()]).then(([costRes, freeRes]) => {
      setCosts(costRes.data.by_purpose);
      setFreeTier(freeRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [days]);

  const totalCost = costs.reduce((s, c) => s + c.estimated_cost_usd, 0);

  return (
    <div className="fade-slide-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Cost Breakdown</h2>
        <select className="input-field" value={days} onChange={e => setDays(Number(e.target.value))} style={{ width: 120 }}>
          <option value={7}>7 days</option>
          <option value={14}>14 days</option>
          <option value={30}>30 days</option>
        </select>
      </div>
      {loading ? <div className="spinner" /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
            <div className="widget-card"><div className="section-label">Total LLM Cost</div><div style={{ fontSize: 28, fontWeight: 700, color: 'var(--teal)' }}>${totalCost.toFixed(4)}</div></div>
            <div className="widget-card"><div className="section-label">Daily Free (7d)</div><div style={{ fontSize: 28, fontWeight: 700 }}>{freeTier.daily_free_credits_7d ?? 0}</div></div>
            <div className="widget-card"><div className="section-label">Enhance Today</div><div style={{ fontSize: 28, fontWeight: 700 }}>{freeTier.profiles_with_enhance_today ?? 0}</div></div>
            <div className="widget-card"><div className="section-label">Public ATS (7d)</div><div style={{ fontSize: 28, fontWeight: 700 }}>{freeTier.public_ats_checks_7d ?? 0}</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div className="widget-card" style={{ height: 320 }}>
              <div className="section-label">Cost by Feature</div>
              <ResponsiveContainer width="100%" height="85%">
                <PieChart>
                  <Pie data={costs} dataKey="estimated_cost_usd" nameKey="purpose" cx="50%" cy="50%" outerRadius={90} label={(props) => `${props.name ?? ''} ${((props.percent ?? 0) * 100).toFixed(0)}%`}>
                    {costs.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `$${Number(v ?? 0).toFixed(4)}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="widget-card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table admin-table">
                <thead><tr><th>Feature</th><th>Requests</th><th>Cost (USD)</th></tr></thead>
                <tbody>
                  {costs.map(c => (
                    <tr key={c.purpose}>
                      <td>{c.purpose}</td>
                      <td>{c.request_count}</td>
                      <td>${c.estimated_cost_usd.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
