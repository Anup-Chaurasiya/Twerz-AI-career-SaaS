import { create } from 'zustand';
import { User } from '@/types';
import { authApi } from '@/lib/api/endpoints';

interface AuthState {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  fetchMe: () => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoggedIn: false,
  isLoading: true,
  fetchMe: async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      set({ isLoading: false, isLoggedIn: false, user: null });
      return;
    }
    try {
      const res = await authApi.getMe();
      set({ user: res.data, isLoggedIn: true, isLoading: false });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, isLoggedIn: false, isLoading: false });
    }
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, isLoggedIn: false, isLoading: false });
    window.location.href = '/login';
  },
  setUser: (user: User) => set({ user, isLoggedIn: true }),
}));
