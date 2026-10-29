import type { Notice } from './types'

/** 3주년 패치: 35~64제 메이플 무기 착용 부스탯 일괄 10 경감 */
const notice: Notice = {
  id: '2026-10-maple-weapon-req-cut',
  title: '메이플 무기 착용 부스탯 경감 반영',
  date: '2026-10-29',
  autoOpen: true,
  expiresAt: '2026-11-30',
  blocks: [
    {
      type: 'text',
      text:
        '3주년 업데이트로 35~64제 메이플 무기의 착용 제한 부스탯이 10씩 낮아진 것을 반영했습니다.\n' +
        '전사 무기는 원래 부스탯 제한이 없어 바뀐 것이 없습니다.',
    },
    {
      type: 'callout',
      tone: 'warning',
      text:
        '이미 만들어 둔 무기는 만들 당시의 요구치를 그대로 갖고 있어 자동으로 바뀌지 않습니다.\n' +
        '인벤토리에서 해당 무기를 삭제한 뒤 다시 제작해 주세요. (주문서·보석도 다시 적용해야 합니다)',
    },
    { type: 'heading', text: '변경 내역 (왼쪽: 변경 전 → 오른쪽: 변경 후)' },
    {
      type: 'compare',
      items: [
        { id: 1382009, before: { reqLuk: 33 } }, // 메이플 스태프
        { id: 1452016, before: { reqStr: 30 } }, // 메이플 보우
        { id: 1462014, before: { reqStr: 25 } }, // 메이플 크로우
        { id: 1472030, before: { reqDex: 50 } }, // 메이플 스론즈
        { id: 1332025, before: { reqDex: 66 } }, // 메이플 바그나
        { id: 1382012, before: { reqLuk: 41 } }, // 메이플 라마 스태프
        { id: 1452022, before: { reqStr: 38 } }, // 메이플 헌터스
        { id: 1462019, before: { reqStr: 33 } }, // 메이플 크로스보우
        { id: 1472032, before: { reqDex: 66 } }, // 메이플 칸데오
        { id: 1332055, before: { reqDex: 99 } }, // 메이플 다크메이트
        { id: 1332056, before: { reqDex: 99 } }, // 메이플 아수라 대거
        { id: 1372034, before: { reqLuk: 61 } }, // 메이플 샤이니 완드
        { id: 1382039, before: { reqLuk: 62 } }, // 메이플 위덤 스태프
        { id: 1452045, before: { reqStr: 64 } }, // 메이플 간디바 보우
        { id: 1462040, before: { reqStr: 59 } }, // 메이플 니샤다
        { id: 1472055, before: { reqDex: 99 } }, // 메이플 스칸다
      ],
    },
  ],
}

export default notice
