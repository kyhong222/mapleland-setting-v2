import type { Notice } from './types'

/** 속성 스태프 4종 메랜 스펙 반영 + 속성 보정 계산 추가 */
const notice: Notice = {
  id: '2026-11-elemental-staff',
  title: '261104 속성 스태프 추가 알림',
  date: '2026-11-04',
  autoOpen: true,
  expiresAt: '2026-12-04',
  blocks: [
    { type: 'heading', text: '1. 스펙 수정' },
    { type: 'text', text: '속성 스태프 4종을 메이플랜드 스펙에 맞게 고쳤습니다.' },
    {
      type: 'compare',
      items: [
        { id: 1382045, before: { reqLevel: 103, reqInt: 0, reqLuk: 105, effects: { pad: 72, INT: 1, mad: 85, attackSpeed: 7 } } }, // 파이어 스태프
        { id: 1382046, before: { reqLevel: 103, reqInt: 0, reqLuk: 105, effects: { pad: 72, INT: 1, mad: 85, attackSpeed: 7 } } }, // 포이즌 스태프
        { id: 1382047, before: { reqLevel: 103, reqInt: 0, reqLuk: 105, effects: { pad: 72, INT: 1, mad: 85, attackSpeed: 7 } } }, // 아이스 스태프
        { id: 1382048, before: { reqLevel: 103, reqInt: 0, reqLuk: 105, effects: { pad: 72, INT: 1, mad: 85, attackSpeed: 7 } } }, // 라이트닝 스태프
      ],
    },
    {
      type: 'callout',
      tone: 'warning',
      text: '이미 제작해 둔 속성 스태프에는 새 스펙과 속성 보정이 적용되지 않습니다. 다시 제작해 주세요.',
    },

    { type: 'heading', text: '2. 속성 보정' },
    { type: 'text', text: 'N방컷·DPM 계산에 스태프의 속성 보정을 반영했습니다. 몬스터 속성 배율에 더하는 방식입니다.' },
    {
      type: 'list',
      items: [
        '스태프와 같은 속성: +10% — 약점 1.6배, 무관 1.1배, 반감 0.6배',
        '그 외 속성과 무속성(빅뱅 포함): -25% — 약점 1.25배, 무관 0.75배, 반감 0.25배',
        '소환수와 포이즌 미스트의 도트 데미지에는 적용되지 않습니다.',
      ],
    },
  ],
}

export default notice
