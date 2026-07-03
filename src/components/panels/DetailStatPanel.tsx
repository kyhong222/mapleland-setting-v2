import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CollapsiblePanel from '../common/CollapsiblePanel'
import { useBuildStore } from '../../store/buildStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { aggregateBuild, equippedBuilts } from '../../store/aggregate'
import { useBuffEffects } from '../../store/useBuffEffects'
import { EFFECTS } from '../../domain/effects'
import type { EffectId } from '../../domain/effects'

/** 세부스탯에 표시할 효과 (직업/레벨 기반 공식은 추후) */
const DETAIL_EFFECTS: EffectId[] = ['acc', 'eva', 'pdef', 'mdef', 'hp', 'mp', 'speed', 'jump']

/** 정령의 축복(_botf) 등 별도 id로 합산되는 보너스를 표시용 능력치에 더해준다 */
const BOTF_BONUS: Partial<Record<EffectId, EffectId>> = { acc: 'acc_botf', eva: 'eva_botf' }

export default function DetailStatPanel() {
  const baseStats = useBuildStore((s) => s.baseStats)
  const equipped = useBuildStore((s) => s.equipped)
  const invItems = useInventoryStore((s) => s.items)
  const { effects } = aggregateBuild(baseStats, equippedBuilts(equipped, invItems), useBuffEffects())

  return (
    <CollapsiblePanel id="detail" title="세부스탯">
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
        {DETAIL_EFFECTS.map((id) => {
          const bonusId = BOTF_BONUS[id]
          const value = (effects[id] ?? 0) + (bonusId ? effects[bonusId] ?? 0 : 0)
          return (
            <Box key={id} sx={{ display: 'flex', justifyContent: 'space-between', px: 1 }}>
              <Typography variant="body2" color="text.secondary">{EFFECTS[id].label}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{value}</Typography>
            </Box>
          )
        })}
      </Box>
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
        ※ 현재는 장비 합산값. 직업·레벨 기반 세부스탯 공식은 추후 적용.
      </Typography>
    </CollapsiblePanel>
  )
}
