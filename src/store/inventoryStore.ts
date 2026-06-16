/**
 * 공통 인벤토리 (직업 무관 공유) — localStorage 영속화.
 * 셸 단계: 비어 있는 stub. 추후 BuiltItem 보관함으로 확장.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface InventoryState {
  // 추후: items: BuiltItem[]
  items: unknown[]
  clear: () => void
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set) => ({
      items: [],
      clear: () => set({ items: [] }),
    }),
    { name: 'mlsv2:inventory' },
  ),
)
