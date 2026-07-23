'use client';

import {
  Bar,
  BarChart,
  Cell,
  Funnel,
  FunnelChart,
  Legend,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type BandRow = {
  fit_label: string;
  total_jobs: number;
  applied_jobs: number;
  interview_jobs: number;
  offer_jobs: number;
  application_rate: number;
  interview_rate: number;
  offer_rate: number;
};

type BenchmarkRow = {
  fit_label: string;
  sample_size: number;
  interview_rate: number;
  offer_rate: number;
};

export type AnalyticsChartData = {
  total_jobs: number;
  total_applied: number;
  sufficient_data: boolean;
  by_band: BandRow[];
  platform_benchmarks: BenchmarkRow[];
};

const FIT_COLORS: Record<string, string> = {
  STRONG: '#10b981',
  GOOD: '#38bdf8',
  STRETCH: '#f59e0b',
  MISMATCH: '#ef4444',
};

const FIT_ORDER = ['STRONG', 'GOOD', 'STRETCH', 'MISMATCH'];

function fitColor(label: string) {
  return FIT_COLORS[label] || '#ff5a1f';
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'rgba(22,43,69,0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '10px 14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {label && (
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-dim)', marginBottom: 6, letterSpacing: 1 }}>
          {label}
        </div>
      )}
      {payload.map((entry) => {
        const raw = entry as { name: string; value: number; color: string; dataKey?: string; payload?: { count?: number } };
        const displayValue = raw.payload?.count ?? raw.value;
        const formatted =
          typeof displayValue === 'number' && raw.dataKey?.includes('rate')
            ? `${displayValue.toFixed(1)}%`
            : displayValue;
        return (
          <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-primary)', marginBottom: 2 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: entry.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-secondary)' }}>{entry.name}:</span>
            <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{formatted}</span>
          </div>
        );
      })}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="widget-card" style={{ padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', minHeight: 280 }}>
      <div className="section-label" style={{ marginBottom: 4 }}>{title}</div>
      {subtitle && <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>{subtitle}</p>}
      <div style={{ flex: 1, minHeight: 220 }}>{children}</div>
    </div>
  );
}

function ProgressRing({ current, goal }: { current: number; goal: number }) {
  const pct = Math.min(100, Math.round((current / goal) * 100));
  const data = [{ name: 'progress', value: pct, fill: 'url(#progressGradient)' }];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadialBarChart
        cx="50%"
        cy="50%"
        innerRadius="68%"
        outerRadius="100%"
        barSize={14}
        data={data}
        startAngle={90}
        endAngle={-270}
      >
        <defs>
          <linearGradient id="progressGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff5a1f" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <RadialBar background={{ fill: 'rgba(255,255,255,0.06)' }} dataKey="value" cornerRadius={8} isAnimationActive={false} />
        <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" fill="var(--text-primary)" fontSize={28} fontWeight={700} fontFamily="JetBrains Mono">
          {current}
        </text>
        <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" fill="var(--text-dim)" fontSize={11} fontFamily="JetBrains Mono">
          / {goal} apps
        </text>
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

function ConversionRates({ bands }: { bands: BandRow[] }) {
  const applied = bands.reduce((s, b) => s + b.applied_jobs, 0);
  const interview = bands.reduce((s, b) => s + b.interview_jobs, 0);
  const offer = bands.reduce((s, b) => s + b.offer_jobs, 0);

  const rates = [
    { label: 'Apply → Interview', value: applied > 0 ? (interview / applied) * 100 : 0, color: '#ff5a1f' },
    { label: 'Interview → Offer', value: interview > 0 ? (offer / interview) * 100 : 0, color: '#f59e0b' },
    { label: 'Apply → Offer', value: applied > 0 ? (offer / applied) * 100 : 0, color: '#10b981' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8 }}>
      {rates.map((r) => (
        <div key={r.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{r.label}</span>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: r.color }}>{r.value.toFixed(1)}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, r.value)}%`,
                borderRadius: 3,
                background: `linear-gradient(90deg, ${r.color}, ${r.color}88)`,
                transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsCharts({ data, hasData }: { data: AnalyticsChartData; hasData: boolean }) {
  const appliedTotal = data.by_band.reduce((s, b) => s + b.applied_jobs, 0);
  const interviewTotal = data.by_band.reduce((s, b) => s + b.interview_jobs, 0);
  const offerTotal = data.by_band.reduce((s, b) => s + b.offer_jobs, 0);

  const funnelStages = [
    { name: 'Applied', count: appliedTotal, fill: '#ff5a1f' },
    { name: 'Interview', count: interviewTotal, fill: '#f59e0b' },
    { name: 'Offer', count: offerTotal, fill: '#10b981' },
  ];

  const funnelData = funnelStages.map((s) => ({
    ...s,
    value: Math.max(s.count, 1),
  }));

  const mixData = FIT_ORDER.map((label) => {
    const band = data.by_band.find((b) => b.fit_label === label);
    const value = hasData ? (band?.applied_jobs ?? 0) : (band?.total_jobs ?? 0);
    return { name: label, value, fill: fitColor(label) };
  }).filter((d) => d.value > 0);

  const comparisonData = FIT_ORDER.map((label) => {
    const band = data.by_band.find((b) => b.fit_label === label);
    const benchmark = data.platform_benchmarks.find((b) => b.fit_label === label);
    if (!band || band.applied_jobs === 0) return null;
    return {
      fit_label: label,
      you: +(band.interview_rate * 100).toFixed(1),
      platform: benchmark && benchmark.sample_size >= 10 ? +(benchmark.interview_rate * 100).toFixed(1) : null,
    };
  }).filter(Boolean) as Array<{ fit_label: string; you: number; platform: number | null }>;

  function FunnelStats() {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 8, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {funnelStages.map((s) => (
          <div key={s.name} style={{ textAlign: 'center' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.fill, margin: '0 auto 6px' }} />
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>{s.name}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{s.count}</div>
          </div>
        ))}
      </div>
    );
  }

  if (!hasData) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
        <ChartCard title="Unlock Full Analytics" subtitle="Track at least 5 applications to unlock conversion charts">
          <ProgressRing current={data.total_applied} goal={5} />
        </ChartCard>

        {mixData.length > 0 && (
          <ChartCard title="Job Portfolio" subtitle="Your jobs by fit label">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={mixData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" stroke="none" isAnimationActive={false}>
                  {mixData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {appliedTotal > 0 && (
          <ChartCard title="Early Funnel Preview" subtitle="Your pipeline so far">
            <ResponsiveContainer width="100%" height={180}>
              <FunnelChart>
                <Tooltip content={<ChartTooltip />} />
                <Funnel dataKey="value" data={funnelData} isAnimationActive={false}>
                  {funnelData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
            <FunnelStats />
          </ChartCard>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
      {/* Row 1: Funnel + Mix + Conversion rates */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <ChartCard title="Conversion Funnel" subtitle="Applied → Interview → Offer">
          <ResponsiveContainer width="100%" height={180}>
            <FunnelChart>
              <Tooltip content={<ChartTooltip />} />
              <Funnel dataKey="value" data={funnelData} isAnimationActive={false}>
                {funnelData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
          <FunnelStats />
        </ChartCard>

        <ChartCard title="Application Mix" subtitle="Where you're applying by fit label">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={mixData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" stroke="none" isAnimationActive={false}>
                {mixData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Conversion Rates" subtitle="Stage-to-stage success">
          <ConversionRates bands={data.by_band} />
        </ChartCard>
      </div>

      {/* Row 2: You vs Platform bar chart */}
      {comparisonData.length > 0 && (
        <ChartCard title="You vs Platform" subtitle="Interview rate by fit label (% of applications that reached interview)">
          <ResponsiveContainer width="100%" height={Math.max(220, comparisonData.length * 48 + 40)}>
            <BarChart data={comparisonData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }} barGap={4}>
              <defs>
                <linearGradient id="youBar" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ff5a1f" />
                  <stop offset="100%" stopColor="#ff8a5c" />
                </linearGradient>
                <linearGradient id="platformBar" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
              <YAxis type="category" dataKey="fit_label" width={72} tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="square"
                iconSize={10}
                formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{value}</span>}
              />
              <Bar dataKey="you" name="You" fill="url(#youBar)" radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false} />
              <Bar dataKey="platform" name="Platform avg" fill="url(#platformBar)" radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Row 3: Stacked bar — pipeline counts by fit label */}
      <ChartCard title="Pipeline by Fit Label" subtitle="Applied, interview, and offer counts per fit band">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={FIT_ORDER.map((label) => {
              const band = data.by_band.find((b) => b.fit_label === label);
              return {
                fit_label: label,
                Applied: band?.applied_jobs ?? 0,
                Interview: band?.interview_jobs ?? 0,
                Offer: band?.offer_jobs ?? 0,
              };
            }).filter((d) => d.Applied > 0 || d.Interview > 0 || d.Offer > 0)}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <XAxis dataKey="fit_label" tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="square"
              iconSize={10}
              formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{value}</span>}
            />
            <Bar dataKey="Applied" fill="#ff5a1f" radius={[4, 4, 0, 0]} barSize={18} isAnimationActive={false} />
            <Bar dataKey="Interview" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={18} isAnimationActive={false} />
            <Bar dataKey="Offer" fill="#10b981" radius={[4, 4, 0, 0]} barSize={18} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
