import { create } from 'zustand'

/** Lifecycle of the app-managed claude-bridge child process. */
export type BridgeStatus = 'stopped' | 'starting' | 'running' | 'error'

interface BridgeStore {
  status: BridgeStatus
  setStatus: (status: BridgeStatus) => void
}

export const useBridgeStore = create<BridgeStore>((set) => ({
  status: 'stopped',
  setStatus: (status) => set({ status }),
}))
