'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { publicApi, profilesApi, authApi } from '@/lib/api/endpoints';
import type { GuestProfilePreview } from '@/types';
import {
  clearGuestProfileSession,
  guestSessionFromUpload,
  loadGuestProfileSession,
  saveGuestProfileSession,
} from '@/lib/guestProfile';

type UploadPhase = 'idle' | 'uploading' | 'processing' | 'ready' | 'failed' | 'expired';

const PROCESS_STEPS = ['Reading document', 'Extracting content', 'Structuring with AI', 'Almost done'];

const ACCEPTED_RESUME_EXTENSIONS = ['.pdf', '.docx'] as const;
const ACCEPTED_RESUME_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

function isAcceptedResumeFile(file: File): boolean {
  const name = file.name.toLowerCase();
  if (ACCEPTED_RESUME_EXTENSIONS.some((ext) => name.endsWith(ext))) return true;
  return ACCEPTED_RESUME_MIME_TYPES.includes(
    file.type as (typeof ACCEPTED_RESUME_MIME_TYPES)[number],
  );
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function formatDisplayName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function truncateFilename(filename: string, max = 42): string {
  if (filename.length <= max) return filename;
  const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '';
  const base = filename.slice(0, filename.length - ext.length);
  const keep = max - ext.length - 1;
  return `${base.slice(0, keep)}…${ext}`;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function isLoggedIn(): boolean {
  return typeof window !== 'undefined' && !!localStorage.getItem('token');
}

function formatApiError(err: unknown): string {
  const message = err instanceof Error ? err.message : 'Something went wrong';
  const status = (err as { status?: number })?.status;
  if (status === 429) {
    return message.includes('Daily')
      ? message
      : 'Too many requests. Please wait a moment and try again.';
  }
  return message;
}

export interface GuestResumeUploadProps {
  variant?: 'section' | 'inline';
}

export default function GuestResumeUpload({ variant = 'section' }: GuestResumeUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [processStep, setProcessStep] = useState(0);
  const [preview, setPreview] = useState<GuestProfilePreview | null>(null);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchPreview = useCallback(async (id: number, token: string) => {
    try {
      const data = await publicApi.getGuestPreview(id, token);
      setPreview(data);
      setPhase('ready');
    } catch {
      setPhase('expired');
      clearGuestProfileSession();
    }
  }, []);

  const pollStatus = useCallback(
    (id: number, token: string) => {
      stopPolling();
      const tick = async () => {
        try {
          const status = await publicApi.getGuestStatus(id, token);
          if (status.status === 'READY') {
            await fetchPreview(id, token);
            return;
          }
          if (status.status === 'FAILED') {
            setPhase('failed');
            setError('We could not parse this resume. Try a different PDF/DOCX or a simpler layout.');
            return;
          }
          pollRef.current = setTimeout(tick, 3000);
        } catch {
          setPhase('expired');
          clearGuestProfileSession();
        }
      };
      pollRef.current = setTimeout(tick, 1500);
    },
    [fetchPreview, stopPolling],
  );

  useEffect(() => {
    setMounted(true);
    const session = loadGuestProfileSession();
    if (!session || isLoggedIn()) return;
    setProfileId(session.profileId);
    setGuestToken(session.guestToken);
    setPhase('processing');
    pollStatus(session.profileId, session.guestToken);
    return stopPolling;
  }, [pollStatus, stopPolling]);

  useEffect(() => {
    if (phase !== 'processing') return;
    const interval = setInterval(() => {
      setProcessStep((s) => (s + 1) % PROCESS_STEPS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [phase]);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (!isAcceptedResumeFile(file)) {
      setError('Please upload a PDF or DOCX resume file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB.');
      return;
    }

    setError('');
    setPreview(null);
    setPhase('uploading');

    try {
      if (isLoggedIn()) {
        const res = await profilesApi.upload(file);
        router.push(`/dashboard/profiles/${res.data.profile_id}`);
        return;
      }

      const res = await publicApi.uploadProfile(file);
      const session = guestSessionFromUpload(
        res.profile_id,
        res.guest_token,
        res.expires_in_hours,
      );
      saveGuestProfileSession(session);
      setProfileId(res.profile_id);
      setGuestToken(res.guest_token);
      setExtractedText(res.extracted_text || '');
      setPhase('processing');
      pollStatus(res.profile_id, res.guest_token);
    } catch (err) {
      setPhase('failed');
      setError(formatApiError(err));
    }
  };

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setSigningIn(false);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const handleSignIn = async () => {
    if (signingIn) return;
    setSigningIn(true);
    setError('');
    stopPolling();

    const token = guestToken || loadGuestProfileSession()?.guestToken;
    const timeout = window.setTimeout(() => {
      setSigningIn(false);
      setError('Sign-in timed out. Please try again.');
    }, 15000);

    try {
      const ref = sessionStorage.getItem('signup_referral_code') || undefined;
      const res = await authApi.getGoogleLoginUrl(ref, token || undefined);
      const url = res.data?.url;
      if (!url?.startsWith('https://accounts.google.com/')) {
        throw new Error('Invalid OAuth URL');
      }
      window.location.assign(url);
    } catch {
      window.clearTimeout(timeout);
      setSigningIn(false);
      setError('Could not connect to Google. Please try again.');
    }
  };

  const handleRetry = () => {
    stopPolling();
    clearGuestProfileSession();
    setPhase('idle');
    setError('');
    setPreview(null);
    setProfileId(null);
    setGuestToken(null);
    setExtractedText('');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const snippet =
    extractedText.trim().slice(0, 280) + (extractedText.length > 280 ? '…' : '');

  const showSectionChrome = mounted && variant === 'section' && phase === 'idle';

  return (
    <div className={`guest-upload${variant === 'section' ? ' guest-upload--section' : ''}${phase === 'ready' ? ' guest-upload--ready' : ''}`}>
      {error && (
        <div className="guest-upload-error">{error}</div>
      )}

      {showSectionChrome && (
        <div className="guest-upload-steps" aria-label="How it works">
          <div className="guest-upload-step guest-upload-step--active">
            <span className="guest-upload-step-dot">1</span>
            <span>Upload</span>
          </div>
          <div className="guest-upload-step-line" aria-hidden />
          <div className="guest-upload-step">
            <span className="guest-upload-step-dot">2</span>
            <span>Sign in</span>
          </div>
          <div className="guest-upload-step-line" aria-hidden />
          <div className="guest-upload-step">
            <span className="guest-upload-step-dot">3</span>
            <span>Tailor</span>
          </div>
        </div>
      )}

      {(phase === 'idle' || phase === 'failed' || phase === 'expired') && (
        <div
          className={`guest-upload-zone ${dragOver ? 'dragover' : ''}${showSectionChrome ? ' guest-upload-zone--rich' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files?.[0]) handleFile(e.target.files[0]);
            }}
            style={{ display: 'none' }}
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          />
          {showSectionChrome && (
            <div className="guest-upload-deco" aria-hidden>
              <div className="guest-upload-deco-page">
                <div className="guest-upload-deco-line guest-upload-deco-line--title" />
                <div className="guest-upload-deco-line" style={{ width: '62%' }} />
                <div className="guest-upload-deco-line" style={{ width: '88%' }} />
                <div className="guest-upload-deco-line" style={{ width: '74%' }} />
                <div className="guest-upload-deco-line" style={{ width: '52%' }} />
              </div>
            </div>
          )}
          <div className="guest-upload-zone-inner">
            <div className="guest-upload-icon" aria-hidden>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <polyline points="9 15 12 12 15 15" />
              </svg>
            </div>
            <h3 className="guest-upload-title">
              {phase === 'expired' ? 'Session expired' : 'Drop your resume here'}
            </h3>
            <p className="guest-upload-sub">
              {phase === 'expired'
                ? 'Upload again — no signup needed'
                : phase === 'failed'
                  ? 'Try another file'
                  : 'Drag and drop or click to browse'}
            </p>
            {phase === 'idle' && (
              <>
                {showSectionChrome && (
                  <span className="guest-upload-browse">Browse files</span>
                )}
                <div className="guest-upload-formats" aria-label="Supported file formats">
                  <span className="guest-upload-format">PDF</span>
                  <span className="guest-upload-format">DOCX</span>
                </div>
              </>
            )}
            {phase === 'idle' && (
              <span className="guest-upload-limit">Max 5 MB · No account needed</span>
            )}
          </div>
          {(phase === 'failed' || phase === 'expired') && (
            <button
              type="button"
              className="guest-upload-retry"
              onClick={(e) => {
                e.stopPropagation();
                handleRetry();
              }}
            >
              Upload again
            </button>
          )}
        </div>
      )}

      {showSectionChrome && (
        <div className="guest-upload-extract" aria-hidden>
          <span className="guest-upload-extract-label">We extract in seconds</span>
          <div className="guest-upload-extract-chips">
            <span>Experience</span>
            <span>Skills</span>
            <span>Education</span>
            <span>Projects</span>
          </div>
        </div>
      )}

      {phase === 'uploading' && (
        <div className="guest-upload-state">
          <div className="spinner spinner-lg" />
          <p className="guest-upload-state-title">Uploading your resume…</p>
        </div>
      )}

      {phase === 'processing' && (
        <div className="guest-upload-state">
          <div className="spinner spinner-lg" />
          <p className="guest-upload-state-title">{PROCESS_STEPS[processStep]}</p>
          {snippet && (
            <div className="guest-upload-snippet">
              <span className="guest-upload-snippet-label">Reading</span>
              <p>{snippet}</p>
            </div>
          )}
        </div>
      )}

      {phase === 'ready' && preview && (
        <div className={`guest-success${signingIn ? ' guest-success--signing' : ''}`}>
          {signingIn && (
            <div className="guest-success-overlay" aria-live="polite">
              <div className="guest-success-overlay-inner">
                <div className="spinner" style={{ width: 20, height: 20 }} />
                <p className="guest-success-overlay-title">Connecting to Google…</p>
                <span className="guest-success-overlay-sub">Your resume is saved</span>
              </div>
            </div>
          )}

          <div className="guest-success-steps" aria-label="Progress">
            <div className="guest-success-step guest-success-step--done">
              <span className="guest-success-step-dot">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
              </span>
              <span>Upload</span>
            </div>
            <div className="guest-success-step-line guest-success-step-line--done" />
            <div className="guest-success-step guest-success-step--active">
              <span className="guest-success-step-dot">2</span>
              <span>Sign in</span>
            </div>
            <div className="guest-success-step-line" />
            <div className="guest-success-step">
              <span className="guest-success-step-dot">3</span>
              <span>Tailor</span>
            </div>
          </div>

          <div className="guest-success-hero">
            <div className="guest-success-ring" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h3 className="guest-success-title">Resume ready to tailor</h3>
              <p className="guest-success-subtitle">Experience, skills &amp; history parsed</p>
            </div>
          </div>

          <div className="guest-success-card">
            <div className="guest-success-card-inner">
              <div className="guest-success-profile">
                <div className="guest-success-avatar">{getInitials(preview.name || 'You')}</div>
                <div className="guest-success-identity">
                  <h4>{formatDisplayName(preview.name || 'Your resume')}</h4>
                  {preview.title && <p className="guest-success-role">{preview.title}</p>}
                </div>
              </div>
              <div className="guest-success-stats">
                <span className="guest-success-stat">
                  <strong>{preview.experience_count}</strong>
                  {preview.experience_count === 1 ? ' Role' : ' Roles'}
                </span>
                <span className="guest-success-stat">
                  <strong>{preview.skills_count}</strong>
                  {preview.skills_count === 1 ? ' Skill' : ' Skills'}
                </span>
              </div>
              {preview.source_filename && (
                <div className="guest-success-file">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                  </svg>
                  <span title={preview.source_filename}>{truncateFilename(preview.source_filename, 36)}</span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className="guest-success-google-btn"
            onClick={handleSignIn}
            disabled={signingIn}
          >
            <GoogleIcon />
            <span className="guest-success-google-btn-label">
              {signingIn ? 'Redirecting…' : 'Continue with Google'}
            </span>
            {!signingIn && (
              <svg className="guest-success-google-btn-arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          <div className="guest-success-trust">
            <span>🔒 Encrypted</span>
            <span className="guest-success-trust-dot" />
            <span>3 free/day</span>
            <span className="guest-success-trust-dot" />
            <span>No card</span>
          </div>
        </div>
      )}

      {phase === 'idle' && (
        showSectionChrome ? (
          <div className="guest-upload-trust">
            <span>🔒 Encrypted</span>
            <span className="guest-upload-trust-dot" />
            <span>⚡ 3 free/day</span>
            <span className="guest-upload-trust-dot" />
            <span>No card needed</span>
          </div>
        ) : variant !== 'section' ? (
          <p className="guest-upload-footer">
            No account needed to start · Unclaimed uploads removed after 72h
          </p>
        ) : null
      )}
    </div>
  );
}
