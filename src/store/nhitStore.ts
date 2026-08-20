/**
 * n방컷 섹션의 스킬 선택 상태 — localStorage 영속화 + 저장슬롯에 동행.
 * 패널 로컬 state였을 때는 슬롯을 불러와도 선택이 남아 있어 다른 빌드의 스킬이 그대로 보였다.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
  preCast: { id: number; level: number }[]
}

interface NhitState {
  skillId: number | ''
  skillLevel: number
  preCast: PreCastEntry[]
  setSkill: (id: number | '', level: number) => void
  setSkillLevel: (level: number) => void
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

const EMPTY: NhitSelection = { skillId: '', skillLevel: 1, preCast: [] }

export const useNhitStore = create<NhitState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      preCast: [] as PreCastEntry[],
      setSkill: (id, level) => set({ skillId: id, skillLevel: level }),
      setSkillLevel: (level) => set({ skillLevel: level }),
      addPreCast: (id, level) => set((s) => ({ preCast: [...s.preCast, { uid: nextUid(), id, level }] })),
      setPreCastLevel: (uid, level) =>
        set((s) => ({ preCast: s.preCast.map((p) => (p.uid === uid ? { ...p, level } : p)) })),
      removePreCast: (uid) => set((s) => ({ preCast: s.preCast.filter((p) => p.uid !== uid) })),
      capture: () => {
        const { skillId, skillLevel, preCast } = get()
        return { skillId, skillLevel, preCast: preCast.map(({ id, level }) => ({ id, level })) }
      },
      restore: (sel) => {
        const s = sel ?? EMPTY
        set({
          skillId: s.skillId,
          skillLevel: s.skillLevel,
          preCast: (s.preCast ?? []).map((p) => ({ uid: nextUid(), id: p.id, level: p.level })),
        })
      },
      reset: () => set({ ...EMPTY, preCast: [] }),
    }),
    {
      name: 'mlsv2:nhit',
      // 영속 복원 시 uid 시퀀스를 현재 최댓값 뒤로 밀어 충돌 방지
      onRehydrateStorage: () => (state) => {
        if (state?.preCast?.length) uidSeq = Math.max(uidSeq, ...state.preCast.map((p) => p.uid ?? 0))
      },
    },
  ),
)
