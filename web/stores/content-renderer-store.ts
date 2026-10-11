import { create } from 'zustand'
import type { CollectionRenderer } from '../types/api'
import type {
  HtmlRenderer,
  HtmlSettings,
} from '../pages/content/content-html-mapping'

type RendererEdit = {
  renderer: HtmlRenderer
  settings: HtmlSettings
  error: string
  dirty: boolean
}

type ContentRendererDraft = {
  saved: CollectionRenderer | null
  renderer: HtmlRenderer | null
  settings: HtmlSettings
  error: string
  conflict: boolean
  unconfirmed: boolean
  dirty: boolean
  epoch: number
  review: (
    saved: CollectionRenderer,
    settings: HtmlSettings,
    epoch: number,
  ) => void
  edit: (prepared: RendererEdit, epoch: number) => void
  markConflict: (epoch: number) => void
  markUnconfirmed: (epoch: number) => void
  reset: () => void
}

export const useContentRendererDraft = create<ContentRendererDraft>((set) => ({
  saved: null,
  renderer: null,
  settings: {},
  error: '',
  conflict: false,
  unconfirmed: false,
  dirty: false,
  epoch: 0,
  review(saved, settings, epoch) {
    set((current) =>
      current.epoch === epoch
        ? {
            saved: structuredClone(saved),
            renderer: structuredClone(saved.renderer),
            settings: structuredClone(settings),
            error: '',
            conflict: false,
            unconfirmed: false,
            dirty: false,
          }
        : current,
    )
  },
  edit(prepared, epoch) {
    set((current) => {
      if (current.epoch !== epoch || !current.saved || !current.renderer)
        return current

      return {
        renderer: structuredClone(prepared.renderer),
        settings: structuredClone(prepared.settings),
        error: prepared.error,
        dirty: prepared.dirty,
      }
    })
  },
  markConflict(epoch) {
    set((current) => (current.epoch === epoch ? { conflict: true } : current))
  },
  markUnconfirmed(epoch) {
    set((current) =>
      current.epoch === epoch ? { unconfirmed: true } : current,
    )
  },
  reset() {
    set((current) => ({
      saved: null,
      renderer: null,
      settings: {},
      error: '',
      conflict: false,
      unconfirmed: false,
      dirty: false,
      epoch: current.epoch + 1,
    }))
  },
}))
