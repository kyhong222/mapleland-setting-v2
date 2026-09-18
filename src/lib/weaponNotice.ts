/** 무기 장착 상태 안내 문구. */

import { SECONDARY_WEAPON_LABELS } from '../domain/weapons'
import type { SecondaryWeapon } from '../domain/weapons'
import { objectJosa } from './josa'

/**
 * 필수 보조무기가 비었을 때의 안내 — '표창을 장착해 주세요.'
 * 데미지를 감추기만 하면 왜 안 나오는지 알 수 없으므로, 빠진 투사체를 이름으로 짚어준다.
 * (여러 종류를 인정하는 무기는 '/'로 잇는다)
 */
export function secondaryPrompt(kinds: SecondaryWeapon[]): string {
  const label = kinds.map((k) => SECONDARY_WEAPON_LABELS[k]).join('/')
  return `${label}${objectJosa(label)} 장착해 주세요.`
}
