'use client';

import Link from 'next/link';

const STEPS = [
  {
    title: 'Load the extension',
    body: 'Chrome → Extensions → Developer mode → Load unpacked → select the repo extension/ folder.',
  },
  {
    title: 'Connect your account',
    body: 'Open the extension popup → Connect account. Sign in if prompted — no JWT paste needed.',
  },
  {
    title: 'Capture a job',
    body: 'On LinkedIn, Naukri, Indeed, Greenhouse, Lever, or Workday, click Capture JD. The extension badge shows … while your resume generates, then ✓ when ready.',
  },
  {
    title: 'Apply Assist',
    body: 'Open the employer apply form (Greenhouse, Lever, Workday). Click Apply Assist → upload tailored PDF, paste cover letter, fill questions. You click Submit.',
  },
] as const;

export default function ExtensionDashboardPage() {
  return (
    <div className="fade-slide-in" style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Apply Assist extension</h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
        Guided apply — not auto-apply. Capture JDs, get honest fit scores and tailored PDFs, then one-click fill on
        employer forms. Requires Job Hunt Pro or an active time pass.
      </p>

      <div className="widget-card" style={{ marginBottom: 20, padding: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Quick connect</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          After loading the unpacked extension, open this page from the extension popup Connect button, or visit{' '}
          <Link href="/extension/connect" style={{ color: 'var(--accent)' }}>/extension/connect</Link> with the
          extension installed.
        </p>
        <Link href="/extension/connect" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
          Open connect page
        </Link>
      </div>

      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 12 }}>
        {STEPS.map((step, i) => (
          <li key={step.title} className="widget-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Step {i + 1}</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{step.title}</div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{step.body}</p>
          </li>
        ))}
      </ol>

      <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 20, lineHeight: 1.6 }}>
        Supported apply forms: Greenhouse, Lever, Workday. EEO/demographic fields are never auto-filled unless you
        enable that in extension settings.
      </p>
    </div>
  );
}
