/**
 * 장비 인스턴스 슬롯 — 클라이언트 표시 단위.
 * 도메인 SlotId와 1:1이 아니다:
 *  - 반지: ring1~4
 *  - 한벌옷(overall): 별도 슬롯 없이 '상의(top)' 칸에 장착 (하의 비활성)
 *  - 방패/화살/볼트/표창/불릿: '보조무기(secondary)' 단일 슬롯으로 통일
 */

import type { SlotId } from '../domain/equipSlots'

export type EquipInstance =
  | 'hat'
  | 'faceAccessory'
  | 'eyeAccessory'
  | 'earring'
  | 'pendant'
  | 'ring1'
  | 'ring2'
  | 'ring3'
  | 'ring4'
  | 'belt'
  | 'medal'
  | 'top'
  | 'bottom'
  | 'gloves'
  | 'shoes'
  | 'cape'
  | 'weapon'
  | 'secondary'
  | 'petAcc1'
  | 'petAcc2'
  | 'petAcc3'

/** 표시 순서 */
export const EQUIP_INSTANCES: EquipInstance[] = [
  'hat',
  'faceAccessory',
  'eyeAccessory',
  'earring',
  'pendant',
  'ring1',
  'ring2',
  'ring3',
  'ring4',
  'belt',
  'medal',
  'top',
  'bottom',
  'gloves',
  'shoes',
  'cape',
  'weapon',
  'secondary',
  'petAcc1',
  'petAcc2',
  'petAcc3',
]

const LABELS: Record<EquipInstance, string> = {
  hat: '모자',
  faceAccessory: '얼굴장식',
  eyeAccessory: '눈 장식',
  earring: '귀 장식',
  pendant: '펜던트',
  ring1: '반지1',
  ring2: '반지2',
  ring3: '반지3',
  ring4: '반지4',
  belt: '벨트',
  medal: '훈장',
  top: '상의',
  bottom: '하의',
  gloves: '장갑',
  shoes: '신발',
  cape: '망토',
  weapon: '무기',
  secondary: '보조무기',
  petAcc1: '펫장비1',
  petAcc2: '펫장비2',
  petAcc3: '펫장비3',
}

export function instanceLabel(inst: EquipInstance): string {
  return LABELS[inst]
}

/** 보조무기로 통합되는 도메인 슬롯들 */
export const SECONDARY_SLOTS: SlotId[] = ['shield', 'arrow', 'bolt', 'throwingStar', 'bullet']

/** 도메인 SlotId → 장착 대상 인스턴스 후보 (없으면 빈 배열) */
export function targetInstancesForSlot(slot: SlotId): EquipInstance[] {
  if (slot === 'ring') return ['ring1', 'ring2', 'ring3', 'ring4']
  if (slot === 'petAcc') return ['petAcc1', 'petAcc2', 'petAcc3']
  if (slot === 'overall') return ['top'] // 한벌옷은 상의 칸
  if (SECONDARY_SLOTS.includes(slot)) return ['secondary']
  return (EQUIP_INSTANCES as string[]).includes(slot) ? [slot as EquipInstance] : []
}
