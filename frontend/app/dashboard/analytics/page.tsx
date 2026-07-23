'use client';

import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { analyticsApi } from '@/lib/api/endpoints';
import { getErrorMessage } from '@/lib/api/client';
import { useAuthStore } from '@/lib/stores/authStore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const AnalyticsCharts = dynamic(() => import('@/components/analytics/AnalyticsCharts'), {
  ssr: false,
  loading: () => (
    <div className="widget-card" style={{ minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner spinner-lg" />
    </div>
  ),
});

function fitBadgeClass(label: string) {
  if (label === 'STRONG') return 'badge-ready';
  if (label === 'STRETCH') return 'badge-pending';
  if (label === 'MISMATCH') return 'badge-failed';
  return 'badge-processing';
}

export default function AnalyticsPage() {
  const { isLoggedIn } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn) router.push('/login');
  }, [isLoggedIn, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics', 'me'],
    queryFn: async () => {
      const response = await analyticsApi.getMyAnalytics();
      return response.data;
    },
    enabled: isLoggedIn,
  });

  if (isLoading) {
    return (
      <div className="page-scroll" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner spinner-lg" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--text-dim)' }}>Loading analytics…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-scroll">
        <div className="widget-card" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
          <h3 style={{ color: 'var(--red)', fontWeight: 700, marginBottom: 8 }}>Failed to load analytics</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{getErrorMessage(error)}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const hasData = data.sufficient_data;

  return (
    <div className="page-scroll">
      <div className="fade-slide-in" style={{ marginBottom: 32 }}>
        <div className="section-label">Insights</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Your Analytics</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Track your application performance and compare with platform benchmarks.
        </p>
      </div>

      {/* Summary KPIs — always visible at top */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="widget-card fade-slide-in stagger-1">
          <div className="kpi-label">Total Jobs</div>
          <div className="kpi-value" style={{ marginTop: 12 }}>{data.total_jobs}</div>
        </div>
        <div className="widget-card fade-slide-in stagger-2">
          <div className="kpi-label">Total Applied</div>
          <div className="kpi-value" style={{ marginTop: 12, color: 'var(--teal)' }}>{data.total_applied}</div>
        </div>
        <div className="widget-card fade-slide-in stagger-3">
          <div className="kpi-label">Data Quality</div>
          <div className="kpi-value" style={{ marginTop: 12, fontSize: 24, color: hasData ? 'var(--green)' : 'var(--amber)' }}>
            {hasData ? 'Good' : 'Limited'}
          </div>
        </div>
      </div>

      <div className="fade-slide-in stagger-4">
        <AnalyticsCharts data={data} hasData={hasData} />
      </div>

      {!hasData ? (
        <div className="widget-card fade-slide-in stagger-5" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Unlock full conversion insights</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto 20px', lineHeight: 1.6 }}>
            Apply to {5 - data.total_applied} more job{5 - data.total_applied !== 1 ? 's' : ''} and update statuses in the Tracker to compare your rates against platform benchmarks.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/dashboard/tracker" className="btn-primary" style={{ fontSize: 11, padding: '10px 20px', textDecoration: 'none' }}>
              Open Tracker
            </Link>
            <Link href="/dashboard/jobs" className="btn-secondary" style={{ fontSize: 11, padding: '10px 20px', textDecoration: 'none' }}>
              View Jobs
            </Link>
          </div>
        </div>
      ) : (
        <>
          {data.nudge_message && (
            <div
              className="widget-card fade-slide-in stagger-4"
              style={{
                marginBottom: 24,
                background: 'linear-gradient(135deg, rgba(255,90,31,0.08), rgba(22,43,69,0.8))',
                borderColor: 'rgba(255,90,31,0.25)',
              }}
            >
              <div className="section-label" style={{ marginBottom: 12 }}>Key Insight</div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{data.nudge_message}</p>
            </div>
          )}

          <div className="widget-card fade-slide-in stagger-4" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="section-label" style={{ margin: 0 }}>Performance by Fit Label</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table admin-table">
                <thead>
                  <tr>
                    <th>Fit Label</th>
                    <th>Total Jobs</th>
                    <th>Applied</th>
                    <th>Interview</th>
                    <th>Offer</th>
                    <th>Interview Rate</th>
                    <th>Offer Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_band.map((band) => {
                    const benchmark = data.platform_benchmarks.find((b) => b.fit_label === band.fit_label);
                    const interviewPct = (band.interview_rate * 100).toFixed(1);
                    const offerPct = (band.offer_rate * 100).toFixed(1);

                    return (
                      <tr key={band.fit_label}>
                        <td>
                          <span className={`badge ${fitBadgeClass(band.fit_label)}`}>{band.fit_label}</span>
                        </td>
                        <td style={{ fontFamily: 'JetBrains Mono' }}>{band.total_jobs}</td>
                        <td style={{ fontFamily: 'JetBrains Mono' }}>{band.applied_jobs}</td>
                        <td style={{ fontFamily: 'JetBrains Mono' }}>{band.interview_jobs}</td>
                        <td style={{ fontFamily: 'JetBrains Mono' }}>{band.offer_jobs}</td>
                        <td>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'JetBrains Mono' }}>{interviewPct}%</span>
                          {benchmark && benchmark.sample_size >= 10 && (
                            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-dim)' }}>
                              avg {(benchmark.interview_rate * 100).toFixed(1)}%
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'JetBrains Mono' }}>{offerPct}%</span>
                          {benchmark && benchmark.sample_size >= 10 && (
                            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-dim)' }}>
                              avg {(benchmark.offer_rate * 100).toFixed(1)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="widget-card fade-slide-in stagger-5" style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>Note:</strong> Benchmark averages appear when the platform has at least 10 data points for that fit label. Update application statuses in the Tracker to improve accuracy.
          </div>
        </>
      )}
    </div>
  );
}
