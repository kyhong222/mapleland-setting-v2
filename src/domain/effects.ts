/**
 * 효과(Effect) 시스템
 *
 * 마스터 효과 집합(47개)을 전부 정의하고, 아이템에 붙을 수 있는 효과는
 * 그 부분집합(appliesToItem === true, 22개)으로 표시한다.
 * 효과 값은 확정 값만 다룬다(랜덤 옵션 범위 모델링 X).
 */

export type EffectCategory =
  | 'baseStat'
  | 'resource'
  | 'offense'
  | 'defense'
  | 'mobility'

/** flat: 고정값 · percent: 퍼센트 · step: 공격속도 단계 */
export type EffectUnit = 'flat' | 'percent' | 'step'

export type EffectId =
  // baseStat
  | 'STR'
  | 'DEX'
  | 'INT'
  | 'LUK'
  | 'strP'
  | 'dexP'
  | 'intP'
  | 'lukP'
  | 'allStatP'
  // resource
  | 'hp'
  | 'mp'
  | 'hpP'
  | 'mpP'
  // offense
  | 'pad'
  | 'mad'
  | 'addPdd'
  | 'addMdd'
  | 'padP'
  | 'madP'
  | 'add'
  | 'mastery'
  | 'attackSpeed'
  | 'criticalP'
  | 'criticalDamage'
  | 'amplifiedMagicDamageP'
  | 'coldDamageP'
  | 'fireDamageP'
  | 'lightningDamageP'
  | 'poisonDamageP'
  | 'normalDamageP'
  // defense
  | 'pdef'
  | 'mdef'
  | 'eva'
  | 'addEvadeP'
  | 'damageReduce'
  | 'cDamageReduce_common'
  | 'cDamageReduce_boss'
  | 'blockRate'
  | 'stanceP'
  | 'coldRes'
  | 'fireRes'
  | 'lightningRes'
  | 'poisonRes'
  | 'allRes'
  | 'physicalRes'
  // mobility
  | 'speed'
  | 'jump'

export interface EffectDef {
  id: EffectId
  /** 한글 표기 */
  label: string
  category: EffectCategory
  unit: EffectUnit
  /** 아이템 옵션으로 붙을 수 있으면 true (부분집합 마커) */
  appliesToItem: boolean
}

/** 효과 값 컨테이너 (확정 값) */
export type EffectMap = Partial<Record<EffectId, number>>

/** 전체 마스터 효과 정의 (47개) */
export const EFFECTS: Record<EffectId, EffectDef> = {
  // ── baseStat ──
  STR: { id: 'STR', label: '힘', category: 'baseStat', unit: 'flat', appliesToItem: true },
  DEX: { id: 'DEX', label: '민첩', category: 'baseStat', unit: 'flat', appliesToItem: true },
  INT: { id: 'INT', label: '지력', category: 'baseStat', unit: 'flat', appliesToItem: true },
  LUK: { id: 'LUK', label: '행운', category: 'baseStat', unit: 'flat', appliesToItem: true },
  strP: { id: 'strP', label: '힘%', category: 'baseStat', unit: 'percent', appliesToItem: false },
  dexP: { id: 'dexP', label: '민첩%', category: 'baseStat', unit: 'percent', appliesToItem: false },
  intP: { id: 'intP', label: '지력%', category: 'baseStat', unit: 'percent', appliesToItem: false },
  lukP: { id: 'lukP', label: '행운%', category: 'baseStat', unit: 'percent', appliesToItem: false },
  allStatP: { id: 'allStatP', label: '모든스탯%', category: 'baseStat', unit: 'percent', appliesToItem: false },

  // ── resource ──
  hp: { id: 'hp', label: 'HP', category: 'resource', unit: 'flat', appliesToItem: true },
  mp: { id: 'mp', label: 'MP', category: 'resource', unit: 'flat', appliesToItem: true },
  hpP: { id: 'hpP', label: 'HP%', category: 'resource', unit: 'percent', appliesToItem: true },
  mpP: { id: 'mpP', label: 'MP%', category: 'resource', unit: 'percent', appliesToItem: true },

  // ── offense ──
  pad: { id: 'pad', label: '공격력', category: 'offense', unit: 'flat', appliesToItem: true },
  mad: { id: 'mad', label: '마력', category: 'offense', unit: 'flat', appliesToItem: true },
  addPdd: { id: 'addPdd', label: '추가공격력', category: 'offense', unit: 'flat', appliesToItem: false },
  addMdd: { id: 'addMdd', label: '추가마력', category: 'offense', unit: 'flat', appliesToItem: false },
  padP: { id: 'padP', label: '공격력%', category: 'offense', unit: 'percent', appliesToItem: false },
  madP: { id: 'madP', label: '마력%', category: 'offense', unit: 'percent', appliesToItem: false },
  add: { id: 'add', label: '명중률', category: 'offense', unit: 'flat', appliesToItem: true },
  mastery: { id: 'mastery', label: '숙련도', category: 'offense', unit: 'percent', appliesToItem: false },
  attackSpeed: { id: 'attackSpeed', label: '공격속도', category: 'offense', unit: 'step', appliesToItem: true },
  criticalP: { id: 'criticalP', label: '크리티컬%', category: 'offense', unit: 'percent', appliesToItem: false },
  criticalDamage: { id: 'criticalDamage', label: '크리티컬데미지', category: 'offense', unit: 'percent', appliesToItem: false },
  amplifiedMagicDamageP: { id: 'amplifiedMagicDamageP', label: '마법데미지증가%', category: 'offense', unit: 'percent', appliesToItem: false },
  coldDamageP: { id: 'coldDamageP', label: '냉기속성추가피해%', category: 'offense', unit: 'percent', appliesToItem: true },
  fireDamageP: { id: 'fireDamageP', label: '화염속성추가피해%', category: 'offense', unit: 'percent', appliesToItem: true },
  lightningDamageP: { id: 'lightningDamageP', label: '번개속성추가피해%', category: 'offense', unit: 'percent', appliesToItem: true },
  poisonDamageP: { id: 'poisonDamageP', label: '독속성추가피해%', category: 'offense', unit: 'percent', appliesToItem: true },
  normalDamageP: { id: 'normalDamageP', label: '무속성추가피해%', category: 'offense', unit: 'percent', appliesToItem: true },

  // ── defense ──
  pdef: { id: 'pdef', label: '물리방어력', category: 'defense', unit: 'flat', appliesToItem: true },
  mdef: { id: 'mdef', label: '마법방어력', category: 'defense', unit: 'flat', appliesToItem: true },
  eva: { id: 'eva', label: '회피율', category: 'defense', unit: 'flat', appliesToItem: true },
  addEvadeP: { id: 'addEvadeP', label: '추가회피확률%', category: 'defense', unit: 'percent', appliesToItem: false },
  damageReduce: { id: 'damageReduce', label: '피해량감소', category: 'defense', unit: 'percent', appliesToItem: false },
  cDamageReduce_common: { id: 'cDamageReduce_common', label: '접촉피해량감소(일반)', category: 'defense', unit: 'percent', appliesToItem: false },
  cDamageReduce_boss: { id: 'cDamageReduce_boss', label: '접촉피해량감소(보스)', category: 'defense', unit: 'percent', appliesToItem: false },
  blockRate: { id: 'blockRate', label: '블록확률', category: 'defense', unit: 'percent', appliesToItem: false },
  stanceP: { id: 'stanceP', label: '스탠스확률', category: 'defense', unit: 'percent', appliesToItem: false },
  coldRes: { id: 'coldRes', label: '냉기속성저항', category: 'defense', unit: 'percent', appliesToItem: false },
  fireRes: { id: 'fireRes', label: '화염속성저항', category: 'defense', unit: 'percent', appliesToItem: false },
  lightningRes: { id: 'lightningRes', label: '번개속성저항', category: 'defense', unit: 'percent', appliesToItem: false },
  poisonRes: { id: 'poisonRes', label: '독속성저항', category: 'defense', unit: 'percent', appliesToItem: false },
  allRes: { id: 'allRes', label: '모든속성저항', category: 'defense', unit: 'percent', appliesToItem: false },
  physicalRes: { id: 'physicalRes', label: '물리속성저항', category: 'defense', unit: 'percent', appliesToItem: false },

  // ── mobility ──
  speed: { id: 'speed', label: '이동속도', category: 'mobility', unit: 'flat', appliesToItem: true },
  jump: { id: 'jump', label: '점프력', category: 'mobility', unit: 'flat', appliesToItem: true },
}

/** 마스터 효과 전체 목록 */
export const ALL_EFFECTS: EffectDef[] = Object.values(EFFECTS)

/** 아이템에 붙을 수 있는 효과 부분집합 (22개) */
export const ITEM_EFFECTS: EffectDef[] = ALL_EFFECTS.filter((e) => e.appliesToItem)

/** 아이템 효과 id 집합 (빠른 조회용) */
export const ITEM_EFFECT_IDS: ReadonlySet<EffectId> = new Set(
  ITEM_EFFECTS.map((e) => e.id),
)

/** 해당 효과가 아이템 옵션으로 붙을 수 있는지 */
export function isItemEffect(id: EffectId): boolean {
  return ITEM_EFFECT_IDS.has(id)
}

/**
 * 여러 EffectMap을 하나로 합산한다.
 * 동일 id의 값(flat/step/percent 모두)을 단순 덧셈으로 병합한다.
 * percent의 기반 스탯 적용 순서는 stats/attackPower 단계에서 처리한다.
 */
export function sumEffects(...maps: EffectMap[]): EffectMap {
  const result: EffectMap = {}
  for (const map of maps) {
    for (const key of Object.keys(map) as EffectId[]) {
      const v = map[key]
      if (v === undefined) continue
      result[key] = (result[key] ?? 0) + v
    }
  }
  return result
}
