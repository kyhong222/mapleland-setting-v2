import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import CollapsiblePanel from '../common/CollapsiblePanel'
import { useBuildStore } from '../../store/buildStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { aggregateBuild, equippedBuilts } from '../../store/aggregate'
import { STAT_IDS } from '../../domain/stats'
import type { StatId } from '../../domain/stats'

const STAT_LABEL: Record<StatId, string> = { STR: '힘', DEX: '민첩', INT: '지력', LUK: '행운' }

export default function StatPanel() {
  const level = useBuildStore((s) => s.level)
  const setLevel = useBuildStore((s) => s.setLevel)
  const baseStats = useBuildStore((s) => s.baseStats)
  const setBaseStat = useBuildStore((s) => s.setBaseStat)
  const equipped = useBuildStore((s) => s.equipped)
  const invItems = useInventoryStore((s) => s.items)

  const { finalStats } = aggregateBuild(baseStats, equippedBuilts(equipped, invItems))

  return (
    <CollapsiblePanel id="stat" title="스탯">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <TextField
          label="레벨"
          size="small"
          type="number"
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          sx={{ width: 90 }}
        />
      </Box>

      <Typography variant="caption" color="text.secondary">기본 능력치 (AP 분배)</Typography>
      <Box sx={{ display: 'flex', gap: 1, mt: 0.5, mb: 1.5, flexWrap: 'wrap' }}>
        {STAT_IDS.map((stat) => (
          <TextField
            key={stat}
            label={STAT_LABEL[stat]}
            size="small"
            type="number"
            value={baseStats[stat]}
            onChange={(e) => setBaseStat(stat, Number(e.target.value))}
            sx={{ width: 84 }}
          />
        ))}
      </Box>

      <Divider sx={{ my: 1 }} />

      <Typography variant="caption" color="text.secondary">최종 능력치 (장비 반영)</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5, mt: 0.5 }}>
        {STAT_IDS.map((stat) => {
          const diff = finalStats[stat] - baseStats[stat]
          return (
            <Box key={stat} sx={{ display: 'flex', justifyContent: 'space-between', px: 1 }}>
              <Typography variant="body2" color="text.secondary">{STAT_LABEL[stat]}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {finalStats[stat]}
                {diff > 0 && (
                  <Typography component="span" variant="caption" color="success.main" sx={{ ml: 0.5 }}>
                    (+{diff})
                  </Typography>
                )}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </CollapsiblePanel>
  )
}
