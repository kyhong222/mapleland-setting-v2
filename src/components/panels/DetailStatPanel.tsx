import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CollapsiblePanel from '../common/CollapsiblePanel'
import { useBuildStore } from '../../store/buildStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { aggregateBuild, equippedBuilts } from '../../store/aggregate'
import { EFFECTS } from '../../domain/effects'
import type { EffectId } from '../../domain/effects'

/** 세부스탯에 표시할 효과 (직업/레벨 기반 공식은 추후) */
const DETAIL_EFFECTS: EffectId[] = ['add', 'eva', 'pdef', 'mdef', 'hp', 'mp', 'speed', 'jump']

export default function DetailStatPanel() {
  const baseStats = useBuildStore((s) => s.baseStats)
  const equipped = useBuildStore((s) => s.equipped)
  const invItems = useInventoryStore((s) => s.items)
  const { effects } = aggregateBuild(baseStats, equippedBuilts(equipped, invItems))

  return (
    <CollapsiblePanel id="detail" title="세부스탯">
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
        {DETAIL_EFFECTS.map((id) => (
          <Box key={id} sx={{ display: 'flex', justifyContent: 'space-between', px: 1 }}>
            <Typography variant="body2" color="text.secondary">{EFFECTS[id].label}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{effects[id] ?? 0}</Typography>
          </Box>
        ))}
      </Box>
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
        ※ 현재는 장비 합산값. 직업·레벨 기반 세부스탯 공식은 추후 적용.
      </Typography>
    </CollapsiblePanel>
  )
}
