import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CollapsiblePanel from '../common/CollapsiblePanel'
import { useBuildStore } from '../../store/buildStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { aggregateBuild, equippedBuilts } from '../../store/aggregate'
import { JOBS } from '../../domain/jobs'

export default function AttackPanel() {
  const jobId = useBuildStore((s) => s.jobId)
  const baseStats = useBuildStore((s) => s.baseStats)
  const equipped = useBuildStore((s) => s.equipped)
  const invItems = useInventoryStore((s) => s.items)

  // 스탯/세부스탯 변경 시 함께 리프레시 (현재는 흐름만 — 공격력 공식 미정)
  const { finalStats, effects } = aggregateBuild(baseStats, equippedBuilts(equipped, invItems))
  const job = jobId ? JOBS[jobId] : null
  const primary = job ? finalStats[job.primaryStat] : 0
  const watk = effects.pad ?? 0
  const matk = effects.mad ?? 0

  return (
    <CollapsiblePanel id="attack" title="공격력 계산">
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
        <Row label="주스탯" value={primary} />
        <Row label="공격력" value={watk} />
        <Row label="마력" value={matk} />
      </Box>
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
        ※ 공격력 공식 미정 — 스탯/세부스탯 연동 흐름만 배선됨.
      </Typography>
    </CollapsiblePanel>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{value}</Typography>
    </Box>
  )
}
