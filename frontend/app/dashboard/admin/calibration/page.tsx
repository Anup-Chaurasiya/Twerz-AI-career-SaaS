'use client';
import { useEffect, useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { adminApi } from '@/lib/api/endpoints';
import { CalibrationRow } from '@/types';

export default function AdminCalibrationPage() {
  const [rows, setRows] = useState<CalibrationRow[]>([]);
  const [minSample, setMinSample] = useState(10);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);

  const load = () => {
    setLoading(true);
    adminApi.getCalibration().then(res => {
      setRows(res.data.rows);
      setMinSample(res.data.min_sample_size);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    adminApi.getCalibration().then(res => {
      if (cancelled) return;
      setRows(res.data.rows);
      setMinSample(res.data.min_sample_size);
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const chartData = rows.map(r => ({
    name: `${r.fit_label} / ${r.ats_bucket}`,
    interview_rate: Math.round(r.interview_rate * 100),
    below_threshold: r.below_threshold,
    sample_size: r.sample_size,
  }));

  return (
    <div className="fade-slide-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Score Calibration</h2>
          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Bands below {minSample} samples are shown muted — insufficient data.</p>
        </div>
        <button className="btn-primary" disabled={computing} onClick={async () => {
          setComputing(true);
          try { await adminApi.computeCalibration(); load(); } finally { setComputing(false); }
        }}>{computing ? 'Computing...' : 'Recompute'}</button>
      </div>
      {loading ? <div className="spinner" /> : (
        <>
          <div className="widget-card" style={{ height: 360, marginBottom: 24 }}>
            <div className="section-label">Interview Rate by Band</div>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 60 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={80} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v) => [`${Number(v ?? 0)}%`, 'Interview rate']} />
                <Bar dataKey="interview_rate" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.below_threshold ? 'rgba(148,163,184,0.4)' : '#01a9db'} stroke={entry.below_threshold ? '#94a3b8' : undefined} strokeDasharray={entry.below_threshold ? '4 4' : undefined} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="widget-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table admin-table">
              <thead><tr><th>Fit</th><th>ATS Bucket</th><th>Sample</th><th>App Rate</th><th>Interview</th><th>Offer</th><th>Reliability</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ opacity: r.below_threshold ? 0.5 : 1 }}>
                    <td>{r.fit_label}</td><td>{r.ats_bucket}</td><td>{r.sample_size}</td>
                    <td>{(r.application_rate * 100).toFixed(1)}%</td>
                    <td>{(r.interview_rate * 100).toFixed(1)}%</td>
                    <td>{(r.offer_rate * 100).toFixed(1)}%</td>
                    <td>{r.below_threshold ? <span style={{ color: 'var(--text-dim)' }}>Insufficient data</span> : <span style={{ color: 'var(--green)' }}>Reliable</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
