import axios from 'axios';
import { create } from 'zustand';
import { User } from '@/types';
import { authApi } from '@/lib/api/endpoints';

interface AuthState {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  fetchMe: (opts?: { force?: boolean }) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

let fetchMeInFlight: Promise<void> | null = null;
let fetchMeRetryTimer: ReturnType<typeof setTimeout> | null = null;

function hasStoredToken(): boolean {
  return typeof window !== 'undefined' && !!localStorage.getItem('token');
}

function scheduleFetchMeRetry(force = true, delayMs = 2500) {
  if (fetchMeRetryTimer) return;
  fetchMeRetryTimer = setTimeout(() => {
    fetchMeRetryTimer = null;
    if (hasStoredToken()) {
      void useAuthStore.getState().fetchMe({ force });
    }
  }, delayMs);
}

async function refreshStoredToken(): Promise<boolean> {
  if (!hasStoredToken()) return false;
  try {
    const res = await authApi.refresh();
    localStorage.setItem('token', res.data.access_token);
    return true;
  } catch {
    return false;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoggedIn: false,
  isLoading: true,
  fetchMe: async (opts) => {
    if (fetchMeInFlight && !opts?.force) return fetchMeInFlight;

    if (!hasStoredToken()) {
      set({ user: null, isLoggedIn: false, isLoading: false });
      return;
    }

    fetchMeInFlight = (async () => {
      try {
        const res = await authApi.getMe();
        if (fetchMeRetryTimer) {
          clearTimeout(fetchMeRetryTimer);
          fetchMeRetryTimer = null;
        }
        set({ user: res.data, isLoggedIn: true, isLoading: false });
      } catch (err) {
        const is401 = axios.isAxiosError(err) && err.response?.status === 401;
        const detail = axios.isAxiosError(err)
          ? (err.response?.data as { detail?: string } | undefined)?.detail
          : undefined;
        const hasToken = hasStoredToken();

        if (is401 && hasToken && detail === 'token_expired') {
          const refreshed = await refreshStoredToken();
          if (refreshed) {
            try {
              const res = await authApi.getMe();
              set({ user: res.data, isLoggedIn: true, isLoading: false });
              return;
            } catch {
              /* fall through */
            }
          }
        }

        if (is401) {
          if (hasToken) localStorage.removeItem('token');
          set({ user: null, isLoggedIn: false, isLoading: false });
          return;
        }

        // Network/timeout/server errors — keep token and stay logged in optimistically.
        const prev = get();
        set({
          user: prev.user,
          isLoggedIn: true,
          isLoading: false,
        });
        scheduleFetchMeRetry(true);
      } finally {
        set((state) => (state.isLoading ? { isLoading: false } : {}));
      }
    })();

    try {
      await fetchMeInFlight;
    } finally {
      fetchMeInFlight = null;
    }
  },
  logout: () => {
    if (fetchMeRetryTimer) {
      clearTimeout(fetchMeRetryTimer);
      fetchMeRetryTimer = null;
    }
    localStorage.removeItem('token');
    set({ user: null, isLoggedIn: false, isLoading: false });
    window.location.href = '/login';
  },
  setUser: (user: User) => set({ user, isLoggedIn: true, isLoading: false }),
}));
