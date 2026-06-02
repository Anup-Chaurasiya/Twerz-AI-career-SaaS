'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { authApi } from '@/lib/api/endpoints';

const BOOT_LINES = [
  { text: '> initializing ATS Beater v2.0...', cls: '' },
  { text: '> loading AI resume engine... ok', cls: 'ok' },
  { text: '> connecting to LaTeX renderer... ok', cls: 'ok' },
  { text: '> ATS analysis module... ready', cls: 'ok' },
  { text: '> awaiting authentication...', cls: 'warn' },
] as const;

export default function LoginPage() {
  const { isLoggedIn, isLoading } = useAuthStore();
  const router = useRouter();
  const [booting, setBooting] = useState(true);
  const [lines, setLines] = useState<{ text: string; cls: string }[]>([]);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState('');

  // Terminal boot animation — run once per visit (not tied to auth state)
  useEffect(() => {
    let i = 0;
    let cancelled = false;
    setLines([]);
    setBooting(true);
    const interval = setInterval(() => {
      if (cancelled) return;
      if (i < BOOT_LINES.length) {
        const line = BOOT_LINES[i];
        i += 1;
        setLines((prev) => [...prev, { text: line.text, cls: line.cls }]);
      } else {
        clearInterval(interval);
        setBooting(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100dvh';
    return () => {
      document.body.style.overflow = '';
      document.body.style.height = '';
    };
  }, []);

  // OAuth callback + redirect if already logged in
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let token = params.get('token') || params.get('access_token');
    if (!token && window.location.hash.includes('access_token=')) {
      const hashQuery = window.location.hash.split('?')[1] || '';
      token = new URLSearchParams(hashQuery).get('access_token');
    }
    if (token) {
      localStorage.setItem('token', token);
      window.history.replaceState({}, '', '/login');
      useAuthStore.getState().fetchMe().then(() => router.push('/dashboard'));
      return;
    }
    if (!isLoading && isLoggedIn) router.push('/dashboard');
  }, [isLoading, isLoggedIn, router]);

  const handleLogin = async () => {
    setLoginLoading(true);
    setError('');
    try {
      const res = await authApi.getGoogleLoginUrl();
      window.location.href = res.data.url;
    } catch {
      setError('Failed to connect. Please try again.');
      setLoginLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--deep)', position: 'relative', overflow: 'hidden' }}>
      <div className="dot-grid" aria-hidden />
      <div className="scanline-overlay" aria-hidden />
      <div className="ambient-orb" style={{ width: 400, height: 400, top: -100, right: -50, background: 'rgba(251,65,0,0.05)' }} aria-hidden />
      <div className="ambient-orb" style={{ width: 300, height: 300, bottom: -50, left: -50, background: 'rgba(1,169,219,0.04)', animationDirection: 'alternate-reverse' }} aria-hidden />

      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 440, padding: '0 24px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: 'JetBrains Mono', fontWeight: 800, fontSize: 20, marginBottom: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'linear-gradient(135deg, rgba(251,65,0,0.2), rgba(251,65,0,0.05))', border: '1px solid rgba(251,65,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FB4100" strokeWidth="2"><path d="M20 10V8a2.4 2.4 0 0 0-.706-1.704l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h4.35"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M16 14a2 2 0 0 0-2 2"/><path d="M16 22a2 2 0 0 1-2-2"/><path d="M20 14a2 2 0 0 1 2 2"/><path d="M20 22a2 2 0 0 0 2-2"/></svg>
            </div>
            ATS<span style={{ color: 'var(--orange)' }}>Beater</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>AI-Powered Resume Tailoring</p>
        </div>

        {/* Card */}
        <div className="widget-card" style={{ padding: 32 }}>
          {/* Boot lines */}
          <div style={{ marginBottom: 24, fontFamily: 'JetBrains Mono', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {lines.filter(Boolean).map((l, i) => (
              <div key={i} style={{ color: l.cls === 'ok' ? 'var(--green)' : l.cls === 'warn' ? 'var(--amber)' : 'var(--text-dim)', opacity: 1, transition: 'opacity 0.3s ease', wordBreak: 'break-word' }}>{l.text}</div>
            ))}
          </div>

          {!booting && (
            <div className="fade-slide-in">
              {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--red)' }}>{error}</div>
              )}
              <button onClick={handleLogin} disabled={loginLoading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px 0', fontSize: 13 }}>
                {loginLoading ? (
                  <><div className="spinner" style={{ width: 16, height: 16 }} /> Connecting...</>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    Continue with Google
                  </>
                )}
              </button>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
                By signing in, you agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-dim)', marginTop: 24, fontFamily: 'JetBrains Mono' }}>
          <a href="/" style={{ color: 'var(--teal)', transition: 'color 0.2s' }}>← Back to home</a>
        </p>
      </div>
    </div>
  );
}
