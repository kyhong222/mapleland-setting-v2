import { useState } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import CollapsiblePanel from '../common/CollapsiblePanel'
import { useBuildStore } from '../../store/buildStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { useMonsterStore } from '../../store/monsterStore'
import InfoTip, { InfoTitle, InfoWarn } from '../common/InfoTip'
import { aggregateBuild } from '../../store/aggregate'
import { useActiveEquippedBuilts } from '../../store/activation'
import { useBuffEffects } from '../../store/useBuffEffects'
import { JOBS } from '../../domain/jobs'
import { getMonster } from '../../data/mobs'
import { lookupStandardPDD } from '../../data/standardPDD'
import { physicalIncoming, applyDefenses, monsterSkillIncoming } from '../../domain/incomingDamage'
import type { IncomingRange } from '../../domain/incomingDamage'

const fmtRange = (r: IncomingRange) => `${r.min.toLocaleString()} ~ ${r.max.toLocaleString()}`

/** 몬스터 스킬 모션(애니메이션) 툴팁 — 호버 시 maplestory.io render GIF 표시 */
function SkillMotion({ mobId, skillKey, children }: { mobId: number; skillKey: string; children: ReactNode }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  if (error) return <>{children}</>
  const url = `https://maplestory.io/api/gms/62/mob/${mobId}/render/${skillKey}`
  return (
    <Tooltip
      placement="left"
      arrow
      slotProps={{ tooltip: { sx: { bgcolor: 'rgba(20,20,20,0.95)', p: 1, maxWidth: 'none' } } }}
      title={
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 48, minHeight: 48 }}>
          {!loaded && <CircularProgress size={18} sx={{ color: '#fff' }} />}
          <img
            src={url}
            alt={skillKey}
            style={{ maxWidth: 200, maxHeight: 200, display: loaded ? 'block' : 'none' }}
            onLoad={() => setLoaded(true)}
            onError={(e) => {
              const img = e.currentTarget
              if (img.src.includes('/gms/62/')) img.src = `https://maplestory.io/api/gms/200/mob/${mobId}/render/${skillKey}`
              else setError(true)
            }}
          />
        </Box>
      }
    >
      <Box component="span" sx={{ cursor: 'help', textDecorationLine: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 2 }}>
        {children}
      </Box>
    </Tooltip>
  )
}

function DmgRow({ label, range }: { label: ReactNode; range: IncomingRange }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1, py: 0.25 }}>
      <Typography variant="body2" color="text.secondary" component="div">{label}</Typography>
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
  const builts = useActiveEquippedBuilts()
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
    const { finalStats, effects } = aggregateBuild(baseStats, builts, buffEffects)
    const isBoss = !!monster.isBoss
    const isWarrior = job.classId === 'warrior'
    const isMagician = job.attackType === 'magical'
    const pdd = effects.pdef ?? 0
    const mdd = (effects.mdef ?? 0) + finalStats.INT
    const stdPdd = lookupStandardPDD(job.classId, level)

    const def = { effects, jobClass: job.classId, isBoss, powerUp, magicUp }
    const phys = applyDefenses(
      physicalIncoming({ monsterAtt: monster.PADamage ?? 0, charLevel: level, monLevel: monster.level, pdd, stdPdd, isWarrior, stats: finalStats }),
      { ...def, type: 'touch' },
    )

    const skills = monster.skills
      ? monsterSkillIncoming({
          skills: monster.skills,
          monsterMatt: monster.MADamage ?? 0,
          charLevel: level, monLevel: monster.level, pdd, stdPdd, mdd, isWarrior, isMagician, stats: finalStats,
        }).map((e) => ({ ...e, range: applyDefenses(e.range, { ...def, type: e.type }) }))
      : []

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

        {skills.length > 0 && (
          <>
            <Divider sx={{ my: 0.5 }} />
            <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', px: 1 }}>스킬 (호버 시 모션)</Typography>
            {skills.map((e) => (
              <DmgRow
                key={e.key}
                label={<SkillMotion mobId={monster.id} skillKey={e.key}>{e.label}</SkillMotion>}
                range={e.range}
              />
            ))}
          </>
        )}

        <Typography variant="caption" color="text.disabled" sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
          ※ 파워가드·아킬레스·속성저항·메소가드 감소가 반영된 수치입니다.
          <InfoTip
            title={
              <>
                <InfoTitle>피격 감소 적용 규칙</InfoTitle>
                <Box>· 파워가드: <b>물리 접촉에만</b> 적용, 보스는 효율 <b>50%</b></Box>
                <Box>· 아킬레스(전사): 전 타입</Box>
                <Box>· 엘리멘탈/파셜 레지스턴스: 해당 속성 타입</Box>
                <Box>· 메소가드(도적): 감소 후 데미지의 50% 흡수</Box>
                <InfoWarn>
                  파워가드는 몬스터 <b>스킬</b> 피격에는 적용되지 않습니다(접촉 전용).
                  보스는 스킬 피격 비중이 커서 감소가 없어 보일 수 있습니다.
                </InfoWarn>
              </>
            }
          />
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
