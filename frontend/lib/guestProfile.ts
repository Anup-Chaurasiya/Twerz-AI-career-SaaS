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
