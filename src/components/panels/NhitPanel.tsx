import { useState } from 'react'
import type { SyntheticEvent } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import CollapsiblePanel from '../common/CollapsiblePanel'
import { useBuildStore } from '../../store/buildStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { useMonsterStore } from '../../store/monsterStore'
import { aggregateBuild, equippedWeaponType } from '../../store/aggregate'
import { useActiveEquippedBuilts } from '../../store/activation'
import { useBuffEffects } from '../../store/useBuffEffects'
import {
  totalAttack, totalMagic, masteryRatio, magicAmpMultiplier, levelPenalty,
} from '../../domain/attackPower'
import { JOBS } from '../../domain/jobs'
import { getMonster } from '../../data/mobs'
import { elementReaction } from '../../domain/monster'
import { attackSkillsForJob, skillAttackAt, skillLineCount, comboFinalDamageP, COMBO_SKILLS } from '../../data/skills'
import { computeCast, computeNhit, computeDpm, baseElementMult, SKILL_MOTION } from '../../domain/skillCombat'
import { attacksPerMinute } from '../../data/attackSpeed'
import { chargeElementMult, CHARGE_MASTER, CHARGE_LABEL, CHARGE_ELEMENTS } from '../../domain/paladinCharge'
import type { ChargeElement } from '../../domain/paladinCharge'

const skillIconSrc = (id: number) => `/skill-icons/${id}.png`
const hideOnError = (e: SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.visibility = 'hidden' }
const pct = (n: number) => `${(n * 100).toFixed(1)}%`
/** 공속 단계(2~9) → 한글 라벨 (docs §12.0) */
const speedLabel = (step: number): string =>
  step <= 3 ? '매우 빠름' : step <= 5 ? '빠름' : step === 6 ? '보통' : step <= 8 ? '느림' : '매우 느림'
const rng = (r: { min: number; max: number }) => `${Math.round(r.min).toLocaleString()} ~ ${Math.round(r.max).toLocaleString()}`

export default function NhitPanel() {
  const jobId = useBuildStore((s) => s.jobId)
  const level = useBuildStore((s) => s.level)
  const baseStats = useBuildStore((s) => s.baseStats)
  const equipped = useBuildStore((s) => s.equipped)
  const invItems = useInventoryStore((s) => s.items)
  const selectedMobId = useMonsterStore((s) => s.selectedId)
  const activeBuffs = useBuildStore((s) => s.activeBuffs)
  const buffEffects = useBuffEffects()
  const builts = useActiveEquippedBuilts()

  const [skillId, setSkillId] = useState<number | ''>('')
  const [skillLevel, setSkillLevel] = useState(1)
  // 팔라딘 차지 (속성 부여)
  const [chargeMain, setChargeMain] = useState<ChargeElement | ''>('')
  const [chargeLevel, setChargeLevel] = useState(30)
  const [thunderStack, setThunderStack] = useState(false)
  const [thunderLevel, setThunderLevel] = useState(30)

  const { finalStats, effects } = aggregateBuild(baseStats, builts, buffEffects)
  const job = jobId ? JOBS[jobId] : null
  const monster = selectedMobId != null ? getMonster(selectedMobId) : undefined
  const weaponType = equippedWeaponType(equipped, invItems)
  const attackSkills = jobId ? attackSkillsForJob(jobId) : []
  const selectedSkill = attackSkills.find((s) => s.id === skillId)

  const weaponSpeedStep = (() => {
    const id = equipped.weapon
    const w = id ? invItems.find((i) => i.id === id)?.built : undefined
    return w?.base.effects.attackSpeed ?? 6
  })()

  const result = (() => {
    if (!job || !monster || !selectedSkill) return null
    const att = skillAttackAt(selectedSkill, skillLevel)
    if (!att) return null
    const isMagic = att.kind === 'magic'
    if (!isMagic && !weaponType) return null

    // 크리는 기대값으로 스킬%에 합성(= skillPercent + 크리확률×크리추뎀)
    const critP = effects.criticalP ?? 0
    const critDmg = effects.criticalDamage ?? 0
    const effSkillPercent = att.skillPercent + (critP / 100) * critDmg

    // 속성 반응 — 팔라딘 차지 활성 시 차지 속성/레벨 배율로 대체(물리 한정)
    const chargeActive = jobId === 'paladin' && chargeMain !== '' && !isMagic
    const elementMult = chargeActive
      ? chargeElementMult(
          { main: chargeMain, mainLevel: chargeLevel, thunderLevel: thunderStack && chargeMain !== 'lightning' ? thunderLevel : null },
          monster.elemAttr,
        )
      : baseElementMult(elementReaction(monster.elemAttr, att.element))

    // 방어
    const D = levelPenalty(monster.level, level)
    const defense = isMagic
      ? { kind: 'magic' as const, def: monster.MDDamage ?? 0, levelPenalty: D }
      : { kind: 'physical' as const, def: monster.PDDamage ?? 0, levelPenalty: D }

    // 콤보 어택: 콤보+어드밴스드 레벨의 결합공식(별도 합산)
    const cs = jobId ? COMBO_SKILLS[jobId] : undefined
    const comboBonus = cs
      ? comboFinalDamageP(cs.combo, activeBuffs[String(cs.combo)] ?? 0, cs.adv, activeBuffs[String(cs.adv)] ?? 0)
      : 0
    // 자기 데미지증가버프(버서크 등 finalDamageP + 콤보) — 합연산
    const finalMult = 1 + ((effects.finalDamageP ?? 0) + comboBonus) / 100
    // 위협(파티 디버프: 몬스터 받는 데미지 +%) — 곱연산 중첩
    const threatenMult = 1 + (effects.monsterDamageTakenP ?? 0) / 100
    const damageMult = (isMagic ? magicAmpMultiplier(effects) : 1) * finalMult * threatenMult

    const cast = computeCast({
      weaponType: weaponType ?? 'oneHandedSword',
      skillId: selectedSkill.id,
      attackCount: skillLineCount(selectedSkill, skillLevel),
      kind: att.kind,
      primary: job ? finalStats[job.primaryStat] : 0,
      secondary: job ? job.secondaryStats.reduce((a, s) => a + finalStats[s], 0) : 0,
      watk: totalAttack(effects),
      mastery: masteryRatio(effects),
      magic: totalMagic(effects, finalStats.INT),
      int: finalStats.INT,
      spellAtk: att.spellAtk,
      elementMult,
      defense,
      skillPercent: effSkillPercent,
      damageMult,
      critFactor: 1,
    })
    if (!cast) return { unsupported: true as const }

    const hp = monster.maxHP ?? 0
    const isBoss = !!monster.isBoss
    // 부스터 = 개인/파티 버프의 공속상승단계(attackSpeedBoost). 마법은 부스터 활성 여부만 사용
    const boosterSteps = effects.attackSpeedBoost ?? 0
    const magicBooster = boosterSteps > 0
    const effStep = Math.max(2, Math.min(9, weaponSpeedStep - boosterSteps))
    const apm = attacksPerMinute(selectedSkill.id, weaponSpeedStep, boosterSteps, att.kind, magicBooster)
    const dpm = apm != null ? computeDpm(cast.dist, apm) : null
    const killSec = dpm && dpm > 0 && hp > 0 ? hp / (dpm / 60) : null
    return {
      unsupported: false as const,
      isBoss,
      hp,
      lines: cast.lineRanges.length,
      lineRange: {
        min: Math.min(...cast.lineRanges.map((r) => r.min)),
        max: Math.max(...cast.lineRanges.map((r) => r.max)),
      },
      totalRange: cast.totalRange,
      nhit: isBoss ? null : computeNhit(cast.dist, hp, 10),
      apm, dpm, killSec, isMagic, effStep, boosterActive: magicBooster,
    }
  })()

  return (
    <CollapsiblePanel id="nhit" title="데미지 계산">
      {!jobId ? (
        <Typography variant="body2" color="text.disabled">직업을 선택하세요.</Typography>
      ) : !monster ? (
        <Typography variant="body2" color="text.disabled">대상 몬스터를 선택하세요.</Typography>
      ) : attackSkills.length === 0 ? (
        <Typography variant="body2" color="text.disabled">공격 스킬이 없습니다.</Typography>
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
            <Select<number | ''>
              size="small" displayEmpty value={skillId}
              onChange={(e) => {
                const id = e.target.value === '' ? '' : Number(e.target.value)
                setSkillId(id)
                const sk = attackSkills.find((s) => s.id === id)
                if (sk) setSkillLevel(sk.masterLevel)
              }}
              sx={{ flexGrow: 1, fontSize: 13 }}
            >
              <MenuItem value=""><em>스킬 선택</em></MenuItem>
              {attackSkills.map((s) => (
                <MenuItem key={s.id} value={s.id} sx={{ fontSize: 13, gap: 1 }}>
                  <Box component="img" src={skillIconSrc(s.id)} alt="" onError={hideOnError} sx={{ width: 24, height: 24, imageRendering: 'pixelated' }} />
                  {s.description?.name ?? s.id}
                  {SKILL_MOTION[s.id] && <Box component="span" sx={{ fontSize: 10, color: 'text.disabled' }}>*</Box>}
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

          {jobId === 'paladin' && (
            <Box sx={{ display: 'flex', gap: 0.5, mb: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary">차지</Typography>
              <Select<ChargeElement | ''>
                size="small" displayEmpty value={chargeMain}
                onChange={(e) => {
                  const v = e.target.value as ChargeElement | ''
                  setChargeMain(v)
                  if (v) setChargeLevel(CHARGE_MASTER[v])
                }}
                sx={{ fontSize: 12, minWidth: 88 }}
              >
                <MenuItem value=""><em>없음</em></MenuItem>
                {CHARGE_ELEMENTS.map((el) => (
                  <MenuItem key={el} value={el} sx={{ fontSize: 12 }}>{CHARGE_LABEL[el]}</MenuItem>
                ))}
              </Select>
              {chargeMain && (
                <TextField
                  size="small" type="number" label="Lv" value={chargeLevel}
                  onChange={(e) => setChargeLevel(Math.max(1, Math.min(CHARGE_MASTER[chargeMain], Number(e.target.value) || 1)))}
                  slotProps={{ htmlInput: { style: { width: 40, textAlign: 'center' }, min: 1, max: CHARGE_MASTER[chargeMain] } }}
                />
              )}
              {chargeMain && chargeMain !== 'lightning' && (
                <>
                  <FormControlLabel
                    sx={{ m: 0 }}
                    control={<Switch size="small" checked={thunderStack} onChange={(e) => setThunderStack(e.target.checked)} />}
                    label={<Typography variant="caption">썬더중첩</Typography>}
                  />
                  {thunderStack && (
                    <TextField
                      size="small" type="number" label="썬더Lv" value={thunderLevel}
                      onChange={(e) => setThunderLevel(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                      slotProps={{ htmlInput: { style: { width: 40, textAlign: 'center' }, min: 1, max: 30 } }}
                    />
                  )}
                </>
              )}
            </Box>
          )}

          {result === null ? (
            <Typography variant="body2" color="text.disabled">스킬을 선택하세요.</Typography>
          ) : result.unsupported ? (
            <Typography variant="body2" color="warning.main">이 스킬은 아직 지원하지 않습니다.</Typography>
          ) : (
            <>
              {/* 데미지 범위 */}
              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>데미지 범위</Typography>
              {result.lines > 1 && <Row label={`1회 타격 (${result.lines}타)`} value={rng(result.lineRange)} />}
              <Row label={result.lines > 1 ? '총 데미지' : '데미지'} value={rng(result.totalRange)} strong />

              {/* 방컷 확률 (비보스) */}
              {result.nhit && (
                <>
                  <Divider sx={{ my: 0.75 }} />
                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.25 }}>
                    방컷 확률 (HP {result.hp.toLocaleString()})
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.25 }}>
                    {result.nhit.exact.map((p, i) => (p >= 0.0005 ? <Row key={i} label={`${i + 1}방`} value={pct(p)} /> : null))}
                    {result.nhit.over >= 0.0005 && <Row label="11방+" value={pct(result.nhit.over)} />}
                  </Box>
                  <Row label="기대 처치 타수" value={`${result.nhit.meanHits.toFixed(2)}방`} strong />
                </>
              )}

              {/* DPM */}
              <Divider sx={{ my: 0.75 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>DPM</Typography>
                <Typography variant="caption" color="text.secondary">
                  공격속도 {result.isMagic ? (result.boosterActive ? '매직부스터' : '노말') : `${result.effStep}단계 (${speedLabel(result.effStep)})`}
                </Typography>
              </Box>
              {result.dpm != null ? (
                <>
                  <Row label="DPM" value={Math.round(result.dpm).toLocaleString()} strong />
                  <Row label="분당 공격횟수" value={`${result.apm}회`} />
                  {result.isBoss && result.killSec != null && <Row label="처치 소요(참고)" value={`${result.killSec.toFixed(1)}초`} />}
                </>
              ) : (
                <Typography variant="body2" color="text.disabled">공속 데이터가 없습니다.</Typography>
              )}
            </>
          )}
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
            ※ 크리·속성·방어·특화버프(콤보/버서크)·위협·팔라딘 차지 반영. (* = 고유 모션)
          </Typography>
        </>
      )}
    </CollapsiblePanel>
  )
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1, py: 0.1 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: strong ? 700 : 500, color: strong ? 'error.main' : 'text.primary' }}>{value}</Typography>
    </Box>
  )
}
