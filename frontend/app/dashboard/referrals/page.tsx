'use client';

import { useAuthStore } from '@/lib/stores/authStore';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ReferralsPage() {
  const { user, isLoggedIn, isLoading } = useAuthStore();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) router.push('/login');
  }, [isLoading, isLoggedIn, router]);

  if (isLoading || !user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  const referralCode = user.referral_code || '';
  const referralUrl = referralCode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/login?ref=${referralCode}`
    : '';

  const handleCopy = () => {
    if (referralUrl) {
      navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareOnTwitter = () => {
    const text = encodeURIComponent(
      '🎯 Just tried ATS Beater - AI-powered resume tailoring that actually works! Get 2 bonus credits when you sign up with my link:'
    );
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(referralUrl)}`,
      '_blank'
    );
  };

  const shareOnLinkedIn = () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralUrl)}`,
      '_blank'
    );
  };

  const steps = [
    'Share your unique referral link with friends',
    'They sign up using your link',
    'After their first successful resume generation, you both get 2 credits!',
  ];

  const faqs = [
    {
      q: 'When do I receive my referral credits?',
      a: 'Credits are granted automatically after your friend completes their first successful resume generation (when their job reaches READY status).',
    },
    {
      q: 'Is there a limit to referrals?',
      a: 'No! You can refer unlimited friends and earn 2 credits for each successful referral.',
    },
    {
      q: "What if my friend doesn't use my link?",
      a: 'They must sign up using your unique referral link for the bonus to apply. Make sure they use the link above when creating their account.',
    },
  ];

  return (
    <div className="page-scroll">
      <div className="fade-slide-in" style={{ marginBottom: 32 }}>
        <div className="section-label">Growth</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Refer Friends, Earn Credits</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Share ATS Beater with friends and both of you get 2 bonus credits.
        </p>
      </div>

      {/* How it works */}
      <div
        className="widget-card fade-slide-in stagger-1"
        style={{
          marginBottom: 24,
          background: 'linear-gradient(135deg, rgba(255,90,31,0.12), rgba(22,43,69,0.8))',
          borderColor: 'rgba(255,90,31,0.3)',
        }}
      >
        <div className="section-label" style={{ marginBottom: 20 }}>How It Works</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div
                style={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'rgba(255,90,31,0.2)',
                  border: '1px solid rgba(255,90,31,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'JetBrains Mono',
                  fontWeight: 700,
                  fontSize: 12,
                  color: 'var(--orange)',
                }}
              >
                {i + 1}
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, paddingTop: 4 }}>{step}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Referral link */}
      <div className="widget-card fade-slide-in stagger-2" style={{ marginBottom: 24 }}>
        <div className="section-label" style={{ marginBottom: 16 }}>Your Referral Link</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={referralUrl}
            readOnly
            className="input-field input-mono"
            style={{ flex: 1, minWidth: 200 }}
          />
          <button onClick={handleCopy} className="btn-primary" style={{ fontSize: 11, padding: '10px 20px', flexShrink: 0 }}>
            {copied ? '✓ Copied!' : 'Copy Link'}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Share on:</span>
          <button onClick={shareOnTwitter} className="btn-ghost" style={{ fontSize: 11, padding: '8px 14px' }}>
            Twitter / X
          </button>
          <button onClick={shareOnLinkedIn} className="btn-ghost" style={{ fontSize: 11, padding: '8px 14px' }}>
            LinkedIn
          </button>
        </div>
      </div>

      {/* Benefits */}
      <div className="widget-card card-teal fade-slide-in stagger-3" style={{ marginBottom: 24 }}>
        <div className="section-label" style={{ marginBottom: 12 }}>Why Refer?</div>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            ['Help your friends', 'land more interviews with better-tailored resumes'],
            ['Earn credits', 'for every successful referral — no limit'],
            ['Build your network', '— when your friends succeed, you succeed'],
          ].map(([bold, rest]) => (
            <li key={bold} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <span style={{ color: 'var(--green)', marginRight: 8 }}>→</span>
              <strong style={{ color: 'var(--text-primary)' }}>{bold}</strong> {rest}
            </li>
          ))}
        </ul>
      </div>

      {/* FAQ */}
      <div className="widget-card fade-slide-in stagger-4">
        <div className="section-label" style={{ marginBottom: 20 }}>FAQ</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {faqs.map(({ q, a }) => (
            <div key={q}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{q}</h4>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
