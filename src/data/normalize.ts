/**
 * maplestory.io 원시 응답 → 도메인 ItemData 정규화.
 * effects에는 ITEM_EFFECTS 부분집합에 해당하는 값만 담는다(0은 제외).
 */

import type { EffectId, EffectMap } from '../domain/effects'
import type { ItemData } from '../domain/item'
import { resolveSlot, resolveWeaponType } from './categoryMap'
import { itemIconUrl } from './msioClient'
import type { MsioItemSpec } from './msioTypes'

/** metaInfo의 inc* 필드 → EffectId */
const EFFECT_BY_META_FIELD: Record<string, EffectId> = {
  incSTR: 'STR',
  incDEX: 'DEX',
  incINT: 'INT',
  incLUK: 'LUK',
  incMHP: 'hp',
  incMMP: 'mp',
  incPAD: 'pad',
  incMAD: 'mad',
  incPDD: 'pdef',
  incMDD: 'mdef',
  incACC: 'acc',
  incEVA: 'eva',
  incSpeed: 'speed',
  incJump: 'jump',
  attackSpeed: 'attackSpeed',
}

export interface NormalizeOptions {
  /** 스펙을 찾은 버전(아이콘 URL 생성용) */
  version: string
  /** KMS 300 한글명(없으면 영문명/ID로 폴백) */
  koreanName: string | null
}

/**
 * 원시 스펙을 ItemData로 변환한다.
 * 장비가 아니거나 지원하지 않는 부위면 null을 반환한다.
 */
export function normalizeItem(
  spec: MsioItemSpec,
  opts: NormalizeOptions,
): ItemData | null {
  const meta = spec.metaInfo ?? {}
  const subCategory = spec.typeInfo?.subCategory
  const slot = resolveSlot(subCategory)
  if (!slot) return null

  const effects: EffectMap = {}
  for (const field of Object.keys(EFFECT_BY_META_FIELD)) {
    const raw = meta[field]
    if (typeof raw === 'number' && raw !== 0) {
      const effId = EFFECT_BY_META_FIELD[field]
      effects[effId] = (effects[effId] ?? 0) + raw
    }
  }

  const item: ItemData = {
    id: spec.id,
    name: opts.koreanName ?? spec.description?.name ?? String(spec.id),
    slot,
    effects,
    iconUrl: itemIconUrl(opts.version, spec.id),
  }

  const reqLevel = meta.reqLevelEquip ?? meta.reqLevel
  if (typeof reqLevel === 'number' && reqLevel > 0) {
    item.reqLevel = reqLevel
  }
  if (typeof meta.reqSTR === 'number' && meta.reqSTR > 0) item.reqStr = meta.reqSTR
  if (typeof meta.reqDEX === 'number' && meta.reqDEX > 0) item.reqDex = meta.reqDEX
  if (typeof meta.reqINT === 'number' && meta.reqINT > 0) item.reqInt = meta.reqINT
  if (typeof meta.reqLUK === 'number' && meta.reqLUK > 0) item.reqLuk = meta.reqLUK

  if (typeof meta.tuc === 'number') {
    item.tuc = meta.tuc
  }
  if (typeof meta.reqJob === 'number' && meta.reqJob > 0) {
    item.reqJob = meta.reqJob
  }

  if (slot === 'weapon') {
    const weaponType = resolveWeaponType(subCategory)
    if (weaponType) item.weaponType = weaponType
  }

  return item
}
