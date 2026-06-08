import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Player } from '@magellanwars/shared';

interface AuthState {
  token: string | null;
  player: Player | null;
  login: (token: string, player: Player) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      player: null,
      login: (token, player) => set({ token, player }),
      logout: () => set({ token: null, player: null }),
    }),
    { name: 'magellanwars-auth' },
  ),
);
