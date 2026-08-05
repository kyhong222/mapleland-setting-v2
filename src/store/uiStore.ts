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
  | 'incoming'
  | 'nhit'

interface UiState {
  /** 접힌 패널 (없거나 false = 펼침) */
  folded: Partial<Record<PanelId, boolean>>
  toggle: (id: PanelId) => void
  isFolded: (id: PanelId) => boolean
  /** 장비창에서 호버 중인 아이템의 인벤토리 id (인벤토리 대응 아이템 하이라이트용). 비영속 */
  hoveredEquipInvId: string | null
  setHoveredEquipInvId: (id: string | null) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      folded: {},
      toggle: (id) =>
        set((s) => ({ folded: { ...s.folded, [id]: !s.folded[id] } })),
      isFolded: (id) => !!get().folded[id],
      hoveredEquipInvId: null,
      setHoveredEquipInvId: (id) => set({ hoveredEquipInvId: id }),
    }),
    { name: 'mlsv2:ui', partialize: (s) => ({ folded: s.folded }) },
  ),
)
