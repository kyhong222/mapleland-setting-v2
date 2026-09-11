/**
 * 저장 슬롯 (전 직업 공용 24칸) — localStorage 영속화.
 * 각 슬롯은 빌드 스냅샷(직업 포함)을 보관한다.
 *
 * 한 계정당 캐릭터가 최대 6개라 6칸(SLOT_GROUP_SIZE)을 한 묶음으로 보고 4묶음 = 24칸을 둔다.
 * SlotManager가 이 묶음 단위로 UI를 감싼다. 칸 수를 늘려도 아래 merge가 기존 저장분을
 * 앞 인덱스부터 그대로 이어받으므로 저장된 빌드는 유지된다.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BuildSnapshot } from './buildStore'

/** 한 묶음(=한 계정)당 슬롯 수 */
export const SLOT_GROUP_SIZE = 6
/** 전체 슬롯 수 — 묶음 4개 */
export const SLOT_COUNT = SLOT_GROUP_SIZE * 4

export interface SavedSlot {
  snapshot: BuildSnapshot
  savedAt: number
  /** 사용자가 붙인 구분용 이름. 없으면 UI가 '슬롯 N'으로 표시한다 */
  name?: string
}

interface SlotsState {
  slots: (SavedSlot | null)[]
  /** name을 넘기지 않으면 기존 이름이 지워진다 — 덮어쓰기는 호출부가 기존 name을 넘길 것 */
  save: (index: number, snapshot: BuildSnapshot, name?: string) => void
  clear: (index: number) => void
  /** 구분용 이름 변경. 빈 문자열/공백이면 이름을 지워 '슬롯 N' 표시로 되돌린다 */
  rename: (index: number, name: string) => void
}

const emptySlots = (): (SavedSlot | null)[] => Array.from({ length: SLOT_COUNT }, () => null)

export const useSlotsStore = create<SlotsState>()(
  persist(
    (set) => ({
      slots: emptySlots(),
      save: (index, snapshot, name) =>
        set((s) => {
          const slots = s.slots.slice()
          slots[index] = { snapshot, savedAt: Date.now(), name }
          return { slots }
        }),
      clear: (index) =>
        set((s) => {
          const slots = s.slots.slice()
          slots[index] = null
          return { slots }
        }),
      rename: (index, name) =>
        set((s) => {
          const slot = s.slots[index]
          if (!slot) return s
          const trimmed = name.trim()
          const slots = s.slots.slice()
          slots[index] = { ...slot, name: trimmed || undefined }
          return { slots }
        }),
    }),
    {
      name: 'mlsv2:slots',
      // 슬롯 개수 변경/손상 대비 보정
      merge: (persisted, current) => {
        const p = persisted as Partial<SlotsState> | undefined
        const base = emptySlots()
        const saved = p?.slots ?? []
        for (let i = 0; i < SLOT_COUNT; i++) base[i] = saved[i] ?? null
        return { ...current, slots: base }
      },
    },
  ),
)
