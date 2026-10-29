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
  /** '다시 열지 않음'을 누른 공지 id — 시작 시 자동으로 띄우지 않는다 */
  dismissedNotices: string[]
  dismissNotice: (id: string) => void
  /** 한 번이라도 열어본 공지 id — 공지사항 버튼 배지 판정용 */
  seenNotices: string[]
  markNoticeSeen: (id: string) => void
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
      dismissedNotices: [],
      dismissNotice: (id) =>
        set((s) => (s.dismissedNotices.includes(id) ? s : { dismissedNotices: [...s.dismissedNotices, id] })),
      seenNotices: [],
      markNoticeSeen: (id) =>
        set((s) => (s.seenNotices.includes(id) ? s : { seenNotices: [...s.seenNotices, id] })),
    }),
    {
      name: 'mlsv2:ui',
      // 공지 열람 상태는 기기별로만 둔다(클라우드 동기화 대상 아님)
      partialize: (s) => ({ folded: s.folded, dismissedNotices: s.dismissedNotices, seenNotices: s.seenNotices }),
    },
  ),
)
