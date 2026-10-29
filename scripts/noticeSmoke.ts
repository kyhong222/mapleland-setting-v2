/**
 * 수동 스모크 테스트: 공지사항 번들 데이터 검증 (tsx)
 *  - id 중복 / 날짜 형식
 *  - 블록·인라인 `[[item:id]]`가 가리키는 아이템이 조회되는지 (카탈로그 밖은 API 조회)
 *  - compare 블록의 before가 현재값과 실제로 다른지 (같으면 변경 내역이 비어 보인다)
 *  - 자동 노출 판정(최신 1건 / 다시 열지 않음 / 만료)
 */
import { NOTICES, autoOpenNotice, noticeItemIds, parseInline } from '../src/data/notices'
import { getCatalogItem } from '../src/data/catalog'
import { getItem } from '../src/data/itemRepository'
import type { ItemData } from '../src/domain/item'

let fail = 0
const bad = (msg: string) => {
  fail++
  console.log('  ✗', msg)
}
const DATE = /^\d{4}-\d{2}-\d{2}$/

async function main() {
  const ids = new Set<string>()
  for (const n of NOTICES) {
    console.log(`[${n.id}] ${n.title}`)
    if (ids.has(n.id)) bad(`id 중복: ${n.id}`)
    ids.add(n.id)
    if (!DATE.test(n.date)) bad(`date 형식: ${n.date}`)
    if (n.expiresAt && !DATE.test(n.expiresAt)) bad(`expiresAt 형식: ${n.expiresAt}`)

    const items = new Map<number, ItemData | null>()
    for (const id of noticeItemIds(n)) {
      const item = await getItem(id)
      items.set(id, item)
      if (!item) bad(`아이템 조회 실패: ${id}`)
      else if (!getCatalogItem(id)) console.log(`  · ${id} ${item.name} — 카탈로그 밖(API 조회)`)
    }
    console.log(`  아이템 ${items.size}종 확인`)

    for (const b of n.blocks) {
      if (b.type !== 'compare') continue
      for (const r of b.items) {
        const cur = items.get(r.id)
        if (!cur || !r.before) {
          if (!r.before) bad(`compare에 before 없음: ${r.id}`)
          continue
        }
        const same = (Object.keys(r.before) as (keyof ItemData)[]).every(
          (k) => JSON.stringify(r.before![k]) === JSON.stringify(cur[k]),
        )
        if (same) bad(`compare 전후 동일: ${r.id} ${cur.name}`)
      }
    }
  }

  // 인라인 파서
  const seg = parseInline('앞 [[item:1452016]] 뒤')
  if (seg.length !== 3 || seg[1].kind !== 'item' || seg[1].id !== 1452016) bad(`parseInline: ${JSON.stringify(seg)}`)

  // 자동 노출 판정
  const latest = NOTICES.find((n) => n.autoOpen)
  if (latest) {
    const day = latest.date
    if (autoOpenNotice([], day)?.id !== latest.id) bad('자동 노출: 최신 공지가 안 뜸')
    if (autoOpenNotice([latest.id], day)?.id === latest.id) bad('자동 노출: 다시 열지 않음 무시됨')
    if (latest.expiresAt && autoOpenNotice([], '9999-12-31')?.id === latest.id) bad('자동 노출: 만료 무시됨')
  }

  console.log(fail === 0 ? '\nOK' : `\n실패 ${fail}건`)
  if (fail) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
