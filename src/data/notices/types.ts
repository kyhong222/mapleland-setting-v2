/**
 * 공지사항 스키마 — 번들 데이터로 관리한다(배포와 함께 반영).
 *
 * 본문은 블록 배열이다. text/list/callout 안에서는 `[[item:1452016]]`으로 아이템 칩을 끼워 넣을 수 있다.
 */

import type { ItemData } from '../../domain/item'

export interface Notice {
  /** 안정적 id — 바꾸면 '다시 열지 않음'이 초기화된다 */
  id: string
  title: string
  /** 게시일 'YYYY-MM-DD' (목록 정렬 기준) */
  date: string
  /** 시작 시 자동으로 띄울지 (최신 1건만 뜬다) */
  autoOpen?: boolean
  /** 'YYYY-MM-DD' — 이 날짜가 지나면 자동으로 뜨지 않는다(목록엔 남는다) */
  expiresAt?: string
  blocks: NoticeBlock[]
}

export interface NoticeItemRef {
  id: number
  /** 툴팁에 덧씌울 값(얕은 병합) — compare 블록에서 '변경 전' 표시용 */
  before?: Partial<ItemData>
  /** 아이템 아래 짧은 설명 */
  note?: string
}

export type NoticeBlock =
  | { type: 'heading'; text: string }
  | { type: 'text'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'callout'; tone: 'info' | 'warning'; text: string }
  /** chips: 아이콘+이름(호버 시 툴팁) / cards: 툴팁을 본문에 펼침 */
  | { type: 'items'; view: 'chips' | 'cards'; items: NoticeItemRef[] }
  /** 변경 전(before 덮어씀) → 변경 후(현재 카탈로그) 툴팁을 나란히 */
  | { type: 'compare'; items: NoticeItemRef[] }

/** 인라인 텍스트 조각 */
export type InlineSegment = { kind: 'text'; text: string } | { kind: 'item'; id: number }
