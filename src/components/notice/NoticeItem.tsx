/**
 * 공지 본문의 아이템 미리보기 — 칩(호버 툴팁) / 카드(툴팁 펼침) / 변경 전후 비교.
 * 툴팁은 인벤토리·제작창과 같은 ItemTooltip을 쓴다(주문서·보석 없는 정옵 상태).
 */

import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
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

const FIELD_LABEL: Partial<Record<keyof ItemData, string>> = {
  name: '이름',
  reqLevel: 'REQ LEV',
  reqStr: 'REQ STR',
  reqDex: 'REQ DEX',
  reqInt: 'REQ INT',
  reqLuk: 'REQ LUK',
  tuc: '업횟',
}

/** before에 적힌 필드만 현재값과 비교해 'REQ STR 30 → 20' 형태로 */
function diffLines(before: Partial<ItemData>, after: ItemData): string[] {
  const lines: string[] = []
  for (const key of Object.keys(before) as (keyof ItemData)[]) {
    if (key === 'effects') {
      const be = before.effects ?? {}
      for (const eid of Object.keys(be) as EffectId[]) {
        const a = after.effects[eid] ?? 0
        const b = be[eid] ?? 0
        if (a !== b) lines.push(`${EFFECTS[eid].label} ${b} → ${a}`)
      }
      continue
    }
    const b = before[key]
    const a = after[key]
    if (b !== a) lines.push(`${FIELD_LABEL[key] ?? key} ${b ?? 0} → ${a ?? 0}`)
  }
  return lines
}

/** 한 줄 요약(칩 + 변경 내역), 누르면 변경 전/후 툴팁을 나란히 펼친다 */
export function NoticeItemCompare({ refItem, items }: { refItem: NoticeItemRef; items: NoticeItemMap }) {
  const [open, setOpen] = useState(false)
  const item = items.get(refItem.id)
  const before = item ? { ...item, ...refItem.before } : null
  const lines = item && refItem.before ? diffLines(refItem.before, item) : []

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <ButtonBase
        onClick={() => setOpen((v) => !v)}
        disabled={!item}
        sx={{ width: '100%', justifyContent: 'flex-start', gap: 1, py: 0.75, px: 0.5, textAlign: 'left', flexWrap: 'wrap' }}
      >
        <NoticeItemChip id={refItem.id} items={items} />
        <Box component="span" sx={{ fontSize: 13, color: 'warning.main', fontWeight: 700 }}>
          {lines.join(' · ')}
        </Box>
        <Box component="span" sx={{ ml: 'auto', fontSize: 12, color: 'text.secondary' }}>
          {open ? '접기 ▲' : '비교 ▼'}
        </Box>
      </ButtonBase>
      {refItem.note && <Box sx={{ fontSize: 12, color: 'text.secondary', px: 0.5, pb: 0.5 }}>{refItem.note}</Box>}
      {open && item && before && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 1, pb: 1.25 }}>
          <ItemTooltip built={builtOf(before)} note="(변경 전)" />
          <Box sx={{ fontSize: 22, color: 'text.secondary' }}>→</Box>
          <ItemTooltip built={builtOf(item)} note="(변경 후)" />
        </Box>
      )}
    </Box>
  )
}
