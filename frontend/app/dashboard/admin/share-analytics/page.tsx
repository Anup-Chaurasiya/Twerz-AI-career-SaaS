'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api/endpoints';

type Summary = {
  total_views: number;
  unique_ips: number;
  signup_attributions: number;
  top_platforms: Array<{ name: string; count: number }>;
  top_browsers: Array<{ name: string; count: number }>;
  views_by_day: Array<{ date: string; count: number }>;
};

export default function ShareAnalyticsPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getShareAnalyticsSummary()
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;
  if (!data) {
    return <div className="card-warning" style={{ color: 'var(--red)' }}>Failed to load share analytics.</div>;
  }

  return (
    <div className="fade-slide-in">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total views', value: data.total_views },
          { label: 'Unique IPs', value: data.unique_ips },
          { label: 'Roast → signup', value: data.signup_attributions },
        ].map((k) => (
          <div key={k.label} className="widget-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              {k.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'JetBrains Mono', color: 'var(--teal)' }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="widget-card">
          <div className="section-label">Top platforms</div>
          <ul style={{ marginTop: 12, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            {(data.top_platforms || []).length === 0 && <li style={{ color: 'var(--text-dim)' }}>No data yet</li>}
            {(data.top_platforms || []).map((p) => (
              <li key={p.name}>{p.name}: {p.count}</li>
            ))}
          </ul>
        </div>
        <div className="widget-card">
          <div className="section-label">Top browsers</div>
          <ul style={{ marginTop: 12, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            {(data.top_browsers || []).length === 0 && <li style={{ color: 'var(--text-dim)' }}>No data yet</li>}
            {(data.top_browsers || []).map((p) => (
              <li key={p.name}>{p.name}: {p.count}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
