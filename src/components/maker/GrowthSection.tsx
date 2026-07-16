import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import type { ItemData } from '../../domain/item'
import type { EffectMap } from '../../domain/effects'
import { EFFECTS } from '../../domain/effects'
import { itemGrowthSpec, GROWTH_TIER_LABEL } from '../../domain/growth'
import type { GrowthStat } from '../../domain/growth'

interface Props {
  item: ItemData
  growth: EffectMap
  onChange: (next: EffectMap) => void
}

/** 범위 [min,max]로 클램프되는 성장치 입력 (blur/Enter 시 커밋) */
function GrowthInput({ value, min, max, onCommit }: { value: number; min: number; max: number; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const n = draft.trim() === '' ? min : Number(draft)
    onCommit(Math.max(min, Math.min(max, Math.floor(Number.isNaN(n) ? min : n))))
    setDraft(null)
  }
  return (
    <TextField
      size="small"
      type="number"
      value={draft ?? String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      slotProps={{ htmlInput: { min, max, style: { textAlign: 'center', width: 56, padding: '4px 6px' } } }}
    />
  )
}

export default function GrowthSection({ item, growth, onChange }: Props) {
  const spec = itemGrowthSpec(item)
  if (!spec) return null

  const setStat = (st: GrowthStat, n: number) => onChange({ ...growth, [st.effectId]: n })

  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        성장 · {GROWTH_TIER_LABEL[spec.tier]} (최대 {spec.maxLevel}레벨)
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
        {spec.stats.map((st) => {
          const value = growth[st.effectId] ?? st.totalMin
          return (
            <Box key={st.effectId} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ width: 64, flexShrink: 0 }}>
                {EFFECTS[st.effectId].label}
              </Typography>
              <Typography variant="caption" color="text.disabled" sx={{ flexGrow: 1 }}>
                레벨당 +{st.perLevelMin}~{st.perLevelMax} · 누적 {st.totalMin}~{st.totalMax}
              </Typography>
              <GrowthInput value={value} min={st.totalMin} max={st.totalMax} onCommit={(n) => setStat(st, n)} />
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

/** 성장 스펙 기본값(각 스탯 누적 최소) — 성장 아이템 선택 시 초기 growth로 사용 */
export function defaultGrowth(item: ItemData): EffectMap | undefined {
  const spec = itemGrowthSpec(item)
  if (!spec) return undefined
  const out: EffectMap = {}
  for (const st of spec.stats) out[st.effectId] = st.totalMin
  return out
}
