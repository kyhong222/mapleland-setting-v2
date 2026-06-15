/**
 * 아이템 등급 도메인.
 *
 * 정옵(기본옵션) 대비 가감된 수치(주문서+보석+수치조정)의 합으로 등급이 정해진다.
 *
 * 점수 = Σ delta(공격력·마력·STR·DEX·INT·LUK·물방·마방·명중·회피) + 체력delta/10 + 마나delta/10
 *  (이동속도·점프 등은 점수에 포함되지 않음)
 *
 * 등급 구간:
 *   ≤ -1   회색
 *   0~5    흰색(노작) / 주황(작)  ← 주문서 사용 여부로 구분
 *   6~22   파랑
 *   23~39  보라
 *   40~54  노랑
 *   55~69  초록
 *   ≥ 70   빨강
 */

import type { EffectId, EffectMap } from './effects'

export type ItemGrade =
  | 'gray'
  | 'white'
  | 'orange'
  | 'blue'
  | 'purple'
  | 'yellow'
  | 'green'
  | 'red'

export interface GradeInfo {
  id: ItemGrade
  /** 한글 표기 */
  label: string
  /** 표시 색상(hex) */
  color: string
}

export const GRADES: Record<ItemGrade, GradeInfo> = {
  gray: { id: 'gray', label: '회색', color: '#9e9e9e' },
  white: { id: 'white', label: '흰색', color: '#e0e0e0' },
  orange: { id: 'orange', label: '주황', color: '#ff9800' },
  blue: { id: 'blue', label: '파랑', color: '#2196f3' },
  purple: { id: 'purple', label: '보라', color: '#9c27b0' },
  yellow: { id: 'yellow', label: '노랑', color: '#ffd600' },
  green: { id: 'green', label: '초록', color: '#4caf50' },
  red: { id: 'red', label: '빨강', color: '#f44336' },
}

/** 등급 점수에 반영되는 스탯별 가중치 (목록에 없는 스탯은 0) */
export const GRADE_WEIGHTS: Partial<Record<EffectId, number>> = {
  pad: 1,
  mad: 1,
  STR: 1,
  DEX: 1,
  INT: 1,
  LUK: 1,
  pdef: 1,
  mdef: 1,
  add: 1,
  eva: 1,
  hp: 0.1, // 체력/10
  mp: 0.1, // 마나/10
}

/**
 * 정옵 대비 가감분(delta) EffectMap → 등급 점수.
 * delta는 (최종 효과 − 기본옵션) = 주문서+보석+수치조정의 합과 동일하다.
 */
export function gradeScore(delta: EffectMap): number {
  let sum = 0
  for (const key of Object.keys(GRADE_WEIGHTS) as EffectId[]) {
    const w = GRADE_WEIGHTS[key] ?? 0
    sum += (delta[key] ?? 0) * w
  }
  return sum
}

/**
 * 점수 + 주문서 사용 여부 → 등급.
 * 0~5 구간에서만 주문서 사용 여부로 흰색(노작)/주황(작)이 갈린다.
 */
export function gradeFromScore(score: number, scrollsUsed: boolean): ItemGrade {
  if (score <= -1) return 'gray'
  if (score < 6) return scrollsUsed ? 'orange' : 'white'
  if (score < 23) return 'blue'
  if (score < 40) return 'purple'
  if (score < 55) return 'yellow'
  if (score < 70) return 'green'
  return 'red'
}

export interface GradeResult {
  score: number
  grade: ItemGrade
  info: GradeInfo
}

/** delta + 주문서 사용 여부 → 점수/등급 종합 */
export function computeGrade(
  delta: EffectMap,
  scrollsUsed: boolean,
): GradeResult {
  const score = gradeScore(delta)
  const grade = gradeFromScore(score, scrollsUsed)
  return { score, grade, info: GRADES[grade] }
}
