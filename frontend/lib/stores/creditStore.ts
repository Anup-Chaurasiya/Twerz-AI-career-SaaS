import { create } from 'zustand';
import { CreditBalance } from '@/types';
import { creditsApi } from '@/lib/api/endpoints';

interface CreditState {
  balance: CreditBalance | null;
  isLoading: boolean;
  fetchBalance: () => Promise<void>;
  setBalance: (balance: CreditBalance) => void;
}

let fetchBalanceInFlight: Promise<void> | null = null;

export const useCreditStore = create<CreditState>((set, get) => ({
  balance: null,
  isLoading: false,
  fetchBalance: async () => {
    if (fetchBalanceInFlight) return fetchBalanceInFlight;

    fetchBalanceInFlight = (async () => {
      set({ isLoading: true });
      try {
        const res = await creditsApi.getBalance();
        set({ balance: res.data, isLoading: false });
      } catch {
        set({ balance: get().balance, isLoading: false });
      }
    })();

    try {
      await fetchBalanceInFlight;
    } finally {
      fetchBalanceInFlight = null;
    }
  },
  setBalance: (balance: CreditBalance) => set({ balance }),
}));
