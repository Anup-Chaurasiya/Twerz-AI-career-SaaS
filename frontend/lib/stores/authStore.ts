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

async function refreshStoredToken(): Promise<boolean> {
  if (typeof window === 'undefined' || !localStorage.getItem('token')) return false;
  try {
    const res = await authApi.refresh();
    localStorage.setItem('token', res.data.access_token);
    return true;
  } catch {
    return false;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoggedIn: false,
  isLoading: true,
  fetchMe: async (opts) => {
    if (fetchMeInFlight && !opts?.force) return fetchMeInFlight;

    fetchMeInFlight = (async () => {
      try {
        const res = await authApi.getMe();
        set({ user: res.data, isLoggedIn: true, isLoading: false });
      } catch (err) {
        const is401 = axios.isAxiosError(err) && err.response?.status === 401;
        const detail = axios.isAxiosError(err)
          ? (err.response?.data as { detail?: string } | undefined)?.detail
          : undefined;
        const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('token');

        if (is401 && hasToken && detail === 'token_expired') {
          const refreshed = await refreshStoredToken();
          if (refreshed) {
            try {
              const res = await authApi.getMe();
              set({ user: res.data, isLoggedIn: true, isLoading: false });
              return;
            } catch {
              /* fall through to logout */
            }
          }
        }

        if (is401) {
          if (hasToken) localStorage.removeItem('token');
          set({ user: null, isLoggedIn: false, isLoading: false });
          return;
        }

        // Transient/network errors — keep token so a refresh can recover the session.
        set({ user: null, isLoggedIn: false, isLoading: false });
      }
    })();

    try {
      await fetchMeInFlight;
    } finally {
      fetchMeInFlight = null;
    }
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, isLoggedIn: false, isLoading: false });
    window.location.href = '/login';
  },
  setUser: (user: User) => set({ user, isLoggedIn: true }),
}));
