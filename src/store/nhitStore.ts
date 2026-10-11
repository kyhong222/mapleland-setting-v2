/**
 * n방컷 섹션의 스킬 선택 상태 — localStorage 영속화 + 저장슬롯에 동행.
 * 패널 로컬 state였을 때는 슬롯을 불러와도 선택이 남아 있어 다른 빌드의 스킬이 그대로 보였다.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { migrateSkillId } from '../data/skills/variants'

/** 추가스킬 1건. 같은 스킬을 여러 번 넣을 수 있어 uid로 구분한다. */
export interface PreCastEntry {
  uid: number
  id: number
  level: number
}

/** 저장슬롯에 실리는 n타 선택 (uid는 불러올 때 다시 매긴다) */
export interface NhitSelection {
  skillId: number | ''
  skillLevel: number
  /**
   * 메인 스킬 계수 직접 입력값 — null이면 스킬북의 레벨별 계수를 쓴다.
   * 물리는 데미지 %, 마법은 기본 공격력(mad). 메랜은 스킬 수치가 자주 바뀌는데 인게임에서만
   * 확인돼 스킬북 반영이 늦으므로, 사용자가 바뀐 값을 바로 넣어볼 수 있게 둔다.
   * 구버전 슬롯엔 없을 수 있다.
   */
  coefOverride?: number | null
  preCast: { id: number; level: number }[]
}

interface NhitState {
  skillId: number | ''
  skillLevel: number
  coefOverride: number | null
  preCast: PreCastEntry[]
  /** 스킬을 바꾸면 계수 직접 입력은 해제된다 (다른 스킬의 계수가 따라오지 않게) */
  setSkill: (id: number | '', level: number) => void
  setSkillLevel: (level: number) => void
  setCoefOverride: (coef: number | null) => void
  addPreCast: (id: number, level: number) => void
  setPreCastLevel: (uid: number, level: number) => void
  removePreCast: (uid: number) => void
  /** 스냅샷 저장용 (uid 제외) */
  capture: () => NhitSelection
  /** 스냅샷 복원 (uid 재발급) */
  restore: (sel: NhitSelection | undefined) => void
  reset: () => void
}

let uidSeq = 0
const nextUid = () => ++uidSeq

const EMPTY: NhitSelection = { skillId: '', skillLevel: 1, coefOverride: null, preCast: [] }

export const useNhitStore = create<NhitState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      preCast: [] as PreCastEntry[],
      coefOverride: null,
      setSkill: (id, level) => set({ skillId: id, skillLevel: level, coefOverride: null }),
      setSkillLevel: (level) => set({ skillLevel: level }),
      setCoefOverride: (coef) => set({ coefOverride: coef }),
      addPreCast: (id, level) => set((s) => ({ preCast: [...s.preCast, { uid: nextUid(), id, level }] })),
      setPreCastLevel: (uid, level) =>
        set((s) => ({ preCast: s.preCast.map((p) => (p.uid === uid ? { ...p, level } : p)) })),
      removePreCast: (uid) => set((s) => ({ preCast: s.preCast.filter((p) => p.uid !== uid) })),
      capture: () => {
        const { skillId, skillLevel, coefOverride, preCast } = get()
        return { skillId, skillLevel, coefOverride, preCast: preCast.map(({ id, level }) => ({ id, level })) }
      },
      restore: (sel) => {
        const s = sel ?? EMPTY
        // 없앤 변형 스킬 id 보정 — 저장슬롯에 남아 있어도 선택이 사라지지 않게
        set({
          skillId: s.skillId === '' ? '' : migrateSkillId(s.skillId),
          skillLevel: s.skillLevel,
          coefOverride: s.coefOverride ?? null,
          preCast: (s.preCast ?? []).map((p) => ({ uid: nextUid(), id: migrateSkillId(p.id), level: p.level })),
        })
      },
      reset: () => set({ ...EMPTY, preCast: [] }),
    }),
    {
      name: 'mlsv2:nhit',
      // 영속 복원 시 uid 시퀀스를 현재 최댓값 뒤로 밀어 충돌 방지 + 없앤 변형 id 보정
      onRehydrateStorage: () => (state) => {
        if (!state) return
        if (state.preCast?.length) {
          uidSeq = Math.max(uidSeq, ...state.preCast.map((p) => p.uid ?? 0))
          state.preCast = state.preCast.map((p) => ({ ...p, id: migrateSkillId(p.id) }))
        }
        if (state.skillId !== '') state.skillId = migrateSkillId(state.skillId)
        state.coefOverride ??= null
      },
    },
  ),
)
