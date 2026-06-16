/**
 * 현재 작업 중인 빌드 (Zustand + localStorage 영속화).
 *
 * 셸 단계: 직업 선택 게이트만. 직업은 한 번 선택하면 변경 불가(리셋으로만 초기화).
 * 패널이 채워질수록 level/baseStats/equipped/skills/monster 등이 추가되며
 * BuildSnapshot도 함께 확장된다.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { JobId } from '../domain/jobs'

/** 저장 슬롯에 보관/복원되는 빌드 스냅샷 (직렬화 형태) */
export interface BuildSnapshot {
  jobId: JobId
  // 추후: level, baseStats, equipped, skills, monster ...
}

export interface BuildState {
  jobId: JobId | null

  /** 직업 선택 (아직 선택 전일 때만 적용) */
  selectJob: (id: JobId) => void
  /** 초기화 (직업 선택 화면으로) */
  reset: () => void
  /** 현재 빌드 스냅샷 (직업 미선택이면 null) */
  snapshot: () => BuildSnapshot | null
  /** 스냅샷으로 현재 빌드 교체 (슬롯 불러오기) */
  loadSnapshot: (snap: BuildSnapshot) => void
}

export const useBuildStore = create<BuildState>()(
  persist(
    (set, get) => ({
      jobId: null,

      selectJob: (id) => set((s) => (s.jobId === null ? { jobId: id } : s)),
      reset: () => set({ jobId: null }),
      snapshot: () => {
        const { jobId } = get()
        return jobId === null ? null : { jobId }
      },
      loadSnapshot: (snap) => set({ jobId: snap.jobId }),
    }),
    { name: 'mlsv2:build' },
  ),
)
