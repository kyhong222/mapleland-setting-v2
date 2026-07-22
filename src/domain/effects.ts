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
  | 'addPad'
  | 'addMad'
  | 'padP'
  | 'madP'
  | 'acc'
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
  | 'shieldBonusPdef'
  | 'addEvadeP'
  | 'damageReduce'
  | 'damageReflectP'
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
  // 정령의 축복(Blessing of the Fairy) 전용 — 다른 버프와 중첩되지 않는 독립 보너스
  | 'pad_botf'
  | 'mad_botf'
  | 'acc_botf'
  | 'eva_botf'
  | 'hpP_botf'
  | 'mpP_botf'
  // 버닝(버닝 서버 전용) — 항상 중첩되는 독립 보너스
  | 'pad_burning'
  | 'mad_burning'
  | 'speed_burning'
  | 'jump_burning'
  // 기상효과 — 모든 버프와 중첩되는 독립 보너스
  | 'pad_weather'
  | 'mad_weather'

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
  addPad: { id: 'addPad', label: '추가공격력', category: 'offense', unit: 'flat', appliesToItem: false },
  addMad: { id: 'addMad', label: '추가마력', category: 'offense', unit: 'flat', appliesToItem: false },
  padP: { id: 'padP', label: '공격력%', category: 'offense', unit: 'percent', appliesToItem: false },
  madP: { id: 'madP', label: '마력%', category: 'offense', unit: 'percent', appliesToItem: false },
  acc: { id: 'acc', label: '명중률', category: 'offense', unit: 'flat', appliesToItem: true },
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
  shieldBonusPdef: { id: 'shieldBonusPdef', label: '방패 방어력 보너스%', category: 'defense', unit: 'percent', appliesToItem: false },
  addEvadeP: { id: 'addEvadeP', label: '추가회피확률%', category: 'defense', unit: 'percent', appliesToItem: false },
  damageReduce: { id: 'damageReduce', label: '피해량감소', category: 'defense', unit: 'percent', appliesToItem: false },
  damageReflectP: { id: 'damageReflectP', label: '피해 반사%', category: 'defense', unit: 'percent', appliesToItem: false },
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

  // ── 정령의 축복(Blessing of the Fairy) 전용 — 독립 보너스(미중첩) ──
  pad_botf: { id: 'pad_botf', label: '공격력', category: 'offense', unit: 'flat', appliesToItem: false },
  mad_botf: { id: 'mad_botf', label: '마력', category: 'offense', unit: 'flat', appliesToItem: false },
  acc_botf: { id: 'acc_botf', label: '명중률', category: 'offense', unit: 'flat', appliesToItem: false },
  eva_botf: { id: 'eva_botf', label: '회피율', category: 'defense', unit: 'flat', appliesToItem: false },
  hpP_botf: { id: 'hpP_botf', label: 'HP%', category: 'resource', unit: 'percent', appliesToItem: false },
  mpP_botf: { id: 'mpP_botf', label: 'MP%', category: 'resource', unit: 'percent', appliesToItem: false },

  // ── 버닝(버닝 서버 전용) — 항상 중첩되는 독립 보너스 ──
  pad_burning: { id: 'pad_burning', label: '공격력', category: 'offense', unit: 'flat', appliesToItem: false },
  mad_burning: { id: 'mad_burning', label: '마력', category: 'offense', unit: 'flat', appliesToItem: false },
  speed_burning: { id: 'speed_burning', label: '이동속도', category: 'mobility', unit: 'flat', appliesToItem: false },
  jump_burning: { id: 'jump_burning', label: '점프력', category: 'mobility', unit: 'flat', appliesToItem: false },

  // ── 기상효과 — 모든 버프와 중첩되는 독립 보너스 ──
  pad_weather: { id: 'pad_weather', label: '공격력', category: 'offense', unit: 'flat', appliesToItem: false },
  mad_weather: { id: 'mad_weather', label: '마력', category: 'offense', unit: 'flat', appliesToItem: false },
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

/**
 * 여러 EffectMap을 능력치(id)별 최댓값으로 병합한다.
 * 같은 종류의 버프는 중첩되지 않고 높은 쪽만 적용되는 규칙에 사용한다.
 * (예: 아이언바디 방어+40, 블레스 방어+20 → 방어+40)
 * 해당 id를 가진 맵들 사이에서만 비교한다(값이 없는 맵은 0으로 취급하지 않음).
 */
export function maxEffects(...maps: EffectMap[]): EffectMap {
  const result: EffectMap = {}
  for (const map of maps) {
    for (const key of Object.keys(map) as EffectId[]) {
      const v = map[key]
      if (v === undefined) continue
      const cur = result[key]
      result[key] = cur === undefined ? v : Math.max(cur, v)
    }
  }
  return result
}
