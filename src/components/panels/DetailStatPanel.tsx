import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CollapsiblePanel from '../common/CollapsiblePanel'
import { useBuildStore } from '../../store/buildStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { aggregateBuild } from '../../store/aggregate'
import { useActiveEquippedBuilts } from '../../store/activation'
import { useBuffEffects } from '../../store/useBuffEffects'
import InfoTip, { InfoTitle, Formula, InfoWarn } from '../common/InfoTip'
import { computeDetailStats, accStatCoef, evaStatCoef } from '../../domain/detailStats'
import { magicAccuracy } from '../../domain/combat'
import { JOBS } from '../../domain/jobs'
import type { ReactNode } from 'react'

/** 정수면 그대로, 소수면 1자리로 표기 */
const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1))

const MACC_HELP = (
  <>
    <InfoTitle>마법명중률</InfoTitle>
    <Formula>⌊총 INT ÷ 10⌋ + ⌊총 LUK ÷ 10⌋</Formula>
    <InfoWarn>현재 장비의 마법명중 옵션은 반영되지 않습니다(미모델).</InfoWarn>
  </>
)

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
  const ac = accStatCoef(jobId)
  const ev = evaStatCoef(jobId)

  // 마법사는 명중률 자리를 마법명중률(floor(INT/10)+floor(LUK/10))로 대체
  const rows: { label: string; value: number; help?: ReactNode }[] = [
    isMagician
      ? { label: '마법명중률', value: magicAccuracy(finalStats), help: MACC_HELP }
      : {
          label: '명중률',
          value: detail.acc,
          help: (
            <>
              <InfoTitle>명중률</InfoTitle>
              <Formula>DEX × {ac.dex} + LUK × {ac.luk} + 장비·버프 명중</Formula>
              <Box>계수는 직업군별로 다릅니다.</Box>
            </>
          ),
        },
    {
      label: '회피율',
      value: detail.eva,
      help: (
        <>
          <InfoTitle>회피율</InfoTitle>
          <Formula>DEX × {ev.dex} + LUK × {ev.luk} + 장비·버프 회피</Formula>
          <Box>계수는 직업군별로 다릅니다.</Box>
        </>
      ),
    },
    { label: '물리방어력', value: detail.pdef },
    {
      label: '마법방어력',
      value: detail.mdef,
      help: (
        <>
          <InfoTitle>마법방어력</InfoTitle>
          <Formula>장비·버프 마방 + 총 INT</Formula>
          <Box>INT 1당 마법방어력 +1.</Box>
        </>
      ),
    },
    { label: '이동속도', value: detail.speed },
    { label: '점프력', value: detail.jump },
  ]

  return (
    <CollapsiblePanel id="detail" title="세부스탯">
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
        {rows.map(({ label, value, help }) => (
          <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', px: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
              {label}
              {help && <InfoTip title={help} />}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{fmt(value)}</Typography>
          </Box>
        ))}
      </Box>
    </CollapsiblePanel>
  )
}
