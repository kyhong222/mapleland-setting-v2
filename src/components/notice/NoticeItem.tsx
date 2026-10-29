/**
 * 공지 본문의 아이템 미리보기 — 아이콘·칩(호버 툴팁) / 카드(툴팁 펼침) / 조정 내역 표.
 * 툴팁은 인벤토리·제작창과 같은 ItemTooltip을 쓴다(주문서·보석 없는 정옵 상태).
 */

import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import ItemIcon from '../common/ItemIcon'
import ItemTooltip from '../common/ItemTooltip'
import { getItem } from '../../data/itemRepository'
import { noticeItemIds, type Notice, type NoticeItemRef } from '../../data/notices'
import type { BuiltItem } from '../../domain/builtItem'
import type { ItemData } from '../../domain/item'
import { EFFECTS, type EffectId } from '../../domain/effects'

/** id → 아이템. 키가 없으면 불러오는 중, null이면 조회 실패 */
export type NoticeItemMap = Map<number, ItemData | null>

/** 공지가 참조하는 아이템을 한꺼번에 불러온다 */
export function useNoticeItems(notice: Notice | null): NoticeItemMap {
  const [map, setMap] = useState<NoticeItemMap>(new Map())
  useEffect(() => {
    if (!notice) return
    let alive = true
    void Promise.all(
      noticeItemIds(notice).map((id) =>
        getItem(id)
          .catch(() => null)
          .then((it) => [id, it] as const),
      ),
    ).then((entries) => {
      if (alive) setMap(new Map(entries))
    })
    return () => {
      alive = false
    }
  }, [notice])
  return map
}

const builtOf = (base: ItemData): BuiltItem => ({ base, adjustments: {}, scrolls: [], gems: [], growth: {} })

const TOOLTIP_SLOT = { tooltip: { sx: { bgcolor: 'transparent', p: 0, maxWidth: 'none' } } }

/** 아이콘 + 이름. 호버(모바일은 탭) 시 툴팁 */
export function NoticeItemChip({ id, items }: { id: number; items: NoticeItemMap }) {
  const item = items.get(id)
  if (!item) {
    return (
      <Box component="span" sx={{ color: 'text.disabled' }}>
        {items.has(id) ? `(아이템 #${id})` : '…'}
      </Box>
    )
  }
  return (
    <Tooltip
      title={<ItemTooltip built={builtOf(item)} />}
      placement="right"
      enterTouchDelay={0}
      leaveTouchDelay={4000}
      disableInteractive
      slotProps={TOOLTIP_SLOT}
    >
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: 0.5,
          mx: 0.25,
          verticalAlign: 'middle',
          borderRadius: 1,
          bgcolor: 'action.hover',
          fontWeight: 700,
          cursor: 'default',
        }}
      >
        <ItemIcon src={item.iconUrl} alt={item.name} size={20} />
        {item.name}
      </Box>
    </Tooltip>
  )
}

/** 아이콘 타일만. 호버(모바일은 탭) 시 툴팁 */
export function NoticeItemIcon({ id, items }: { id: number; items: NoticeItemMap }) {
  const item = items.get(id)
  const tile = (
    <Box
      sx={{
        width: 40,
        height: 40,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'action.hover',
        color: 'text.disabled',
        fontSize: 11,
        flexShrink: 0,
      }}
    >
      {item ? <ItemIcon src={item.iconUrl} alt={item.name} size={32} /> : items.has(id) ? '?' : '…'}
    </Box>
  )
  if (!item) return tile
  return (
    <Tooltip
      title={<ItemTooltip built={builtOf(item)} />}
      placement="right"
      enterTouchDelay={0}
      leaveTouchDelay={4000}
      disableInteractive
      slotProps={TOOLTIP_SLOT}
    >
      {tile}
    </Tooltip>
  )
}

/** 툴팁을 본문에 펼친 카드 */
export function NoticeItemCard({ refItem, items }: { refItem: NoticeItemRef; items: NoticeItemMap }) {
  const item = items.get(refItem.id)
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
      {item ? <ItemTooltip built={builtOf(item)} /> : <NoticeItemChip id={refItem.id} items={items} />}
      {refItem.note && (
        <Box sx={{ fontSize: 12, color: 'text.secondary', maxWidth: 252, textAlign: 'center' }}>{refItem.note}</Box>
      )}
    </Box>
  )
}

/** 요구치는 "DEX 50 → DEX 40"처럼 스탯명으로 표기한다 */
const FIELD_LABEL: Partial<Record<keyof ItemData, string>> = {
  name: '이름',
  reqLevel: '레벨',
  reqStr: 'STR',
  reqDex: 'DEX',
  reqInt: 'INT',
  reqLuk: 'LUK',
  tuc: '업횟',
}

/** before에 적힌 필드만 현재값과 비교해 'DEX 50 → DEX 40' 형태로 */
export function diffLines(before: Partial<ItemData>, after: ItemData): string[] {
  const lines: string[] = []
  for (const key of Object.keys(before) as (keyof ItemData)[]) {
    if (key === 'effects') {
      const be = before.effects ?? {}
      for (const eid of Object.keys(be) as EffectId[]) {
        const a = after.effects[eid] ?? 0
        const b = be[eid] ?? 0
        const label = EFFECTS[eid].label
        if (a !== b) lines.push(`${label} ${b} → ${label} ${a}`)
      }
      continue
    }
    const b = before[key]
    const a = after[key]
    const label = FIELD_LABEL[key] ?? key
    if (b !== a) lines.push(`${label} ${b ?? 0} → ${label} ${a ?? 0}`)
  }
  return lines
}

/** 조정 내역 표 — 아이콘(호버 시 툴팁) | 조정 결과 */
export function NoticeCompareTable({ refs, items }: { refs: NoticeItemRef[]; items: NoticeItemMap }) {
  return (
    <Box
      component="table"
      sx={{
        borderCollapse: 'collapse',
        width: '100%',
        fontSize: 13,
        '& th, & td': { borderBottom: 1, borderColor: 'divider', px: 1, py: 0.5, textAlign: 'left' },
        '& th': { color: 'text.secondary', fontWeight: 700, fontSize: 12 },
      }}
    >
      <thead>
        <tr>
          <Box component="th" sx={{ width: 56 }}>아이콘</Box>
          <th>조정 결과</th>
        </tr>
      </thead>
      <tbody>
        {refs.map((r) => {
          const item = items.get(r.id)
          const lines = item && r.before ? diffLines(r.before, item) : []
          return (
            <tr key={r.id}>
              <td>
                <NoticeItemIcon id={r.id} items={items} />
              </td>
              <Box component="td" sx={{ fontWeight: 700 }}>
                {lines.join(' · ')}
                {r.note && (
                  <Box component="span" sx={{ display: 'block', fontWeight: 400, fontSize: 12, color: 'text.secondary' }}>
                    {r.note}
                  </Box>
                )}
              </Box>
            </tr>
          )
        })}
      </tbody>
    </Box>
  )
}
