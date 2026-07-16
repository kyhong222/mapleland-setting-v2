import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import CollapsiblePanel from '../common/CollapsiblePanel'
import { useBuildStore } from '../../store/buildStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { useMonsterStore } from '../../store/monsterStore'
import { aggregateBuild, equippedBuilts, equippedWeaponType } from '../../store/aggregate'
import { useBuffEffects } from '../../store/useBuffEffects'
import {
  totalAttack, totalMagic, masteryRatio, calcPhysical, calcLuckySeven, calcMagic,
  calcPhysicalRatios, calcLuckyRatio, calcMagicRatio,
  levelPenalty, physicalVsMonster, magicVsMonster,
} from '../../domain/attackPower'
import type { AtkStatRatio, DamageRange } from '../../domain/attackPower'
import { WEAPON_CONSTANTS } from '../../domain/weapons'
import { JOBS } from '../../domain/jobs'
import type { StatId } from '../../domain/stats'
import { getMonster } from '../../data/mobs'

const fmtRange = (r: DamageRange) => `${r.min.toLocaleString()} ~ ${r.max.toLocaleString()}`
const STAT_SHORT: Record<StatId, string> = { STR: '힘', DEX: '덱', INT: '인', LUK: '럭' }

export default function AttackPanel() {
  const jobId = useBuildStore((s) => s.jobId)
  const level = useBuildStore((s) => s.level)
  const baseStats = useBuildStore((s) => s.baseStats)
  const equipped = useBuildStore((s) => s.equipped)
  const invItems = useInventoryStore((s) => s.items)
  const selectedMobId = useMonsterStore((s) => s.selectedId)

  const { finalStats, effects } = aggregateBuild(baseStats, equippedBuilts(equipped, invItems), useBuffEffects())
  const job = jobId ? JOBS[jobId] : null
  const weaponType = equippedWeaponType(equipped, invItems)

  const primary = job ? finalStats[job.primaryStat] : 0
  const secondary = job ? job.secondaryStats.reduce((a, s) => a + finalStats[s], 0) : 0
  const watk = totalAttack(effects)
  const matk = totalMagic(effects, finalStats.INT)
  const mastery = masteryRatio(effects)
  const statLabel = job ? STAT_SHORT[job.primaryStat] : '스탯'

  const isMagic = job?.attackType === 'magical'
  const phys = !isMagic && weaponType ? calcPhysical(primary, secondary, weaponType, watk, mastery) : null
  const physRatios = !isMagic && weaponType ? calcPhysicalRatios(primary, secondary, weaponType, watk, mastery) : null
  const hasSwingStab = weaponType ? WEAPON_CONSTANTS[weaponType].constMin !== WEAPON_CONSTANTS[weaponType].constMax : false
  const lucky = weaponType === 'claw' ? calcLuckySeven(finalStats.LUK, watk) : null
  const luckyRatio = weaponType === 'claw' ? calcLuckyRatio(finalStats.LUK, watk) : null

  // 마법: 스킬 미선택 기준 base 실질 마법 데미지(계수 1)
  const magic = isMagic ? calcMagic(matk, finalStats.INT, 1, mastery) : null
  const magicRatio = isMagic ? calcMagicRatio(matk, mastery) : null

  // vs 몬스터 실질 데미지
  const monster = selectedMobId != null ? getMonster(selectedMobId) : undefined
  const D = monster ? levelPenalty(monster.level, level) : 0
  const physVs = phys && monster ? physicalVsMonster(phys.display, monster.PDDamage ?? 0, D) : null
  const magicVs = magic && monster ? magicVsMonster(magic, monster.MDDamage ?? 0, D) : null

  return (
    <CollapsiblePanel id="attack" title="공격력 계산">
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
        <Row label="주스탯" value={primary.toLocaleString()} />
        <Row label={isMagic ? '총 마력' : '총 공격력'} value={(isMagic ? matk : watk).toLocaleString()} />
        <Row label="숙련도" value={`${Math.round(mastery * 100)}%`} />
      </Box>

      {isMagic ? (
        <>
          <Divider sx={{ my: 1 }} />
          {magic && (
            <>
              <DmgRow label="실질 마법 데미지" range={magic} strong />
              <RatioText ratio={magicRatio} statLabel="인" atkLabel="마력" digits={3} />
            </>
          )}
        </>
      ) : !weaponType ? (
        <>
          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" color="text.disabled">무기를 장착하세요.</Typography>
        </>
      ) : (
        phys && physRatios && (
          <>
            <Divider sx={{ my: 1 }} />
            <DmgRow label="표기 데미지" range={phys.display} strong />
            <RatioText ratio={physRatios.display} statLabel={statLabel} />
            {hasSwingStab && (
              <>
                <DmgRow label="베기" range={phys.swing} />
                <RatioText ratio={physRatios.swing} statLabel={statLabel} />
                <DmgRow label="찌르기" range={phys.stab} />
                <RatioText ratio={physRatios.stab} statLabel={statLabel} />
              </>
            )}
            {lucky && (
              <>
                <DmgRow label="럭키세븐/트리플스로우" range={lucky} />
                {luckyRatio && <RatioText ratio={luckyRatio} statLabel={statLabel} />}
              </>
            )}
          </>
        )
      )}

      {monster && (physVs || magicVs) && (
        <>
          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.25 }}>
            실질 데미지 vs {monster.koreanName || monster.name}
          </Typography>
          {physVs && <DmgRow label="물리 실질" range={physVs} strong />}
          {magicVs && <DmgRow label="마법 실질" range={magicVs} strong />}
        </>
      )}
    </CollapsiblePanel>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{value}</Typography>
    </Box>
  )
}

function DmgRow({ label, range, strong = false }: { label: string; range: DamageRange; strong?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1, py: 0.25 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: strong ? 700 : 500, color: strong ? 'primary.main' : 'text.primary' }}>
        {fmtRange(range)}
      </Typography>
    </Box>
  )
}

/** 공탯비 캡션: 1공 = X스탯 · 1스탯 = Y공 */
function RatioText({ ratio, statLabel, atkLabel = '공', digits = 2 }: { ratio: AtkStatRatio | null; statLabel: string; atkLabel?: string; digits?: number }) {
  if (!ratio || !ratio.atkToStat) return null
  return (
    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'right', px: 1 }}>
      1{atkLabel} = {ratio.atkToStat.toFixed(digits)}{statLabel} · 1{statLabel} = {ratio.statToAtk.toFixed(digits)}{atkLabel}
    </Typography>
  )
}
