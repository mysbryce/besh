import { create } from 'zustand'
import type { Collection, StructDraft } from '../types/api'

type CollectionDraft = {
  collection: Collection | null
  name: string
  modelId: string
  reviewed: StructDraft | null
  dirty: boolean
  epoch: number
  editName: (name: string) => void
  chooseModel: (modelId: string) => void
  review: (model: StructDraft) => void
  reset: (collection?: Collection) => void
}

export const useCollectionDraft = create<CollectionDraft>((set) => ({
  collection: null,
  name: '',
  modelId: '',
  reviewed: null,
  dirty: false,
  epoch: 0,
  editName(name) {
    set((current) => ({ name, dirty: !!name || !!current.modelId }))
  },
  chooseModel(modelId) {
    set((current) => ({
      modelId,
      reviewed: null,
      dirty: !!current.name || !!modelId,
      epoch: current.epoch + 1,
    }))
  },
  review(reviewed) {
    set((current) => (current.modelId === reviewed.id ? { reviewed } : current))
  },
  reset(collection) {
    set((current) => ({
      collection: collection ?? null,
      name: '',
      modelId: '',
      reviewed: null,
      dirty: false,
      epoch: current.epoch + 1,
    }))
  },
}))
