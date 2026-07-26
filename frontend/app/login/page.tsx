'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { authApi } from '@/lib/api/endpoints';
import { clearGuestProfileSession, loadGuestProfileSession } from '@/lib/guestProfile';
import BrandLogo from '@/components/BrandLogo';

const BOOT_LINES = [
  { text: '> initializing Twerz resume engine...', cls: '' },
  { text: '> loading AI resume engine... ok', cls: 'ok' },
  { text: '> connecting to LaTeX renderer... ok', cls: 'ok' },
  { text: '> fit analysis module... ready', cls: 'ok' },
  { text: '> awaiting authentication...', cls: 'warn' },
] as const;

/** Persist OAuth JWT before any useEffect (avoids race with AuthInitializer.fetchMe). */
function persistOAuthTokenFromUrl(): { handled: boolean; claimedProfileId: number | null } {
  if (typeof window === 'undefined') return { handled: false, claimedProfileId: null };
  const params = new URLSearchParams(window.location.search);
  let token = params.get('token') || params.get('access_token');
  let claimedProfileId: number | null = null;
  if (!token && window.location.hash) {
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    token = hashParams.get('token') || hashParams.get('access_token');
    const claimed = hashParams.get('claimed_profile');
    if (claimed) claimedProfileId = Number.parseInt(claimed, 10) || null;
  }
  if (!token) return { handled: false, claimedProfileId: null };
  localStorage.setItem('token', token);
  window.history.replaceState({}, '', '/login');
  return { handled: true, claimedProfileId };
}

export default function LoginPage() {
  const router = useRouter();
  const [booting, setBooting] = useState(true);
  const [lines, setLines] = useState<{ text: string; cls: string }[]>([]);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasGuestResume] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return Boolean(loadGuestProfileSession()?.guestToken) || params.get('guest') === '1';
  });
  const [oauthResult] = useState(() => persistOAuthTokenFromUrl());
  const oauthTokenHandled = oauthResult.handled;
  const oauthClaimedProfileId = oauthResult.claimedProfileId;
  const [completingLogin] = useState(() => {
    if (typeof window === 'undefined') return false;
    return oauthResult.handled || !!localStorage.getItem('token');
  });

  useEffect(() => {
    let i = 0;
    let cancelled = false;
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
    }, 280);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    document.body.classList.add('scroll-lock');
    return () => {
      document.body.classList.remove('scroll-lock');
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utm = params.get('utm_source');
    const shareId = params.get('share_id');
    const ref = params.get('ref');
    if (utm) {
      sessionStorage.setItem('signup_utm_source', utm);
      if (shareId) sessionStorage.setItem('signup_share_id', shareId);
    }
    if (ref) {
      sessionStorage.setItem('signup_referral_code', ref);
    }

    const finishLoginRedirect = async () => {
      const source = sessionStorage.getItem('signup_utm_source');
      const sid = sessionStorage.getItem('signup_share_id');
      if (source) {
        try {
          await authApi.setAttribution({ source, share_id: sid });
          sessionStorage.removeItem('signup_utm_source');
          sessionStorage.removeItem('signup_share_id');
        } catch {
          /* ignore */
        }
      }

      let profileId = oauthClaimedProfileId;
      const guestSession = loadGuestProfileSession();
      if (!profileId && guestSession?.guestToken) {
        try {
          const claim = await authApi.claimGuestProfile(guestSession.guestToken);
          profileId = claim.data.profile_id;
        } catch {
          clearGuestProfileSession();
        }
      }
      if (profileId) {
        clearGuestProfileSession();
      }

      if (useAuthStore.getState().isLoggedIn) {
        if (profileId) {
          router.push(`/dashboard/profiles/${profileId}?welcome=profile`);
        } else {
          router.push('/dashboard');
        }
      }
    };

    if (oauthTokenHandled || localStorage.getItem('token')) {
      useAuthStore.getState().fetchMe({ force: true }).then(finishLoginRedirect);
      sessionStorage.removeItem('signup_referral_code');
      return;
    }

    useAuthStore.setState({ isLoading: false });
  }, [oauthTokenHandled, oauthClaimedProfileId, router]);

  const handleLogin = async () => {
    setLoginLoading(true);
    setError('');
    try {
      const ref = sessionStorage.getItem('signup_referral_code') || undefined;
      const guestToken = loadGuestProfileSession()?.guestToken;
      const res = await authApi.getGoogleLoginUrl(ref, guestToken);
      window.location.href = res.data.url;
    } catch {
      setError('Failed to connect. Please try again.');
      setLoginLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="dot-grid" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--a" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--c" aria-hidden="true" />

      <div className="login-inner">
        <header className="login-header">
          <BrandLogo className="login-brand" />
          <p className="login-tagline">Every job deserves its own resume.</p>
          <p className="login-sub">AI resume tailoring with honest fit scores — no fabricated skills.</p>
        </header>

        <div className="widget-card login-card">
          {completingLogin ? (
            <div className="login-status">
              <div className="spinner spinner-lg login-status-spinner" />
              <p className="login-status-title">
                {oauthClaimedProfileId || loadGuestProfileSession()?.guestToken
                  ? 'Saving your resume…'
                  : 'Signing you in…'}
              </p>
              <p className="login-status-sub">Taking you to your dashboard</p>
            </div>
          ) : (
            <>
              <div className="login-terminal" aria-live="polite">
                {lines.map((line, i) => (
                  <div
                    key={i}
                    className={`login-terminal-line login-terminal-line--${line.cls || 'dim'}`}
                  >
                    {line.text}
                  </div>
                ))}
              </div>

              {!booting && (
                <div className="login-actions fade-slide-in">
                  {hasGuestResume && (
                    <div className="login-guest-banner">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <span>Your uploaded resume will be saved to your account after sign-in.</span>
                    </div>
                  )}

                  {error && <div className="login-error">{error}</div>}

                  <button
                    onClick={handleLogin}
                    disabled={loginLoading}
                    className="btn-primary login-google-btn"
                  >
                    {loginLoading ? (
                      <>
                        <div className="spinner" style={{ width: 16, height: 16 }} />
                        Connecting…
                      </>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Continue with Google
                      </>
                    )}
                  </button>

                  <p className="login-perk">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <rect x="3" y="8" width="18" height="4" rx="1" />
                      <path d="M12 8v13" />
                      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
                      <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" />
                    </svg>
                    <strong>3 free resume tailors per day</strong> — no credit card needed
                  </p>

                  <p className="login-legal">
                    By signing in, you agree to our Terms of Service and Privacy Policy.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <p className="login-back">
          <Link href="/">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
