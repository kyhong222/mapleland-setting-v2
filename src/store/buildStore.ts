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
import { STAT_BASE, STAT_IDS, totalAP, minLevelForClass, maxLevelForOrder, statFloors } from '../domain/stats'
import { defaultBuffLevel, effectiveMasterLevel } from '../domain/buff'
import { getBuff } from '../data/buff'
import type { EquipInstance } from './equipInstance'
import type { ChargeElement } from '../domain/paladinCharge'
import type { NhitSelection } from './nhitStore'
import type { InventoryItem } from './inventoryStore'

/** 팔라딘 차지 UI 상태: 메인차지(원소+레벨) + 보조차지(썬더, 레벨) */
export interface ChargeUiState {
  mainOn: boolean
  mainElement: ChargeElement
  mainLevel: number
  subOn: boolean
  subLevel: number
}

export const DEFAULT_CHARGE: ChargeUiState = { mainOn: false, mainElement: 'fire', mainLevel: 30, subOn: false, subLevel: 30 }

export interface BuildSnapshot {
  jobId: JobId
  level: number
  baseStats: BaseStats
  equipped: Partial<Record<EquipInstance, string>>
  /** 활성 버프(토글): 영메·메용 + 직업특화 패시브. buffId → 레벨 */
  activeBuffs: Record<string, number>
  /** 적용된 버프(도핑/개인/파티): buffId → 레벨. 능력치별 최댓값으로 합산 */
  appliedBuffs: Record<string, number>
  /** 무기 마스터리/엑스퍼트 레벨: buffId → 레벨(없으면 마스터). 장착 주무기 일치 시 자동 적용 */
  masteryLevels: Record<string, number>
  /** 팔라딘 차지 (구버전 스냅샷엔 없음) */
  charge?: ChargeUiState
  /** 선택 대상 몬스터 (null = 미선택). 구버전 스냅샷엔 없음 */
  selectedMobId?: number | null
  /** n방컷 스킬 선택 (구버전 스냅샷엔 없음) */
  nhit?: NhitSelection
  /** 개인 인벤토리 — 슬롯을 따라다닌다. 공용 인벤토리는 저장하지 않는다 */
  personalItems?: InventoryItem[]
  /** @deprecated v0 스냅샷 하위호환용 (읽기 전용). appliedBuffs로 마이그레이션됨 */
  commonSlots?: Record<string, string>
  /** @deprecated v0 스냅샷 하위호환용 (읽기 전용). appliedBuffs로 마이그레이션됨 */
  commonLevels?: Record<string, number>
}

export interface BuildState {
  jobId: JobId | null
  level: number
  baseStats: BaseStats
  equipped: Partial<Record<EquipInstance, string>>
  activeBuffs: Record<string, number>
  appliedBuffs: Record<string, number>
  masteryLevels: Record<string, number>
  /** 토글 버프의 레벨 기억 (on/off와 무관하게 유지 — 껐다 켜도 레벨 보존) */
  buffLevels: Record<string, number>
  /** 비활성화한 무기 마스터리 (기본은 무기 장착 시 자동 적용, 여기 있으면 제외) */
  masteryOff: Record<string, boolean>
  /** 팔라딘 차지 (메인/보조) */
  charge: ChargeUiState

  selectJob: (id: JobId) => void
  reset: () => void
  setLevel: (n: number) => void
  /** 능력치 값 설정 (주스탯은 편집금지 — 남은 AP로 자동 재계산) */
  setStat: (stat: StatId, value: number) => void
  equip: (inst: EquipInstance, invId: string) => void
  unequip: (inst: EquipInstance) => void
  unequipByInvId: (invId: string) => void
  /** 버프 on/off 토글 (켤 때 스킬은 마스터레벨, 아이템은 1) */
  toggleBuff: (id: string) => void
  /** 활성 버프의 레벨 조정 (비활성이면 무시) */
  setBuffLevel: (id: string, level: number) => void
  /** 적용된 버프 목록에 추가 (이미 있으면 무시 — 같은 버프 중복 불가) */
  addBuff: (id: string) => void
  /** 적용된 버프 목록에서 제거 */
  removeBuff: (id: string) => void
  /** 적용된 버프의 레벨 조정 (목록에 없으면 무시) */
  setAppliedLevel: (id: string, level: number) => void
  /** 무기 마스터리/엑스퍼트 레벨 조정 */
  setMasteryLevel: (id: string, level: number) => void
  /** 무기 마스터리 on/off 토글 (off면 자동 적용에서 제외) */
  toggleMastery: (id: string) => void
  /** 팔라딘 차지 상태 부분 갱신 */
  setCharge: (patch: Partial<ChargeUiState>) => void
  snapshot: () => BuildSnapshot | null
  loadSnapshot: (snap: BuildSnapshot) => void
}

const baseFour = (): BaseStats => ({ STR: STAT_BASE, DEX: STAT_BASE, INT: STAT_BASE, LUK: STAT_BASE })

/**
 * current 값 기준으로 AP 한도 내 재배분 — 비주스탯=입력값, 주스탯=남은 AP.
 * 직업군 하한(도적·해적 DEX 25)을 먼저 확보한 뒤 나머지를 배분한다.
 * 하한 몫도 AP에서 나가므로 순수 스탯합은 다른 직업과 같다.
 */
function recomputeStats(jobId: JobId, level: number, current: BaseStats): BaseStats {
  const job = JOBS[jobId]
  const ap = totalAP(level, job.order)
  const floors = statFloors(job.classId)
  const next = baseFour()
  let used = 0
  const give = (stat: (typeof STAT_IDS)[number], upTo: number) => {
    const want = Math.max(0, upTo - next[stat])
    const alloc = Math.min(want, Math.max(0, ap - used))
    next[stat] += alloc
    used += alloc
  }
  // 1) 직업 하한 먼저 (주스탯은 어차피 남은 AP를 전부 받으므로 제외)
  for (const stat of STAT_IDS) {
    if (stat === job.primaryStat) continue
    give(stat, floors[stat])
  }
  // 2) 사용자가 지정한 값까지 추가 배분
  for (const stat of STAT_IDS) {
    if (stat === job.primaryStat) continue
    give(stat, Math.floor(current[stat] ?? 0))
  }
  next[job.primaryStat] = STAT_BASE + Math.max(0, ap - used)
  return next
}

/**
 * v0(공통버프 8슬롯) → v1(적용 버프 목록) 마이그레이션.
 * commonSlots에 선택된 buffId들을 commonLevels 레벨과 함께 appliedBuffs로 옮긴다.
 */
function migrateApplied(src: {
  appliedBuffs?: Record<string, number>
  commonSlots?: Record<string, string>
  commonLevels?: Record<string, number>
}): Record<string, number> {
  if (src.appliedBuffs) return { ...src.appliedBuffs }
  const out: Record<string, number> = {}
  const slots = src.commonSlots ?? {}
  const levels = src.commonLevels ?? {}
  for (const id of new Set(Object.values(slots))) {
    if (!id) continue
    const b = getBuff(id)
    out[id] = levels[id] ?? (b ? defaultBuffLevel(b) : 1)
  }
  return out
}

export const useBuildStore = create<BuildState>()(
  persist(
    (set, get) => ({
      jobId: null,
      level: 1,
      baseStats: baseFour(),
      equipped: {},
      activeBuffs: {},
      appliedBuffs: {},
      masteryLevels: {},
      buffLevels: {},
      masteryOff: {},
      charge: DEFAULT_CHARGE,

      selectJob: (id) =>
        set((s) => {
          if (s.jobId !== null) return s
          const level = minLevelForClass(JOBS[id].classId)
          return { jobId: id, level, baseStats: recomputeStats(id, level, baseFour()) }
        }),
      reset: () => set({ jobId: null, level: 1, baseStats: baseFour(), equipped: {}, activeBuffs: {}, appliedBuffs: {}, masteryLevels: {}, buffLevels: {}, masteryOff: {}, charge: DEFAULT_CHARGE }),
      setLevel: (n) =>
        set((s) => {
          const min = s.jobId ? minLevelForClass(JOBS[s.jobId].classId) : 1
          const max = s.jobId ? maxLevelForOrder(JOBS[s.jobId].order) : maxLevelForOrder()
          const level = Math.max(min, Math.min(max, Math.floor(n) || min))
          const baseStats = s.jobId ? recomputeStats(s.jobId, level, s.baseStats) : s.baseStats
          return { level, baseStats }
        }),
      setStat: (stat, value) =>
        set((s) => {
          if (!s.jobId) return s
          if (stat === JOBS[s.jobId].primaryStat) return s
          const min = statFloors(JOBS[s.jobId].classId)[stat]
          const draft = { ...s.baseStats, [stat]: Math.max(min, Math.floor(value) || min) }
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
      toggleBuff: (id) =>
        set((s) => {
          const active = { ...s.activeBuffs }
          const levels = { ...s.buffLevels }
          if (id in active) {
            levels[id] = active[id] // 끄기 전 레벨 기억
            delete active[id]
          } else {
            const b = getBuff(id)
            // 배타 그룹(트랜스폼/슈퍼트랜스폼): 같은 그룹의 다른 활성 버프를 끈다
            const group = b && b.type === 'skill' ? b.exclusiveGroup : undefined
            if (group) {
              for (const other of Object.keys(active)) {
                const ob = getBuff(other)
                if (ob && ob.type === 'skill' && ob.exclusiveGroup === group) {
                  levels[other] = active[other]
                  delete active[other]
                }
              }
            }
            const eff = b ? effectiveMasterLevel(b, s.jobId) : 1
            active[id] = Math.min(levels[id] ?? (b ? defaultBuffLevel(b, s.jobId) : 1), eff) // 기억된 레벨 복원(직업 상한 클램프)
          }
          return { activeBuffs: active, buffLevels: levels }
        }),
      setBuffLevel: (id, level) =>
        set((s) => {
          const b = getBuff(id)
          const max = b ? effectiveMasterLevel(b, s.jobId) : 1
          const n = Math.floor(level)
          const lv = Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0))
          const levels = { ...s.buffLevels, [id]: lv }
          const active = id in s.activeBuffs ? { ...s.activeBuffs, [id]: lv } : s.activeBuffs
          return { buffLevels: levels, activeBuffs: active }
        }),
      addBuff: (id) =>
        set((s) => {
          if (id in s.appliedBuffs) return s
          const b = getBuff(id)
          if (!b) return s
          return { appliedBuffs: { ...s.appliedBuffs, [id]: defaultBuffLevel(b, s.jobId) } }
        }),
      removeBuff: (id) =>
        set((s) => {
          if (!(id in s.appliedBuffs)) return s
          const next = { ...s.appliedBuffs }
          delete next[id]
          return { appliedBuffs: next }
        }),
      setAppliedLevel: (id, level) =>
        set((s) => {
          if (!(id in s.appliedBuffs)) return s
          const b = getBuff(id)
          const max = b ? effectiveMasterLevel(b, s.jobId) : 1
          const lv = Math.max(1, Math.min(max, Math.floor(level) || 1))
          return { appliedBuffs: { ...s.appliedBuffs, [id]: lv } }
        }),
      setMasteryLevel: (id, level) =>
        set((s) => {
          const b = getBuff(id)
          const max = b ? effectiveMasterLevel(b, s.jobId) : 1
          const lv = Math.max(1, Math.min(max, Math.floor(level) || 1))
          return { masteryLevels: { ...s.masteryLevels, [id]: lv } }
        }),
      toggleMastery: (id) =>
        set((s) => {
          const next = { ...s.masteryOff }
          if (next[id]) delete next[id]
          else next[id] = true
          return { masteryOff: next }
        }),
      setCharge: (patch) => set((s) => ({ charge: { ...(s.charge ?? DEFAULT_CHARGE), ...patch } })),
      snapshot: () => {
        const { jobId, level, baseStats, equipped, activeBuffs, appliedBuffs, masteryLevels, charge } = get()
        return jobId === null
          ? null
          : { jobId, level, baseStats, equipped, activeBuffs, appliedBuffs, masteryLevels, charge: charge ?? DEFAULT_CHARGE }
      },
      loadSnapshot: (snap) =>
        set({
          jobId: snap.jobId,
          level: snap.level,
          baseStats: { ...snap.baseStats },
          equipped: { ...snap.equipped },
          activeBuffs: { ...(snap.activeBuffs ?? {}) },
          appliedBuffs: migrateApplied(snap),
          masteryLevels: { ...(snap.masteryLevels ?? {}) },
          buffLevels: { ...(snap.activeBuffs ?? {}) },
          masteryOff: {},
          charge: { ...(snap.charge ?? DEFAULT_CHARGE) },
        }),
    }),
    {
      name: 'mlsv2:build',
      version: 1,
      // v0(공통버프 8슬롯) 영속 상태를 v1(적용 버프 목록)으로 변환
      migrate: (persisted, version) => {
        const state = persisted as Partial<BuildState> & {
          commonSlots?: Record<string, string>
          commonLevels?: Record<string, number>
        }
        if (version < 1 && state) {
          state.appliedBuffs = migrateApplied(state)
          delete state.commonSlots
          delete state.commonLevels
        }
        return state as BuildState
      },
    },
  ),
)
