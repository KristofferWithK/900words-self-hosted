import { create } from 'zustand'

/**
 * The website demo's own transient state. Never persisted: the demo keeps
 * nothing, and a reload starts over.
 */
interface WebDemoState {
  /** The website Casey's daily budget is spent, or the demo is switched off. */
  resting: boolean
  setResting: () => void
}

export const useWebDemo = create<WebDemoState>((set) => ({
  resting: false,
  setResting: () => set({ resting: true }),
}))
