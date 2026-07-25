'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { authApi } from '@/lib/api/endpoints';
import { clearGuestProfileSession, loadGuestProfileSession } from '@/lib/guestProfile';

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
  const [loginLoading, setLoginLoading] = useState(false);
  const [completingLogin, setCompletingLogin] = useState(false);
  const [error, setError] = useState('');
  const [oauthResult] = useState(() => persistOAuthTokenFromUrl());
  const oauthTokenHandled = oauthResult.handled;
  const oauthClaimedProfileId = oauthResult.claimedProfileId;

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
      setCompletingLogin(true);
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
    <div className="login-shell" style={{ background: 'var(--deep)' }}>
      <div className="dot-grid" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--a" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--c" aria-hidden="true" />
      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 440, padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: 'Inter', fontWeight: 700, fontSize: 20, marginBottom: 8, color: '#0F172A' }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'linear-gradient(135deg, rgba(255,90,31,0.12), rgba(255,90,31,0.04))', border: '1px solid rgba(255,90,31,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff5a1f" strokeWidth="2"><path d="M20 10V8a2.4 2.4 0 0 0-.706-1.704l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h4.35"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M16 14a2 2 0 0 0-2 2"/><path d="M16 22a2 2 0 0 1 2-2"/><path d="M20 14a2 2 0 0 1 2 2"/><path d="M20 22a2 2 0 0 0 2-2"/></svg>
            </div>
            ATS<span style={{ color: 'var(--orange)' }}>Beater</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', fontFamily: 'Inter' }}>AI-Powered Resume Tailoring</p>
        </div>

        <div className="widget-card login-card">
          {completingLogin ? (
            <div style={{ textAlign: 'center', padding: '28px 12px' }}>
              <div className="spinner spinner-lg" style={{ margin: '0 auto 16px' }} />
              <p style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', marginBottom: 6 }}>
                {oauthClaimedProfileId || loadGuestProfileSession()?.guestToken
                  ? 'Saving your resume…'
                  : 'Signing you in…'}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>
                Taking you to your dashboard
              </p>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-dim)', marginTop: 24, fontFamily: 'JetBrains Mono' }}>
          <a href="/" style={{ color: 'var(--teal)', transition: 'color 0.2s' }}>← Back to home</a>
        </p>
      </div>
    </div>
  );
}
