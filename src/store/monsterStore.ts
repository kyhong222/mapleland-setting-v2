/**
 * 선택된 대상 몬스터 (Zustand + localStorage 영속화).
 * 데미지·명중·회피 계산의 대상이 된다.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface MonsterState {
  /** 선택된 몬스터 id (없으면 null) */
  selectedId: number | null
  select: (id: number | null) => void
}

export const useMonsterStore = create<MonsterState>()(
  persist(
    (set) => ({
      selectedId: null,
      select: (id) => set({ selectedId: id }),
    }),
    { name: 'mlsv2:monster' },
  ),
)
