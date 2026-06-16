/**
 * 현재 작업 중인 빌드 (Zustand + localStorage 영속화).
 *
 * 직업 게이트 + 레벨 + 기본스탯(AP) + 장착(인벤토리 아이템 id 참조).
 *
 * 모험가 AP 정책:
 *  - 레벨: 최소 1(입력 편의), 최대 200
 *  - AP = 4 + 레벨*5 + (≥70:+5) + (≥120:+5)
 *  - 스탯 기본값 4, 주스탯만 편집금지(나머지 자유 편집), 주스탯은 남은 AP 자동 배정
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { JOBS } from '../domain/jobs'
import type { JobId } from '../domain/jobs'
import type { BaseStats, StatId } from '../domain/stats'
import { STAT_BASE, MAX_LEVEL, STAT_IDS, totalAP, minLevelForClass } from '../domain/stats'
import type { EquipInstance } from './equipInstance'

export interface BuildSnapshot {
  jobId: JobId
  level: number
  baseStats: BaseStats
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
  /** 능력치 값 설정 (주스탯은 편집금지 — 남은 AP로 자동 재계산) */
  setStat: (stat: StatId, value: number) => void
  equip: (inst: EquipInstance, invId: string) => void
  unequip: (inst: EquipInstance) => void
  unequipByInvId: (invId: string) => void
  snapshot: () => BuildSnapshot | null
  loadSnapshot: (snap: BuildSnapshot) => void
}

const baseFour = (): BaseStats => ({ STR: STAT_BASE, DEX: STAT_BASE, INT: STAT_BASE, LUK: STAT_BASE })

/** current 값 기준으로 AP 한도 내 재배분 — 비주스탯=입력값, 주스탯=남은 AP */
function recomputeStats(jobId: JobId, level: number, current: BaseStats): BaseStats {
  const job = JOBS[jobId]
  const ap = totalAP(level)
  const next = baseFour()
  let used = 0
  for (const stat of STAT_IDS) {
    if (stat === job.primaryStat) continue
    const desired = Math.max(STAT_BASE, Math.floor(current[stat] ?? STAT_BASE)) - STAT_BASE
    const alloc = Math.min(desired, Math.max(0, ap - used))
    next[stat] = STAT_BASE + alloc
    used += alloc
  }
  next[job.primaryStat] = STAT_BASE + Math.max(0, ap - used)
  return next
}

export const useBuildStore = create<BuildState>()(
  persist(
    (set, get) => ({
      jobId: null,
      level: 1,
      baseStats: baseFour(),
      equipped: {},

      selectJob: (id) =>
        set((s) => {
          if (s.jobId !== null) return s
          const level = minLevelForClass(JOBS[id].classId)
          return { jobId: id, level, baseStats: recomputeStats(id, level, baseFour()) }
        }),
      reset: () => set({ jobId: null, level: 1, baseStats: baseFour(), equipped: {} }),
      setLevel: (n) =>
        set((s) => {
          const min = s.jobId ? minLevelForClass(JOBS[s.jobId].classId) : 1
          const level = Math.max(min, Math.min(MAX_LEVEL, Math.floor(n) || min))
          const baseStats = s.jobId ? recomputeStats(s.jobId, level, s.baseStats) : s.baseStats
          return { level, baseStats }
        }),
      setStat: (stat, value) =>
        set((s) => {
          if (!s.jobId) return s
          if (stat === JOBS[s.jobId].primaryStat) return s
          const draft = { ...s.baseStats, [stat]: Math.max(STAT_BASE, Math.floor(value) || STAT_BASE) }
          return { baseStats: recomputeStats(s.jobId, s.level, draft) }
        }),
      equip: (inst, invId) =>
        set((s) => {
          const equipped: Partial<Record<EquipInstance, string>> = {}
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
