import { useState } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import CollapsiblePanel from '../common/CollapsiblePanel'
import { useBuildStore } from '../../store/buildStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { aggregateBuild, equippedBuilts } from '../../store/aggregate'
import { useBuffEffects } from '../../store/useBuffEffects'
import { JOBS } from '../../domain/jobs'
import { STAT_IDS, MAX_STAT, totalPureStats } from '../../domain/stats'
import type { StatId } from '../../domain/stats'

const STAT_LABEL: Record<StatId, string> = { STR: '힘', DEX: '민첩', INT: '지력', LUK: '행운' }

/** AP 입력칸 — 입력 중에는 자유롭게 두고, 포커스 해제(또는 Enter) 시 검사/커밋 */
function ApInput({ value, disabled, error, onCommit }: { value: number; disabled?: boolean; error?: boolean; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    onCommit(draft.trim() === '' ? 0 : Number(draft))
    setDraft(null)
  }
  return (
    <TextField
      size="small"
      type="number"
      value={draft ?? String(value)}
      disabled={disabled}
      error={error}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      slotProps={{ htmlInput: { style: { textAlign: 'center' } } }}
      sx={error ? { '& .MuiOutlinedInput-notchedOutline': { borderColor: 'error.main' }, '& .MuiInputBase-input': { color: 'error.main', WebkitTextFillColor: (theme) => theme.palette.error.main } } : undefined}
    />
  )
}

export default function StatPanel() {
  const jobId = useBuildStore((s) => s.jobId)
  const level = useBuildStore((s) => s.level)
  const setLevel = useBuildStore((s) => s.setLevel)
  const baseStats = useBuildStore((s) => s.baseStats)
  const setStat = useBuildStore((s) => s.setStat)
  const equipped = useBuildStore((s) => s.equipped)
  const invItems = useInventoryStore((s) => s.items)
  const buffEffects = useBuffEffects()

  const { finalStats } = aggregateBuild(baseStats, equippedBuilts(equipped, invItems), buffEffects)

  if (!jobId) {
    return <CollapsiblePanel id="stat" title="스탯" />
  }

  const job = JOBS[jobId]
  const secondarySet = new Set(job.secondaryStats)

  const roleOf = (stat: StatId): '주' | '부' | null =>
    stat === job.primaryStat ? '주' : secondarySet.has(stat) ? '부' : null

  return (
    <CollapsiblePanel id="stat" title="스탯">
      <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr', columnGap: 1, rowGap: 0.5, alignItems: 'center', mb: 1 }}>
        <Typography variant="body2">레벨</Typography>
        <ApInput value={level} onCommit={setLevel} />
        <Typography variant="body2" color="text.secondary">총 스탯합</Typography>
        <TextField
          size="small"
          value={totalPureStats(level)}
          disabled
          slotProps={{ htmlInput: { style: { textAlign: 'center' } } }}
        />
      </Box>

      <Divider sx={{ mb: 1 }} />

      <Box sx={{ display: 'grid', gridTemplateColumns: '56px 1fr 1fr 1fr', columnGap: 1, rowGap: 0.5, alignItems: 'center' }}>
        {/* 헤더 */}
        <Box />
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>AP</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>장비·버프</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>최종</Typography>

        {STAT_IDS.map((stat) => {
          const role = roleOf(stat)
          const isPrimary = stat === job.primaryStat
          const v = baseStats[stat]
          const over = v > MAX_STAT
          const bonus = finalStats[stat] - baseStats[stat]
          return (
            <Box key={stat} sx={{ display: 'contents' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="body2">{STAT_LABEL[stat]}</Typography>
                {role && (
                  <Chip
                    label={role}
                    size="small"
                    sx={{ height: 16, fontSize: 10, bgcolor: role === '주' ? 'primary.main' : 'action.selected', color: role === '주' ? '#fff' : 'text.secondary' }}
                  />
                )}
              </Box>
              <ApInput value={v} disabled={isPrimary} error={over} onCommit={(n) => setStat(stat, n)} />
              <TextField
                size="small"
                value={bonus > 0 ? `+${bonus}` : bonus}
                disabled
                slotProps={{ htmlInput: { style: { textAlign: 'center' } } }}
              />
              <TextField
                size="small"
                value={finalStats[stat]}
                disabled
                slotProps={{ htmlInput: { style: { textAlign: 'center', fontWeight: 600 } } }}
              />
            </Box>
          )
        })}
      </Box>
    </CollapsiblePanel>
  )
}
