export const NAV_LINKS = [
  ['#how-it-works', 'How It Works'],
  ['#platform', 'Platform'],
  ['#features', 'Features'],
  ['#pricing', 'Pricing'],
  ['#faq', 'FAQ'],
] as const;

export const iconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function ScoreRing({ score, color, size = 88 }: { score: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

export function CompareMark({ val, highlight }: { val: boolean | string; highlight?: boolean }) {
  if (val === true) {
    return (
      <span className={`compare-mark compare-mark--yes${highlight ? ' compare-mark--highlight' : ''}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
      </span>
    );
  }
  if (typeof val === 'string') {
    return <span className="compare-mark compare-mark--partial">{val}</span>;
  }
  return (
    <span className="compare-mark compare-mark--no">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
    </span>
  );
}

export type WallStats = {
  total_resumes_tailored: number;
  total_roasts_completed: number;
  avg_ats_score_improvement: number | null;
  has_improvement_data: boolean;
};

export function formatStat(n: number) {
  if (n >= 1000) return `${Math.floor(n / 1000)}k+`;
  return `${n}+`;
}
