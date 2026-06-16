/**
 * 저장 슬롯 (전 직업 공용 15칸) — localStorage 영속화.
 * 각 슬롯은 빌드 스냅샷(직업 포함)을 보관한다.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BuildSnapshot } from './buildStore'

export const SLOT_COUNT = 15

export interface SavedSlot {
  snapshot: BuildSnapshot
  savedAt: number
  name?: string
}

interface SlotsState {
  slots: (SavedSlot | null)[]
  save: (index: number, snapshot: BuildSnapshot, name?: string) => void
  clear: (index: number) => void
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
