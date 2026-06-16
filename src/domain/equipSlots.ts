/**
 * 장비 부위(slot) 타입(22종, 투사체 화살/볼트/표창/불릿/캡슐 포함).
 *
 * 도메인은 부위 "타입"만 정의한다. 반지 4칸 제한, 한벌옷(overall)의 top/bottom 비활성,
 * 두손무기의 방패 비활성 등 인스턴스 단위 규칙은 클라이언트 사이드 책임이다.
 */

export type SlotId =
  | 'hat'
  | 'faceAccessory'
  | 'eyeAccessory'
  | 'earring'
  | 'top'
  | 'bottom'
  | 'overall'
  | 'shoes'
  | 'gloves'
  | 'cape'
  | 'shield'
  | 'weapon'
  | 'arrow'
  | 'bolt'
  | 'throwingStar'
  | 'bullet'
  | 'capsule'
  | 'pendant'
  | 'ring'
  | 'belt'
  | 'petAcc'
  | 'medal'

export interface SlotDef {
  id: SlotId
  /** 한글 표기 */
  label: string
}

export const SLOTS: Record<SlotId, SlotDef> = {
  hat: { id: 'hat', label: '모자' },
  faceAccessory: { id: 'faceAccessory', label: '얼굴장식' },
  eyeAccessory: { id: 'eyeAccessory', label: '눈 장식' },
  earring: { id: 'earring', label: '귀 장식' },
  top: { id: 'top', label: '상의' },
  bottom: { id: 'bottom', label: '하의' },
  overall: { id: 'overall', label: '한벌옷' },
  shoes: { id: 'shoes', label: '신발' },
  gloves: { id: 'gloves', label: '장갑' },
  cape: { id: 'cape', label: '망토' },
  shield: { id: 'shield', label: '방패' },
  weapon: { id: 'weapon', label: '무기' },
  arrow: { id: 'arrow', label: '화살' },
  bolt: { id: 'bolt', label: '볼트' },
  throwingStar: { id: 'throwingStar', label: '표창' },
  bullet: { id: 'bullet', label: '불릿' },
  capsule: { id: 'capsule', label: '캡슐' },
  pendant: { id: 'pendant', label: '펜던트' },
  ring: { id: 'ring', label: '반지' },
  belt: { id: 'belt', label: '벨트' },
  petAcc: { id: 'petAcc', label: '펫장비' },
  medal: { id: 'medal', label: '훈장' },
}

export const ALL_SLOTS: SlotDef[] = Object.values(SLOTS)
