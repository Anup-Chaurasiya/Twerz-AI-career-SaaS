'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api/endpoints';
import { useAuthStore } from '@/lib/stores/authStore';

const CACHE_KEY = 'atsbeater_onboarding_dismissed';

export function OnboardingWelcomeModal() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.onboarding_completed) {
      setOpen(false);
      return;
    }
    if (typeof window !== 'undefined' && sessionStorage.getItem(CACHE_KEY) === '1') {
      setOpen(false);
      return;
    }
    setOpen(true);
  }, [user]);

  if (!user || user.onboarding_completed || !open) return null;

  const dismiss = async () => {
    setSaving(true);
    try {
      await authApi.completeOnboarding();
      setUser({ ...user, onboarding_completed: true });
      sessionStorage.setItem(CACHE_KEY, '1');
      setOpen(false);
    } catch {
      sessionStorage.setItem(CACHE_KEY, '1');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(5, 12, 24, 0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        className="widget-card fade-slide-in"
        style={{
          maxWidth: 440,
          width: '100%',
          padding: 32,
          background: 'linear-gradient(160deg, rgba(22,43,69,0.98), rgba(8,16,32,0.98))',
          border: '1px solid rgba(1,169,219,0.2)',
        }}
      >
        <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
          ATS<span style={{ color: 'var(--orange)' }}>Beater</span>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
          Honest fit scoring before you spend a credit. Tailor only what&apos;s real.
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.55, marginBottom: 24 }}>
          Some JDs will show low fit — that&apos;s the tool protecting you from a doomed application, not a bug.
        </p>
        <button
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '12px 0' }}
          onClick={dismiss}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Got it'}
        </button>
      </div>
    </div>
  );
}
