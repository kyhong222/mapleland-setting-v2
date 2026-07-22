import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CollapsiblePanel from '../common/CollapsiblePanel'
import { useBuildStore } from '../../store/buildStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { aggregateBuild } from '../../store/aggregate'
import { useActiveEquippedBuilts } from '../../store/activation'
import { useBuffEffects } from '../../store/useBuffEffects'
import { computeDetailStats } from '../../domain/detailStats'
import { magicAccuracy } from '../../domain/combat'
import { JOBS } from '../../domain/jobs'

/** 정수면 그대로, 소수면 1자리로 표기 */
const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1))

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
  const isMagician = JOBS[jobId].attackType === 'magical'

  // 마법사는 명중률 자리를 마법명중률(floor(INT/10)+floor(LUK/10))로 대체
  const rows: { label: string; value: number }[] = [
    isMagician
      ? { label: '마법명중률', value: magicAccuracy(finalStats) }
      : { label: '명중률', value: detail.acc },
    { label: '회피율', value: detail.eva },
    { label: '물리방어력', value: detail.pdef },
    { label: '마법방어력', value: detail.mdef },
    { label: '이동속도', value: detail.speed },
    { label: '점프력', value: detail.jump },
  ]

  return (
    <CollapsiblePanel id="detail" title="세부스탯">
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
        {rows.map(({ label, value }) => (
          <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', px: 1 }}>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{fmt(value)}</Typography>
          </Box>
        ))}
      </Box>
    </CollapsiblePanel>
  )
}
