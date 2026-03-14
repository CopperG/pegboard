import { create } from 'zustand'
import type { ConnectionStore } from '@/types/store'

export const useConnectionStore = create<ConnectionStore>()((set) => ({
  status: 'disconnected',
  lastPingAt: null,
  reconnectAttempts: 0,
  nextReconnectIn: null,

  setStatus: (status) => set({ status }),
  setLastPingAt: (time) => set({ lastPingAt: time }),
  incrementReconnectAttempts: () =>
    set((s) => ({ reconnectAttempts: s.reconnectAttempts + 1 })),
  resetReconnectAttempts: () => set({ reconnectAttempts: 0, nextReconnectIn: null }),
  setNextReconnectIn: (ms) => set({ nextReconnectIn: ms }),
}))
