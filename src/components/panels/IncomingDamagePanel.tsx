import { useState } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import CollapsiblePanel from '../common/CollapsiblePanel'
import { useBuildStore } from '../../store/buildStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { useMonsterStore } from '../../store/monsterStore'
import { aggregateBuild, equippedBuilts } from '../../store/aggregate'
import { useBuffEffects } from '../../store/useBuffEffects'
import { JOBS } from '../../domain/jobs'
import { getMonster } from '../../data/mobs'
import { lookupStandardPDD } from '../../data/standardPDD'
import { physicalIncoming, magicIncoming, applyPowerUp } from '../../domain/incomingDamage'
import type { IncomingRange } from '../../domain/incomingDamage'

const fmtRange = (r: IncomingRange) => `${r.min.toLocaleString()} ~ ${r.max.toLocaleString()}`

function DmgRow({ label, range }: { label: string; range: IncomingRange }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1, py: 0.25 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, color: 'error.main' }}>{fmtRange(range)}</Typography>
    </Box>
  )
}

export default function IncomingDamagePanel() {
  const jobId = useBuildStore((s) => s.jobId)
  const level = useBuildStore((s) => s.level)
  const baseStats = useBuildStore((s) => s.baseStats)
  const equipped = useBuildStore((s) => s.equipped)
  const invItems = useInventoryStore((s) => s.items)
  const selectedMobId = useMonsterStore((s) => s.selectedId)
  const buffEffects = useBuffEffects()
  const [powerUp, setPowerUp] = useState(false)
  const [magicUp, setMagicUp] = useState(false)

  const monster = selectedMobId != null ? getMonster(selectedMobId) : undefined

  let content: ReactNode
  if (!jobId || !monster) {
    content = (
      <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
        {jobId ? '대상 몬스터를 선택하세요.' : '직업을 선택하세요.'}
      </Typography>
    )
  } else {
    const job = JOBS[jobId]
    const { finalStats, effects } = aggregateBuild(baseStats, equippedBuilts(equipped, invItems), buffEffects)
    const isBoss = !!monster.isBoss
    const pdd = effects.pdef ?? 0
    const mdd = (effects.mdef ?? 0) + finalStats.INT
    const stdPdd = lookupStandardPDD(job.classId, level)

    const phys = applyPowerUp(
      physicalIncoming({
        monsterAtt: monster.PADamage ?? 0,
        charLevel: level,
        monLevel: monster.level,
        pdd,
        stdPdd,
        isWarrior: job.classId === 'warrior',
        stats: finalStats,
      }),
      powerUp,
      isBoss,
    )
    const hasMagic = (monster.MADamage ?? 0) > 0
    const magic = hasMagic
      ? applyPowerUp(
          magicIncoming({ monsterMatt: monster.MADamage ?? 0, mdd, isMagician: job.attackType === 'magical', stats: finalStats }),
          magicUp,
          isBoss,
        )
      : null

    content = (
      <>
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <Button size="small" variant={powerUp ? 'contained' : 'outlined'} onClick={() => setPowerUp((v) => !v)} sx={{ flex: 1, py: 0.25 }}>
            파워업
          </Button>
          <Button size="small" variant={magicUp ? 'contained' : 'outlined'} onClick={() => setMagicUp((v) => !v)} sx={{ flex: 1, py: 0.25 }}>
            매직업
          </Button>
        </Box>
        <Divider sx={{ mb: 0.5 }} />
        <DmgRow label="물리 접촉" range={phys} />
        {magic && <DmgRow label="마법 피격" range={magic} />}
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
          ※ 메소가드·속성저항 등 특수스킬 감소는 추후 반영.
        </Typography>
      </>
    )
  }

  return (
    <CollapsiblePanel id="incoming" title="피격 데미지">
      {content}
    </CollapsiblePanel>
  )
}
