import type { GuestProfileSession } from '@/types';

export const GUEST_PROFILE_STORAGE_KEY = 'guest_profile';

export function loadGuestProfileSession(): GuestProfileSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(GUEST_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestProfileSession;
    if (!parsed?.profileId || !parsed?.guestToken) return null;
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem(GUEST_PROFILE_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveGuestProfileSession(session: GuestProfileSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GUEST_PROFILE_STORAGE_KEY, JSON.stringify(session));
}

export function clearGuestProfileSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(GUEST_PROFILE_STORAGE_KEY);
}

export function guestSessionFromUpload(
  profileId: number,
  guestToken: string,
  expiresInHours: number,
): GuestProfileSession {
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();
  return { profileId, guestToken, expiresAt };
}

export type GuestClaimErrorCode = 'expired' | 'already_claimed' | 'invalid';

export function normalizeGuestClaimError(value: string | null | undefined): GuestClaimErrorCode | null {
  if (!value) return null;
  if (value === 'expired' || value === 'already_claimed' || value === 'invalid') {
    return value;
  }
  return 'invalid';
}

export function guestClaimErrorMessage(code: GuestClaimErrorCode): string {
  switch (code) {
    case 'expired':
      return 'Your guest upload session expired. Please upload your resume again.';
    case 'already_claimed':
      return 'This resume was already linked to another account. Upload it again after signing in.';
    case 'invalid':
    default:
      return 'We could not save your uploaded resume to your account. Please upload it again from the dashboard.';
  }
}

export function guestClaimErrorFromApiDetail(detail: unknown): GuestClaimErrorCode {
  const message = typeof detail === 'string' ? detail.toLowerCase() : '';
  if (message.includes('guest_token_expired') || message.includes('expired')) {
    return 'expired';
  }
  if (message.includes('already been claimed') || message.includes('already_claimed')) {
    return 'already_claimed';
  }
  return 'invalid';
}
