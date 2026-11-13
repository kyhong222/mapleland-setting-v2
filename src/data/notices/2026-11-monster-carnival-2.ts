import type { Notice } from './types'

/** 몬스터 카니발 2 몬스터 10종 + 슈피겔만의 혼돈 목걸이 추가 */
const notice: Notice = {
  id: '2026-11-monster-carnival-2',
  title: '261113 몬스터 카니발 2 추가',
  date: '2026-11-13',
  autoOpen: true,
  expiresAt: '2026-12-13',
  blocks: [
    { type: 'heading', text: '1. 몬스터 카니발 2 몬스터' },
    {
      type: 'text',
      text: '몬스터 카니발 2에서 소환되는 몬스터 10종을 추가했습니다. 몬스터 선택의 [파티퀘스트 > 몬스터 카니발 2]에서 고를 수 있고, 이름 앞에 [카니발]이 붙어 있습니다.',
    },
    {
      type: 'list',
      items: [
        'Lv.51 버피 · Lv.53 소울테니 · Lv.55 레이지 버피 · Lv.57 마스터 소울테니 · Lv.59 클라크',
        'Lv.61 버푼 · Lv.63 딥 버푼 · Lv.65 파이렛 · Lv.67 데스테니 · Lv.69 바이킹',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: '필드의 같은 몬스터와는 수치가 다릅니다(HP 3,500 ~ 12,500). 10종 모두 보스 판정이고 언데드가 아니라 힐로 데미지를 줄 수 없습니다. 소울테니 · 마스터 소울테니 · 클라크 · 데스테니는 성속성 약점은 그대로입니다.',
    },

    { type: 'heading', text: '2. 슈피겔만의 혼돈 목걸이' },
    { type: 'items', view: 'cards', items: [{ id: 1122058 }] },
    { type: 'text', text: '펜던트 슈피겔만의 혼돈 목걸이를 추가했습니다. 업그레이드 가능 횟수는 메이플랜드 기준 1회입니다.' },
  ],
}

export default notice
