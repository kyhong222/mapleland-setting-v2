import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import CollapsiblePanel from '../common/CollapsiblePanel'
import { useBuildStore } from '../../store/buildStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { useMonsterStore } from '../../store/monsterStore'
import { aggregateBuild, equippedWeaponType } from '../../store/aggregate'
import { useActiveEquippedBuilts } from '../../store/activation'
import { useBuffEffects } from '../../store/useBuffEffects'
import {
  totalAttack, totalMagic, masteryRatio, calcPhysical, calcLuckySeven,
  calcPhysicalRatios, calcLuckyRatio,
  levelPenalty, physicalVsMonster,
} from '../../domain/attackPower'
import type { AtkStatRatio, DamageRange } from '../../domain/attackPower'
import { WEAPON_CONSTANTS } from '../../domain/weapons'
import { JOBS } from '../../domain/jobs'
import type { StatId } from '../../domain/stats'
import { getMonster } from '../../data/mobs'

// ── 스킬 데미지 섹션 (임시 비활성) — 복원 시 아래 import/상태/계산/렌더 주석 해제 ──
// import { useState } from 'react'
// import type { SyntheticEvent } from 'react'
// import Select from '@mui/material/Select'
// import MenuItem from '@mui/material/MenuItem'
// import TextField from '@mui/material/TextField'
// import { calcMagic, magicAmpMultiplier, scaleDamage } from '../../domain/attackPower'
// import { computeSkillDamage } from '../../domain/damage'
// import { elementReaction } from '../../domain/monster'
// import { attackSkillsForJob, skillAttackAt } from '../../data/skills'

const fmtRange = (r: DamageRange) => `${r.min.toLocaleString()} ~ ${r.max.toLocaleString()}`
const STAT_SHORT: Record<StatId, string> = { STR: '힘', DEX: '덱', INT: '인', LUK: '럭' }
// const ELEM_KO: Record<string, string> = { F: '불', I: '얼음', L: '번개', S: '독', H: '성' }
// const REACTION_KO: Record<string, string> = { weak: '약점 1.5×', half: '반감 0.5×', immune: '무효 0×', none: '' }
// const skillIconSrc = (id: number) => `/skill-icons/${id}.png`
// const hideOnError = (e: SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.visibility = 'hidden' }

export default function AttackPanel() {
  const jobId = useBuildStore((s) => s.jobId)
  const level = useBuildStore((s) => s.level)
  const baseStats = useBuildStore((s) => s.baseStats)
  const equipped = useBuildStore((s) => s.equipped)
  const invItems = useInventoryStore((s) => s.items)
  const selectedMobId = useMonsterStore((s) => s.selectedId)

  // const [skillId, setSkillId] = useState<number | ''>('')
  // const [skillLevel, setSkillLevel] = useState(1)

  const { finalStats, effects } = aggregateBuild(baseStats, useActiveEquippedBuilts(), useBuffEffects())
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

  // vs 몬스터 물리 실질 데미지 (일반 공격 기준)
  const monster = selectedMobId != null ? getMonster(selectedMobId) : undefined
  const D = monster ? levelPenalty(monster.level, level) : 0
  const physVs = phys && monster ? physicalVsMonster(phys.display, monster.PDDamage ?? 0, D) : null

  /* ── 스킬 데미지 (10단계 파이프라인) — 임시 비활성 ──
  const ampMult = magicAmpMultiplier(effects)
  const critRate = effects.criticalP ?? 0
  const critDamage = effects.criticalDamage ?? 0
  const attackSkills = jobId ? attackSkillsForJob(jobId) : []
  const selectedSkill = attackSkills.find((s) => s.id === skillId)
  const skillResult = (() => {
    if (!selectedSkill) return null
    const att = skillAttackAt(selectedSkill, skillLevel)
    if (!att) return null
    const base = att.kind === 'magic'
      ? scaleDamage(calcMagic(matk, finalStats.INT, att.spellAtk, mastery), ampMult)
      : phys?.display
    if (!base) return null
    const reaction = elementReaction(monster?.elemAttr, att.element)
    const defense = monster
      ? { kind: att.kind, def: att.kind === 'magic' ? monster.MDDamage ?? 0 : monster.PDDamage ?? 0, levelPenalty: D }
      : undefined
    const critBonus = critRate > 0 ? critDamage : 0
    return { att, reaction, result: computeSkillDamage({ base, element: reaction, defense, skillPercent: att.skillPercent, critBonus }) }
  })()
  */

  return (
    <CollapsiblePanel id="attack" title="공격력 계산">
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
        <Row label="주스탯" value={primary.toLocaleString()} />
        <Row label={isMagic ? '총 마력' : '총 공격력'} value={(isMagic ? matk : watk).toLocaleString()} />
        <Row label="숙련도" value={`${Math.round(mastery * 100)}%`} />
      </Box>

      {isMagic ? null : !weaponType ? (
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

      {monster && physVs && (
        <>
          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.25 }}>
            실질 데미지 vs {monster.koreanName || monster.name}
          </Typography>
          <DmgRow label="물리 실질" range={physVs} strong />
        </>
      )}

      {/* ── 스킬 데미지 섹션 (임시 비활성) — 복원 시 위 계산/import와 함께 주석 해제 ──
      {attackSkills.length > 0 && (
        <>
          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>스킬 데미지</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>
            <Select<number | ''>
              size="small" displayEmpty value={skillId}
              onChange={(e) => {
                const raw = e.target.value
                const id = raw === '' ? '' : Number(raw)
                setSkillId(id)
                const sk = attackSkills.find((s) => s.id === id)
                if (sk) setSkillLevel(sk.masterLevel)
              }}
              sx={{ flexGrow: 1, fontSize: 13 }}
            >
              <MenuItem value=""><em>스킬 선택</em></MenuItem>
              {attackSkills.map((s) => (
                <MenuItem key={s.id} value={s.id} sx={{ fontSize: 13, gap: 1 }}>
                  <Box component="img" src={skillIconSrc(s.id)} alt="" onError={hideOnError} sx={{ width: 28, height: 28, flexShrink: 0, imageRendering: 'pixelated' }} />
                  {s.description?.name ?? s.id}
                </MenuItem>
              ))}
            </Select>
            {selectedSkill && (
              <TextField
                size="small" type="number" label="Lv" value={skillLevel}
                onChange={(e) => setSkillLevel(Math.max(1, Math.min(selectedSkill.masterLevel, Number(e.target.value) || 1)))}
                slotProps={{ htmlInput: { style: { width: 44, textAlign: 'center' }, min: 1, max: selectedSkill.masterLevel } }}
              />
            )}
          </Box>
          {skillResult && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1, py: 0.25, gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                  {selectedSkill && <Box component="img" src={skillIconSrc(selectedSkill.id)} alt="" onError={hideOnError} sx={{ width: 32, height: 32, flexShrink: 0, imageRendering: 'pixelated' }} />}
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {selectedSkill?.description?.name} ({skillResult.att.kind === 'magic' ? `마력계수 ${skillResult.att.spellAtk}` : `${skillResult.att.skillPercent}%`})
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main', whiteSpace: 'nowrap' }}>{fmtRange(skillResult.result.normal)}</Typography>
              </Box>
              {skillResult.result.critical && <DmgRow label={`크리티컬 (확률 ${critRate}%)`} range={skillResult.result.critical} />}
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', px: 1 }}>
                속성: {skillResult.att.element ? ELEM_KO[skillResult.att.element] ?? skillResult.att.element : '무속성'}
                {monster && skillResult.reaction !== 'none' ? ` (${REACTION_KO[skillResult.reaction]})` : ''}
                {critRate > 0 ? ` · 크리 +${critDamage}%` : ''}
                {monster ? ` · 방어 반영` : ' · 방어 미반영'}
              </Typography>
            </>
          )}
        </>
      )}
      */}
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
    <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1, py: 0.25, gap: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: strong ? 700 : 500, color: strong ? 'primary.main' : 'text.primary', whiteSpace: 'nowrap' }}>
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
