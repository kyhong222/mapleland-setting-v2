import { useState, useMemo } from 'react'
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
import { aggregateBuild } from '../../store/aggregate'
import { useActiveEquippedBuilts } from '../../store/activation'
import { useBuffEffects } from '../../store/useBuffEffects'
import { getBuff } from '../../data/buff'
import { buffEffectsAtLevel } from '../../domain/buff'
import type { EffectMap } from '../../domain/effects'
import { JOBS } from '../../domain/jobs'
import { getMonster } from '../../data/mobs'
import { lookupStandardPDD } from '../../data/standardPDD'
import { physicalIncoming, applyDefenses, monsterSkillIncoming } from '../../domain/incomingDamage'
import type { IncomingRange, IncomingType } from '../../domain/incomingDamage'
import { monsterRenderUrl } from '../../domain/monster'

/** 피격 감소에 관여하는 스킬 배지 */
interface DefBadge { id: string; name: string; icon?: string; types: Set<IncomingType> }

const ELEM_TYPES: IncomingType[] = ['fire', 'ice', 'lightning', 'poison']
const ALL_TYPES: IncomingType[] = ['touch', 'physical', 'magic', ...ELEM_TYPES]

/** 버프 효과 → 감소가 적용되는 피격 타입 집합 (reductionMultiplier/mesoAbsorb와 일치) */
function reducedTypes(eff: EffectMap): Set<IncomingType> {
  const s = new Set<IncomingType>()
  const v = (k: keyof EffectMap) => (eff[k] ?? 0) as number
  if (v('damageReflectP') > 0) s.add('touch') // 파워가드
  if (v('damageReduce') > 0) ALL_TYPES.forEach((t) => s.add(t)) // 아킬레스(전사)/메소가드(도적)
  if (v('physicalRes') > 0) { s.add('touch'); s.add('physical') }
  if (v('allRes') > 0) ELEM_TYPES.forEach((t) => s.add(t)) // 엘리멘탈 레지스턴스
  if (v('fireRes') > 0) s.add('fire')
  if (v('coldRes') > 0) s.add('ice')
  if (v('lightningRes') > 0) s.add('lightning')
  if (v('poisonRes') > 0) s.add('poison')
  return s
}

const fmtRange = (r: IncomingRange) => `${r.min.toLocaleString()} ~ ${r.max.toLocaleString()}`

/** 몬스터 스킬 모션(애니메이션) 툴팁 — 호버 시 maplestory.io render GIF 표시 */
function SkillMotion({ mobId, skillKey, children }: { mobId: number; skillKey: string; children: ReactNode }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  if (error) return <>{children}</>
  const url = monsterRenderUrl(mobId, skillKey)
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
              if (img.src.includes('/gms/82/')) img.src = `https://maplestory.io/api/gms/200/mob/${mobId}/render/${skillKey}`
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

/** 피격 행에 영향을 주는 스킬 아이콘들 */
function DefIcons({ badges }: { badges: DefBadge[] }) {
  if (!badges.length) return null
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
      {badges.map((b) => (
        <Tooltip key={b.id} title={b.name} placement="top" arrow disableInteractive>
          <Box
            component="img"
            src={b.icon}
            alt={b.name}
            sx={{ width: 16, height: 16, imageRendering: 'pixelated', display: 'block' }}
          />
        </Tooltip>
      ))}
    </Box>
  )
}

function DmgRow({ label, range, badges }: { label: ReactNode; range: IncomingRange; badges?: DefBadge[] }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1, py: 0.25, gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary" component="div">{label}</Typography>
        {badges && <DefIcons badges={badges} />}
      </Box>
      <Typography variant="body2" sx={{ fontWeight: 700, color: 'error.main', whiteSpace: 'nowrap' }}>{fmtRange(range)}</Typography>
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
  const activeBuffs = useBuildStore((s) => s.activeBuffs)
  const appliedBuffs = useBuildStore((s) => s.appliedBuffs)
  const buffEffects = useBuffEffects()
  const builts = useActiveEquippedBuilts()
  const [powerUp, setPowerUp] = useState(false)
  const [magicUp, setMagicUp] = useState(false)

  const monster = selectedMobId != null ? getMonster(selectedMobId) : undefined

  // 활성 버프 중 피격 감소에 관여하는 스킬 → 배지 목록
  const defBadges = useMemo<DefBadge[]>(() => {
    const out: DefBadge[] = []
    const add = (id: string, lv: number) => {
      const b = getBuff(id)
      if (!b) return
      const types = reducedTypes(buffEffectsAtLevel(b, lv))
      if (types.size) out.push({ id, name: b.name, icon: b.icon, types })
    }
    for (const [id, lv] of Object.entries(activeBuffs)) add(id, lv)
    for (const [id, lv] of Object.entries(appliedBuffs)) add(id, lv)
    return out
  }, [activeBuffs, appliedBuffs])
  const badgesFor = (type: IncomingType) => defBadges.filter((b) => b.types.has(type))

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
        <DmgRow label="물리 접촉" range={phys} badges={badgesFor('touch')} />

        {skills.length > 0 && (
          <>
            <Divider sx={{ my: 0.5 }} />
            <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', px: 1 }}>스킬 (호버 시 모션)</Typography>
            {skills.map((e) => (
              <DmgRow
                key={e.key}
                label={<SkillMotion mobId={monster.id} skillKey={e.key}>{e.label}</SkillMotion>}
                range={e.range}
                badges={badgesFor(e.type)}
              />
            ))}
          </>
        )}
      </>
    )
  }

  return (
    <CollapsiblePanel id="incoming" title="피격 데미지">
      {content}
    </CollapsiblePanel>
  )
}
