/**
 * 현재 작업 중인 빌드 (Zustand + localStorage 영속화).
 *
 * 직업 게이트 + 레벨 + 기본스탯(AP) + 장착(인벤토리 아이템 id 참조).
 * 장착은 인벤토리에서 빠지지 않고 슬롯이 id로 참조한다. 같은 아이템은 한 슬롯에만(중복 제거).
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { JobId } from '../domain/jobs'
import type { BaseStats, StatId } from '../domain/stats'
import type { EquipInstance } from './equipInstance'

/** 저장 슬롯에 보관/복원되는 빌드 스냅샷 */
export interface BuildSnapshot {
  jobId: JobId
  level: number
  baseStats: BaseStats
  /** 슬롯 → 인벤토리 아이템 id */
  equipped: Partial<Record<EquipInstance, string>>
}

export interface BuildState {
  jobId: JobId | null
  level: number
  baseStats: BaseStats
  equipped: Partial<Record<EquipInstance, string>>

  selectJob: (id: JobId) => void
  reset: () => void
  setLevel: (n: number) => void
  setBaseStat: (stat: StatId, value: number) => void
  /** 슬롯에 인벤토리 아이템 장착 (같은 id는 다른 슬롯에서 제거) */
  equip: (inst: EquipInstance, invId: string) => void
  unequip: (inst: EquipInstance) => void
  /** 특정 인벤토리 id가 장착돼 있으면 모두 해제 (인벤 삭제 시) */
  unequipByInvId: (invId: string) => void
  snapshot: () => BuildSnapshot | null
  loadSnapshot: (snap: BuildSnapshot) => void
}

const DEFAULT_BASE_STATS: BaseStats = { STR: 4, DEX: 4, INT: 4, LUK: 4 }

export const useBuildStore = create<BuildState>()(
  persist(
    (set, get) => ({
      jobId: null,
      level: 1,
      baseStats: { ...DEFAULT_BASE_STATS },
      equipped: {},

      selectJob: (id) => set((s) => (s.jobId === null ? { jobId: id } : s)),
      reset: () =>
        set({ jobId: null, level: 1, baseStats: { ...DEFAULT_BASE_STATS }, equipped: {} }),
      setLevel: (n) => set({ level: Math.max(1, Math.min(200, Math.floor(n) || 1)) }),
      setBaseStat: (stat, value) =>
        set((s) => ({
          baseStats: { ...s.baseStats, [stat]: Math.max(0, Math.floor(value) || 0) },
        })),
      equip: (inst, invId) =>
        set((s) => {
          const equipped: Partial<Record<EquipInstance, string>> = {}
          // 같은 아이템 인스턴스를 다른 슬롯에서 제거(1아이템=1슬롯)
          for (const [k, v] of Object.entries(s.equipped) as [EquipInstance, string][]) {
            if (v !== invId) equipped[k] = v
          }
          equipped[inst] = invId
          return { equipped }
        }),
      unequip: (inst) =>
        set((s) => {
          const equipped = { ...s.equipped }
          delete equipped[inst]
          return { equipped }
        }),
      unequipByInvId: (invId) =>
        set((s) => {
          const equipped: Partial<Record<EquipInstance, string>> = {}
          for (const [k, v] of Object.entries(s.equipped) as [EquipInstance, string][]) {
            if (v !== invId) equipped[k] = v
          }
          return { equipped }
        }),
      snapshot: () => {
        const { jobId, level, baseStats, equipped } = get()
        return jobId === null ? null : { jobId, level, baseStats, equipped }
      },
      loadSnapshot: (snap) =>
        set({
          jobId: snap.jobId,
          level: snap.level,
          baseStats: { ...snap.baseStats },
          equipped: { ...snap.equipped },
        }),
    }),
    { name: 'mlsv2:build' },
  ),
)
