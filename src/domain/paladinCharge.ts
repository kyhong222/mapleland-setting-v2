/**
 * 팔라딘 차지 — 속성 부여 & 속성반응 대체. (docs/nhit-dpm.md §4 차지)
 *
 * 차지 사용 시 물리공격이 해당 속성이 되며, 몬스터 속성반응(약점/반감/무효)을
 * 차지 스킬레벨 의존 배율로 대체한다. (§3-3 고정 속성반응을 대체)
 *
 * 주차지 배율 (L = 차지 스킬레벨):
 *  - 약점: (홀리 1.20 / 그외 1.05) + L×0.015   → 파/아/썬 마스터(30) 1.50, 홀리 마스터(20) 1.50
 *  - 반감: (홀리 0.80 / 그외 0.95) − L×0.015   → 마스터 0.50
 *  - 무반응 1.0 / 무효 0
 *
 * 중첩차지(주차지 P + 보조 썬더 T): P·T 중 무효 있으면 0, 아니면 Pmult + (Tmult−1)×0.5.
 */

import { elementReaction } from './monster'

export type ChargeElement = 'fire' | 'ice' | 'lightning' | 'holy'

/** 차지 원소 → 속성코드(F/I/L/H) */
const ELEM_CODE: Record<ChargeElement, string> = { fire: 'F', ice: 'I', lightning: 'L', holy: 'H' }

/** 차지 원소 → 마스터레벨 (홀리 20, 그 외 30) */
export const CHARGE_MASTER: Record<ChargeElement, number> = { fire: 30, ice: 30, lightning: 30, holy: 20 }

/** 차지 원소 → 표시명 */
export const CHARGE_LABEL: Record<ChargeElement, string> = { fire: '파이어', ice: '아이스', lightning: '썬더', holy: '홀리' }

/** 선택 가능한 주차지 목록(표시 순) */
export const CHARGE_ELEMENTS: ChargeElement[] = ['fire', 'ice', 'lightning', 'holy']

type Reaction = ReturnType<typeof elementReaction>

/** 단일 차지의 반응배율 (무효는 'immune') */
function reactionMult(reaction: Reaction, level: number, holy: boolean): number | 'immune' {
  if (reaction === 'immune') return 'immune'
  if (reaction === 'weak') return (holy ? 1.2 : 1.05) + level * 0.015
  if (reaction === 'half') return (holy ? 0.8 : 0.95) - level * 0.015
  return 1.0 // none(무반응)
}

export interface ChargeState {
  /** 주차지 원소 (썬더단독이면 lightning) */
  main: ChargeElement
  mainLevel: number
  /** 보조 썬더 중첩 레벨 (없으면 null) */
  thunderLevel: number | null
}

/**
 * 차지 최종 속성배율 (§4 단독/중첩). 몬스터 무효 시 0.
 */
export function chargeElementMult(state: ChargeState, monsterElemAttr: string | undefined): number {
  const pMult = reactionMult(elementReaction(monsterElemAttr, ELEM_CODE[state.main]), state.mainLevel, state.main === 'holy')
  // 단독차지 (또는 주차지가 썬더 = 썬더단독)
  if (state.thunderLevel == null || state.main === 'lightning') {
    return pMult === 'immune' ? 0 : pMult
  }
  // 중첩차지: 주차지 P + 보조 썬더 T
  const tMult = reactionMult(elementReaction(monsterElemAttr, 'L'), state.thunderLevel, false)
  if (pMult === 'immune' || tMult === 'immune') return 0
  return pMult + (tMult - 1) * 0.5
}
