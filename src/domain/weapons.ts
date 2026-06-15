/**
 * 무기 종류(16종)와 무기상수(min/max).
 *
 * MAX 데미지에는 constMax, MIN 데미지에는 constMin을 사용한다.
 * (정확한 공격력 공식은 attackPower.ts에서 사용자 제공 후 확정)
 */

export type WeaponType =
  | 'oneHandedSword'
  | 'oneHandedAxe'
  | 'oneHandedMace'
  | 'twoHandedSword'
  | 'twoHandedAxe'
  | 'twoHandedMace'
  | 'spear'
  | 'polearm'
  | 'dagger'
  | 'claw'
  | 'bow'
  | 'crossbow'
  | 'knuckle'
  | 'gun'
  | 'wand'
  | 'staff'

/** 보조무기 종류 */
export type SecondaryWeapon =
  | 'shield'
  | 'arrow'
  | 'bolt'
  | 'throwingStar'
  | 'bullet'
  | 'capsule'

export const SECONDARY_WEAPON_LABELS: Record<SecondaryWeapon, string> = {
  shield: '방패',
  arrow: '화살', // 활 전용
  bolt: '볼트', // 석궁 전용
  throwingStar: '표창',
  bullet: '불릿',
  capsule: '캡슐',
}

export interface WeaponConst {
  type: WeaponType
  /** 한글 표기 */
  label: string
  /** MIN 데미지용 무기상수 */
  constMin: number
  /** MAX 데미지용 무기상수 */
  constMax: number
  /** 함께 착용 가능한 보조무기(없으면 빈 배열, 건은 불릿+캡슐 둘 다) */
  secondary: SecondaryWeapon[]
}

export const WEAPON_CONSTANTS: Record<WeaponType, WeaponConst> = {
  oneHandedSword: { type: 'oneHandedSword', label: '한손검', constMin: 4, constMax: 4, secondary: ['shield'] },
  oneHandedAxe: { type: 'oneHandedAxe', label: '한손도끼', constMin: 3.2, constMax: 4.4, secondary: ['shield'] },
  oneHandedMace: { type: 'oneHandedMace', label: '한손둔기', constMin: 3.2, constMax: 4.4, secondary: ['shield'] },
  twoHandedSword: { type: 'twoHandedSword', label: '두손검', constMin: 4.6, constMax: 4.6, secondary: [] },
  twoHandedAxe: { type: 'twoHandedAxe', label: '두손도끼', constMin: 3.4, constMax: 4.8, secondary: [] },
  twoHandedMace: { type: 'twoHandedMace', label: '두손둔기', constMin: 3.4, constMax: 4.8, secondary: [] },
  spear: { type: 'spear', label: '창', constMin: 3, constMax: 5, secondary: [] },
  polearm: { type: 'polearm', label: '폴암', constMin: 3, constMax: 5, secondary: [] },
  dagger: { type: 'dagger', label: '단검', constMin: 3.6, constMax: 3.6, secondary: ['shield'] },
  claw: { type: 'claw', label: '아대', constMin: 3.6, constMax: 3.6, secondary: ['throwingStar'] },
  bow: { type: 'bow', label: '활', constMin: 3.4, constMax: 3.4, secondary: ['arrow'] },
  crossbow: { type: 'crossbow', label: '석궁', constMin: 3.6, constMax: 3.6, secondary: ['bolt'] },
  knuckle: { type: 'knuckle', label: '너클', constMin: 4.8, constMax: 4.8, secondary: [] },
  gun: { type: 'gun', label: '건', constMin: 3.6, constMax: 3.6, secondary: ['bullet', 'capsule'] },
  wand: { type: 'wand', label: '완드', constMin: 1, constMax: 1, secondary: ['shield'] },
  staff: { type: 'staff', label: '스태프', constMin: 1, constMax: 1, secondary: ['shield'] },
}

export const ALL_WEAPONS: WeaponConst[] = Object.values(WEAPON_CONSTANTS)
