/**
 * 공통 인벤토리 (직업 무관 공유) — localStorage 영속화.
 * 제작한 BuiltItem을 안정적 id를 가진 인스턴스로 보관한다.
 * 장비 슬롯은 이 id를 참조한다(인벤토리에서 빠지지 않음).
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BuiltItem } from '../domain/builtItem'

export interface InventoryItem {
  id: string
  built: BuiltItem
}

interface InventoryState {
  items: InventoryItem[]
  add: (built: BuiltItem) => void
  update: (id: string, built: BuiltItem) => void
  remove: (id: string) => void
  getById: (id: string) => InventoryItem | undefined
  clear: () => void
}

function newId(): string {
  return `inv_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (built) => set((s) => ({ items: [...s.items, { id: newId(), built }] })),
      update: (id, built) =>
        set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, built } : it)) })),
      remove: (id) => set((s) => ({ items: s.items.filter((it) => it.id !== id) })),
      getById: (id) => get().items.find((it) => it.id === id),
      clear: () => set({ items: [] }),
    }),
    { name: 'mlsv2:inventory' },
  ),
)
