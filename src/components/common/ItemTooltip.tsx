import Box from '@mui/material/Box'
import { resolveBuiltItem } from '../../domain/builtItem'
import type { BuiltItem } from '../../domain/builtItem'
import { SLOTS } from '../../domain/equipSlots'
import { EFFECTS } from '../../domain/effects'
import type { EffectId } from '../../domain/effects'

/** 클래스 표기 (초보자는 공용(reqJob 0)일 때만 사용 가능) */
const CLASS_ROW: { label: string; bit: number }[] = [
  { label: '초보자', bit: 0 },
  { label: '전사', bit: 1 },
  { label: '마법사', bit: 2 },
  { label: '궁수', bit: 4 },
  { label: '도적', bit: 8 },
  { label: '해적', bit: 16 },
]

/** 스탯 표기 순서 (메이플 툴팁 기준) */
const STAT_ROWS: { id: EffectId; label: string }[] = [
  { id: 'STR', label: 'STR' },
  { id: 'DEX', label: 'DEX' },
  { id: 'INT', label: 'INT' },
  { id: 'LUK', label: 'LUK' },
  { id: 'hp', label: '최대 HP' },
  { id: 'mp', label: '최대 MP' },
  { id: 'hpP', label: 'HP' },
  { id: 'mpP', label: 'MP' },
  { id: 'pad', label: '공격력' },
  { id: 'mad', label: '마력' },
  { id: 'pdef', label: '물리방어력' },
  { id: 'mdef', label: '마법방어력' },
  { id: 'acc', label: '명중률' },
  { id: 'eva', label: '회피율' },
  { id: 'speed', label: '이동속도' },
  { id: 'jump', label: '점프력' },
  { id: 'attackSpeed', label: '공격속도' },
]

function ReqRow({ label, value }: { label: string; value?: number }) {
  const dim = value === undefined || value === 0
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', color: dim ? '#6a7098' : '#e8ebf5' }}>
      <Box component="span">{label}</Box>
      <Box component="span">{value === undefined ? '–' : value}</Box>
    </Box>
  )
}

function StatLine({ label, value, color = '#e8ebf5' }: { label: string; value: string; color?: string }) {
  return (
    <Box sx={{ textAlign: 'center', fontSize: 12.5, lineHeight: 1.6, color }}>
      {label} : {value}
    </Box>
  )
}

interface Props {
  built: BuiltItem
  /** 부가 표기(예: '(비활성)') */
  note?: string
}

/** 메이플 스타일 아이템 호버 툴팁 */
export default function ItemTooltip({ built, note }: Props) {
  const { base } = built
  const { finalEffects, grade } = resolveBuiltItem(built)
  const upgrades = built.scrolls.length
  const tucLeft = Math.max(0, (base.tuc ?? 0) - upgrades)
  const rj = base.reqJob ?? 0

  return (
    <Box
      sx={{
        width: 252,
        p: 1.25,
        color: '#e8ebf5',
        borderRadius: 2,
        border: '2px solid #39406e',
        background: 'linear-gradient(180deg, #151a37 0%, #0a0c1c 100%)',
        boxShadow: '0 6px 20px rgba(0,0,0,0.6)',
        fontSize: 12,
      }}
    >
      {/* 이름 + 강화수 */}
      <Box sx={{ textAlign: 'center', pb: 0.75, mb: 0.75, borderBottom: '1px solid rgba(255,255,255,0.14)' }}>
        <Box sx={{ fontWeight: 800, fontSize: 15, color: grade.info.color, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
          {base.name}
          {upgrades > 0 ? ` (+${upgrades})` : ''}
        </Box>
        {note && <Box sx={{ fontSize: 11, color: '#ffb74d', mt: 0.25 }}>{note}</Box>}
      </Box>

      {/* 아이콘 + 요구치 */}
      <Box sx={{ display: 'flex', gap: 1, mb: 0.75 }}>
        <Box
          sx={{
            width: 66, height: 66, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: 1,
            bgcolor: 'rgba(255,255,255,0.05)',
          }}
        >
          {base.iconUrl && <Box component="img" src={base.iconUrl} alt="" sx={{ width: 52, height: 52, imageRendering: 'pixelated' }} />}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, fontSize: 11.5, lineHeight: 1.5 }}>
          <ReqRow label="REQ LEV" value={base.reqLevel ?? 0} />
          <ReqRow label="REQ STR" value={base.reqStr ?? 0} />
          <ReqRow label="REQ DEX" value={base.reqDex ?? 0} />
          <ReqRow label="REQ INT" value={base.reqInt ?? 0} />
          <ReqRow label="REQ LUK" value={base.reqLuk ?? 0} />
          <ReqRow label="REQ POP" value={undefined} />
          <ReqRow label="ITEM LEV" value={undefined} />
          <ReqRow label="ITEM EXP" value={undefined} />
        </Box>
      </Box>

      {/* 착용 가능 직업 */}
      <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 0.75, mb: 0.75, fontSize: 12 }}>
        {CLASS_ROW.map((c) => {
          const usable = c.bit === 0 ? rj === 0 : rj === 0 || (rj & c.bit) !== 0
          const color = usable ? '#ffffff' : c.bit === 0 ? '#5a6080' : '#c0392b'
          return (
            <Box key={c.label} component="span" sx={{ color, fontWeight: usable ? 700 : 400 }}>
              {c.label}
            </Box>
          )
        })}
      </Box>

      {/* 장비분류 · 스탯 · 업횟 */}
      <Box sx={{ pt: 0.75, borderTop: '1px solid rgba(255,255,255,0.14)' }}>
        <StatLine label="장비분류" value={SLOTS[base.slot].label} color="#c8cde6" />
        {STAT_ROWS.map((r) => {
          const v = finalEffects[r.id]
          if (v === undefined || v === 0) return null
          const unit = EFFECTS[r.id].unit
          const text = unit === 'step' ? `${v}` : `${v > 0 ? '+' : ''}${v}${unit === 'percent' ? '%' : ''}`
          return <StatLine key={r.id} label={r.label} value={text} color={v < 0 ? '#ff8a80' : '#a5f3b0'} />
        })}
        <StatLine label="업그레이드 가능 횟수" value={String(tucLeft)} color="#c8cde6" />
      </Box>
    </Box>
  )
}
