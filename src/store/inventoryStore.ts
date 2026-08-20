/**
 * 인벤토리 — localStorage 영속화. 제작한 BuiltItem을 안정적 id를 가진 인스턴스로 보관한다.
 * 장비 슬롯은 이 id를 참조한다(인벤토리에서 빠지지 않음).
 *
 * 두 종류로 나뉜다:
 *  - shared(공용)  : 전 저장슬롯이 함께 쓰는 창고. 여기 그대로 남는다.
 *  - personal(개인): 저장슬롯을 따라다닌다. 슬롯을 불러오면 통째로 교체된다.
 * 신규 제작은 개인으로 들어가고, 우클릭 메뉴로 서로 옮길 수 있다.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BuiltItem } from '../domain/builtItem'

export type InventoryOwner = 'shared' | 'personal'

export interface InventoryItem {
  id: string
  built: BuiltItem
  /** 없으면 공용(구버전 데이터 호환) */
  owner?: InventoryOwner
}

/** 소유 구분 (구버전 데이터엔 owner가 없어 공용으로 취급) */
export const ownerOf = (it: InventoryItem): InventoryOwner => it.owner ?? 'shared'

interface InventoryState {
  items: InventoryItem[]
  add: (built: BuiltItem, owner?: InventoryOwner) => void
  update: (id: string, built: BuiltItem) => void
  remove: (id: string) => void
  /** 공용 ↔ 개인 이동 */
  setOwner: (id: string, owner: InventoryOwner) => void
  getById: (id: string) => InventoryItem | undefined
  /** 저장슬롯 불러오기: 개인 인벤토리만 통째로 교체(공용은 유지) */
  replacePersonal: (items: InventoryItem[]) => void
  clear: () => void
}

function newId(): string {
  return `inv_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      items: [],
      // 신규 제작은 개인 인벤토리로
      add: (built, owner = 'personal') => set((s) => ({ items: [...s.items, { id: newId(), built, owner }] })),
      update: (id, built) =>
        set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, built } : it)) })),
      remove: (id) => set((s) => ({ items: s.items.filter((it) => it.id !== id) })),
      setOwner: (id, owner) =>
        set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, owner } : it)) })),
      getById: (id) => get().items.find((it) => it.id === id),
      replacePersonal: (next) =>
        set((s) => ({
          items: [
            ...s.items.filter((it) => ownerOf(it) === 'shared'),
            ...next.map((it) => ({ ...it, owner: 'personal' as const })),
          ],
        })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'mlsv2:inventory',
      version: 1,
      // v0: owner 개념이 없던 시절 → 전부 공용으로 승격
      migrate: (persisted, version) => {
        const s = persisted as Partial<InventoryState> | undefined
        if (version < 1 && s?.items) {
          s.items = s.items.map((it) => ({ ...it, owner: it.owner ?? 'shared' }))
        }
        return s as InventoryState
      },
    },
  ),
)
