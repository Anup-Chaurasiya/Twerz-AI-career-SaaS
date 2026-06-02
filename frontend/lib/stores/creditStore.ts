import { create } from 'zustand';
import { CreditBalance } from '@/types';
import { creditsApi } from '@/lib/api/endpoints';

interface CreditState {
  balance: CreditBalance | null;
  isLoading: boolean;
  fetchBalance: () => Promise<void>;
  setBalance: (balance: CreditBalance) => void;
}

export const useCreditStore = create<CreditState>((set) => ({
  balance: null,
  isLoading: false,
  fetchBalance: async () => {
    set({ isLoading: true });
    try {
      const res = await creditsApi.getBalance();
      set({ balance: res.data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },
  setBalance: (balance: CreditBalance) => set({ balance }),
}));
