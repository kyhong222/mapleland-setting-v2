/**
 * 저장슬롯 카드에 띄우는 장착 장비 미리보기.
 *
 * `equipped`는 인벤토리 id만 들고 있어서, 스냅샷을 따라다니는 개인 인벤토리와 공용 인벤토리
 * 양쪽에서 찾아야 이름이 나온다. 못 찾으면 건너뛴다(구버전 스냅샷엔 personalItems가 없다).
 * 부위 이름은 인스턴스가 아니라 실제 아이템의 도메인 슬롯에서 가져온다 — secondary 칸이
 * 방패인지 화살인지, top 칸이 상의인지 한벌옷인지가 그래야 구분된다.
 *
 * 공용 인벤토리는 스냅샷에 없으므로 **보고 있는 맥락의 것**을 넘겨야 한다. 게스트 벌의 카드에
 * 계정 인벤토리를 넘기면 이름이 엉뚱하게 빈다.
 */

import { SLOTS } from '../domain/equipSlots'
import { resolveBuiltItem } from '../domain/builtItem'
import type { GradeResult } from '../domain/grade'
import type { BuildSnapshot } from '../store/buildStore'
import type { EquipInstance } from '../store/equipInstance'
import type { InventoryItem } from '../store/inventoryStore'

export interface PreviewItem {
  inst: EquipInstance
  label: string
  name: string
  iconUrl?: string
  grade: GradeResult
}

/**
 * 카드에 미리 보여줄 장착 부위 — 무기·방패·상의·하의·장갑·신발 순.
 * 한벌옷은 별도 인스턴스 없이 top 칸에 들어가므로(equipInstance.ts) top 하나로 덮이고,
 * 한벌옷을 입으면 하의가 비어 자연히 '무기-방패-전신-장갑-신발'로 렌더된다.
 */
export const EQUIP_PREVIEW: EquipInstance[] = ['weapon', 'secondary', 'top', 'bottom', 'gloves', 'shoes']

export function equippedPreview(snapshot: BuildSnapshot, sharedItems: InventoryItem[]): PreviewItem[] {
  const byId = new Map<string, InventoryItem>()
  for (const it of sharedItems) byId.set(it.id, it)
  for (const it of snapshot.personalItems ?? []) byId.set(it.id, it)
  const out: PreviewItem[] = []
  for (const inst of EQUIP_PREVIEW) {
    const invId = snapshot.equipped[inst]
    if (!invId) continue
    const item = byId.get(invId)
    if (!item) continue
    const base = item.built.base
    out.push({
      inst,
      label: SLOTS[base.slot].label,
      name: base.name,
      iconUrl: base.iconUrl,
      grade: resolveBuiltItem(item.built).grade,
    })
  }
  return out
}
