/** 공지사항 — 번들 데이터 + 자동 노출 판정 */

import type { InlineSegment, Notice, NoticeBlock } from './types'
import maple3rdAnniversary from './2026-10-maple-3rd-anniversary'
import battleMage from './2026-10-battle-mage'
import elementalStaff from './2026-11-elemental-staff'
import skillUpdates from './2026-11-skill-updates'
import shareCard from './2026-11-share-card'
import monsterCarnival2 from './2026-11-monster-carnival-2'

export * from './types'

/**
 * 최신순. 정렬은 안정 정렬이라 같은 날짜끼리는 배열 순서가 유지된다 —
 * 같은 날 올린 공지는 나중 것을 앞에 둬야 자동 노출 대상(최신 1건)이 된다.
 */
export const NOTICES: Notice[] = [maple3rdAnniversary, battleMage, elementalStaff, skillUpdates, monsterCarnival2, shareCard].sort((a, b) => b.date.localeCompare(a.date))

/** 로컬 날짜 'YYYY-MM-DD' */
export function todayString(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

export function isNoticeExpired(n: Notice, today = todayString()): boolean {
  return n.expiresAt !== undefined && today > n.expiresAt
}

/**
 * 시작 시 띄울 공지 — 자동 노출 공지 중 **가장 최신 1건만** 후보다.
 * 그 1건을 '다시 열지 않음' 했거나 만료됐으면 아무것도 띄우지 않는다. 더 오래된 공지로 내려가지 않는다
 * (최신 공지가 올라온 뒤에는 과거 공지가 자동으로 다시 뜨면 안 된다 — 목록에서만 본다).
 */
export function autoOpenNotice(dismissed: readonly string[], today = todayString()): Notice | null {
  const latest = NOTICES.find((n) => n.autoOpen)
  if (!latest || isNoticeExpired(latest, today) || dismissed.includes(latest.id)) return null
  return latest
}

const ITEM_TOKEN = /\[\[item:(\d+)\]\]/g

/** `[[item:id]]` 토큰을 아이템 조각으로 쪼갠다 */
export function parseInline(text: string): InlineSegment[] {
  const out: InlineSegment[] = []
  let last = 0
  for (const m of text.matchAll(ITEM_TOKEN)) {
    const at = m.index ?? 0
    if (at > last) out.push({ kind: 'text', text: text.slice(last, at) })
    out.push({ kind: 'item', id: Number(m[1]) })
    last = at + m[0].length
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) })
  return out
}

function blockTexts(b: NoticeBlock): string[] {
  switch (b.type) {
    case 'text':
    case 'callout':
      return [b.text]
    case 'list':
      return b.items
    default:
      return []
  }
}

/** 공지가 참조하는 아이템 id 전부(블록 + 인라인 토큰, 중복 제거) — 미리 불러오기용 */
export function noticeItemIds(n: Notice): number[] {
  const ids = new Set<number>()
  for (const b of n.blocks) {
    if (b.type === 'items' || b.type === 'compare') for (const r of b.items) ids.add(r.id)
    for (const t of blockTexts(b)) for (const s of parseInline(t)) if (s.kind === 'item') ids.add(s.id)
  }
  return [...ids]
}
