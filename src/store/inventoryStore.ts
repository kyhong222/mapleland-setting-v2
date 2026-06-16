/**
 * 공통 인벤토리 (직업 무관 공유) — localStorage 영속화.
 * 제작한 BuiltItem을 리스트로 보관한다.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BuiltItem } from '../domain/builtItem'

interface InventoryState {
  items: BuiltItem[]
  add: (item: BuiltItem) => void
  updateAt: (index: number, item: BuiltItem) => void
  removeAt: (index: number) => void
  clear: () => void
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) => set((s) => ({ items: [...s.items, item] })),
      updateAt: (index, item) =>
        set((s) => ({ items: s.items.map((it, i) => (i === index ? item : it)) })),
      removeAt: (index) => set((s) => ({ items: s.items.filter((_, i) => i !== index) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'mlsv2:inventory' },
  ),
)
