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
let lastBalanceFetchAt = 0;
const BALANCE_CACHE_MS = 30_000;

export const useCreditStore = create<CreditState>((set, get) => ({
  balance: null,
  isLoading: false,
  fetchBalance: async () => {
    if (fetchBalanceInFlight) return fetchBalanceInFlight;
    const now = Date.now();
    if (get().balance && now - lastBalanceFetchAt < BALANCE_CACHE_MS) return;

    fetchBalanceInFlight = (async () => {
      set({ isLoading: true });
      try {
        const res = await creditsApi.getBalance();
        lastBalanceFetchAt = Date.now();
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
  setBalance: (balance: CreditBalance) => {
    lastBalanceFetchAt = Date.now();
    set({ balance });
  },
}));
