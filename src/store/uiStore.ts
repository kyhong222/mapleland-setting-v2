/**
 * UI 상태 (패널 접힘) — localStorage 영속화.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type PanelId =
  | 'equip'
  | 'inventory'
  | 'monster'
  | 'stat'
  | 'skill'
  | 'attack'
  | 'detail'

interface UiState {
  /** 접힌 패널 (없거나 false = 펼침) */
  folded: Partial<Record<PanelId, boolean>>
  toggle: (id: PanelId) => void
  isFolded: (id: PanelId) => boolean
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      folded: {},
      toggle: (id) =>
        set((s) => ({ folded: { ...s.folded, [id]: !s.folded[id] } })),
      isFolded: (id) => !!get().folded[id],
    }),
    { name: 'mlsv2:ui' },
  ),
)
