/**
 * 공격력(데미지) 계산식.
 *
 * 출처: ayumilovemaple "MapleStory Formula Compilation" + 메이플랜드 검수.
 *
 * 물리:
 *   MAX = (주스탯 × 무기배수 + 부스탯) × 총공격력 / 100
 *   MIN = (주스탯 × 무기배수 × 0.9 × 숙련도 + 부스탯) × 총공격력 / 100
 *   - 베기(swing)는 constMax, 찌르기(stab)는 constMin을 무기배수로 사용
 *   - 표기 데미지 = [찌르기 MIN, 베기 MAX]
 *   - 숙련도 = (10 + Σmastery%) / 100  (기본 10% + 마스터리/엑스퍼트 등)
 *
 * 마법:
 *   MAX = ((마력²/1000 + 마력)/30 + INT/200) × 스킬마법공격력
 *   MIN = ((마력²/1000 + 마력 × 숙련도 × 0.9)/30 + INT/200) × 스킬마법공격력
 *
 * 럭키세븐 / 트리플 스로우(도적 표창):
 *   MAX = LUK × 5.0 × 총공격력 / 100
 *   MIN = LUK × 2.5 × 총공격력 / 100
 *
 * 주/부스탯은 최종 능력치(장비·버프 반영) 기준이다.
 */

import type { EffectMap } from './effects'
import { WEAPON_CONSTANTS } from './weapons'
import type { WeaponType } from './weapons'

export interface DamageRange {
  min: number
  max: number
}

/** 베기/찌르기 + 표기(최종 노출용) */
export interface PhysicalResult {
  /** 표기 데미지 = [찌르기 MIN, 베기 MAX] */
  display: DamageRange
  /** 베기(휘두르기, constMax) 자체의 MIN~MAX */
  swing: DamageRange
  /** 찌르기(constMin) 자체의 MIN~MAX */
  stab: DamageRange
}

/**
 * 총 공격력 = (장비+패시브+버프 공격력 + 추가공격력 + 정령의 축복) × (1 + 공격력%/100)
 * (장비·패시브·버프 공격력은 모두 effects.pad로 합산, 정령의 축복은 pad_botf로 별도 합산)
 */
export function totalAttack(effects: EffectMap): number {
  const flat = (effects.pad ?? 0) + (effects.addPad ?? 0) + (effects.pad_botf ?? 0)
  return Math.floor(flat * (1 + (effects.padP ?? 0) / 100))
}

/**
 * 총 마력 = (장비+버프 마력 + 추가마력 + 총 지력 + 정령의 축복) × (1 + 마력%/100)
 * @param totalInt 최종 지력(스탯 공식 적용 후)
 */
export function totalMagic(effects: EffectMap, totalInt: number): number {
  const flat = (effects.mad ?? 0) + (effects.addMad ?? 0) + totalInt + (effects.mad_botf ?? 0)
  return Math.floor(flat * (1 + (effects.madP ?? 0) / 100))
}

/** 숙련도(0~1) = (기본 10% + Σmastery%) / 100 (최대 100%) */
export function masteryRatio(effects: EffectMap): number {
  return Math.min(1, (10 + (effects.mastery ?? 0)) / 100)
}

/** 무기배수 mult 기준 한 모션의 MIN~MAX */
function physRange(primary: number, secondary: number, mult: number, watk: number, mastery: number): DamageRange {
  const max = Math.floor((primary * mult + secondary) * watk / 100)
  const min = Math.floor((primary * mult * 0.9 * mastery + secondary) * watk / 100)
  return { min, max }
}

/**
 * 물리 데미지 — 베기/찌르기 + 표기.
 * @param primary   최종 주스탯
 * @param secondary 최종 부스탯 합
 * @param weaponType 장착 무기 종류
 * @param watk      총공격력
 * @param mastery   숙련도(0~1)
 */
export function calcPhysical(primary: number, secondary: number, weaponType: WeaponType, watk: number, mastery: number): PhysicalResult {
  const wc = WEAPON_CONSTANTS[weaponType]
  const swing = physRange(primary, secondary, wc.constMax, watk, mastery)
  const stab = physRange(primary, secondary, wc.constMin, watk, mastery)
  return { display: { min: stab.min, max: swing.max }, swing, stab }
}

/** 럭키세븐 / 트리플 스로우 (도적 표창 전용 별도식) */
export function calcLuckySeven(luk: number, watk: number): DamageRange {
  return {
    max: Math.floor((luk * 5.0) * watk / 100),
    min: Math.floor((luk * 2.5) * watk / 100),
  }
}

/**
 * 마법 데미지.
 * @param magic    총마력
 * @param int      최종 지력
 * @param spellAtk 스킬 마법공격력(계수) — 스킬 데이터 확정 전까지 호출부에서 주입
 * @param mastery  숙련도(0~1)
 */
export function calcMagic(magic: number, int: number, spellAtk: number, mastery: number): DamageRange {
  const sq = (magic * magic) / 1000
  const max = ((sq + magic) / 30 + int / 200) * spellAtk
  const min = ((sq + magic * mastery * 0.9) / 30 + int / 200) * spellAtk
  return { min: Math.floor(min), max: Math.floor(max) }
}
