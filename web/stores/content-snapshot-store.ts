import { create } from 'zustand'

type ContentSnapshotState = {
  unconfirmed: Record<string, true>
  markUnconfirmed: (scope: string) => void
}

// Memory-only owner/session latch survives local preview resets, not a browser restart.
export const useContentSnapshot = create<ContentSnapshotState>((set) => ({
  unconfirmed: {},
  markUnconfirmed(scope) {
    set((current) => ({
      unconfirmed: { ...current.unconfirmed, [scope]: true },
    }))
  },
}))
