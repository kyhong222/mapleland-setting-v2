import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CollapsiblePanel from '../common/CollapsiblePanel'
import { useBuildStore } from '../../store/buildStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { aggregateBuild } from '../../store/aggregate'
import { useActiveEquippedBuilts } from '../../store/activation'
import { useBuffEffects } from '../../store/useBuffEffects'
import { computeDetailStats } from '../../domain/detailStats'
import type { DetailStats } from '../../domain/detailStats'

/** 정수면 그대로, 소수면 1자리로 표기 */
const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1))

const ROWS: { id: keyof DetailStats; label: string }[] = [
  { id: 'acc', label: '명중률' },
  { id: 'eva', label: '회피율' },
  { id: 'pdef', label: '물리방어력' },
  { id: 'mdef', label: '마법방어력' },
  { id: 'speed', label: '이동속도' },
  { id: 'jump', label: '점프력' },
]

export default function DetailStatPanel() {
  const jobId = useBuildStore((s) => s.jobId)
  const baseStats = useBuildStore((s) => s.baseStats)
  const equipped = useBuildStore((s) => s.equipped)
  const invItems = useInventoryStore((s) => s.items)
  const { finalStats, effects } = aggregateBuild(baseStats, useActiveEquippedBuilts(), useBuffEffects())

  if (!jobId) {
    return <CollapsiblePanel id="detail" title="세부스탯" />
  }

  const detail = computeDetailStats(jobId, finalStats, effects)

  return (
    <CollapsiblePanel id="detail" title="세부스탯">
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
        {ROWS.map(({ id, label }) => (
          <Box key={id} sx={{ display: 'flex', justifyContent: 'space-between', px: 1 }}>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{fmt(detail[id])}</Typography>
          </Box>
        ))}
      </Box>
    </CollapsiblePanel>
  )
}
