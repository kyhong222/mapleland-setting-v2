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
  totalAttack, totalMagic, masteryRatio, magicAmpMultiplier, levelPenalty, calcLuckyBase,
} from '../../domain/attackPower'
import { JOBS } from '../../domain/jobs'
import { getMonster } from '../../data/mobs'
import { elementReaction } from '../../domain/monster'
import { attackSkillsForJob, skillAttackAt, skillLineCount, comboFinalDamageP, COMBO_SKILLS, findSkillById, skillNumAt } from '../../data/skills'
import type { ChargeState } from '../../domain/paladinCharge'
import { computeCast, computeNhit, computeDpm, baseElementMult, SKILL_MOTION } from '../../domain/skillCombat'
import { attacksPerMinute } from '../../data/attackSpeed'
import { chargeElementMult, chargeMultiplier, chargeFromUi } from '../../domain/paladinCharge'

const skillIconSrc = (id: number) => `/skill-icons/${id}.png`
const hideOnError = (e: SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.visibility = 'hidden' }
const pct = (n: number) => `${(n * 100).toFixed(1)}%`
/** 공속 단계(2~9) → 한글 라벨 (docs §12.0) */
const speedLabel = (step: number): string =>
  step <= 3 ? '매우 빠름' : step <= 5 ? '빠름' : step === 6 ? '보통' : step <= 8 ? '느림' : '매우 느림'

/** 패닉/코마(검·도끼/둔기, 히어로·소마) — 콤보 카운터 전량 소모형 */
const COMA_PANIC = new Set([1111003, 1111004, 1111005, 1111006, 11111002, 11111003])
/** 돌진(히어로·팔라딘·다크나이트) — 후딜레이가 커 방컷/DPM이 무의미 */
const RUSH = new Set([1121006, 1221007, 1321003])
/** 방컷·DPM 미제공(데미지 범위만): 패닉/코마 + 돌진 */
const NO_DPM = new Set([...COMA_PANIC, ...RUSH])
/** 럭키세븐/트리플스로우(나로·나워) — LUK 전용 예외식(부스탯·숙련 없음) */
const LUCKY_SKILLS = new Set([4001344, 14001004, 4121007, 14111005])
/** 최대 콤보 카운터(5~10) 소모 시 카운터 뎀증 배율 (docs §4) */
const MAX_COUNTER_MULT = 2.5
const rng = (r: { min: number; max: number }) => `${Math.round(r.min).toLocaleString()} ~ ${Math.round(r.max).toLocaleString()}`

export default function NhitPanel() {
  const jobId = useBuildStore((s) => s.jobId)
  const level = useBuildStore((s) => s.level)
  const baseStats = useBuildStore((s) => s.baseStats)
  const equipped = useBuildStore((s) => s.equipped)
  const invItems = useInventoryStore((s) => s.items)
  const selectedMobId = useMonsterStore((s) => s.selectedId)
  const activeBuffs = useBuildStore((s) => s.activeBuffs)
  const chargeState = useBuildStore((s) => s.charge)
  const buffEffects = useBuffEffects()
  const builts = useActiveEquippedBuilts()

  const [skillId, setSkillId] = useState<number | ''>('')
  const [skillLevel, setSkillLevel] = useState(1)

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

    // 차지 블로우(1211002): 어드밴스드 차지(1220010) 학습 시 계수를 어차 값(260~350%)으로 대체
    let effSkillPercent = att.skillPercent
    if (selectedSkill.id === 1211002) {
      const advLv = activeBuffs['1220010'] ?? 0
      const adv = advLv > 0 ? findSkillById(1220010) : undefined
      const advAtt = adv ? skillAttackAt(adv, advLv) : null
      if (advAtt) effSkillPercent = advAtt.skillPercent
    }
    // 크리: 확률 혼합으로 분포에 반영(데미지범위·방컷 정확, DPM은 기대값으로 자동).
    // 확률·데미지는 특화버프(크리티컬 스로우/샷/펀치) + 샤프아이즈의 합연산 = effects.criticalP/criticalDamage.
    //  - 물리: 옛메 합연산 → 크리 시 타격당 +criticalDamage%p
    //  - 마법: 곱연산 → ×(1 + (criticalDamage−100)/100)  (마법사는 내재크리 없이 샤프아이즈만)
    const critChance = effects.criticalP ?? 0
    const critDmgTotal = effects.criticalDamage ?? 0
    let critMult = 1
    if (isMagic) {
      critMult = critDmgTotal > 100 ? 1 + (critDmgTotal - 100) / 100 : 1
    } else {
      critMult = critDmgTotal > 0 && effSkillPercent > 0 ? (effSkillPercent + critDmgTotal) / effSkillPercent : 1
    }
    const critProb = critChance > 0 && critMult > 1 ? critChance / 100 : 0

    // 차지(속성 부여) — 팔라딘(메인/보조) / 소울마스터 소울차지(성속성 단일)
    let charge: ChargeState | null = null
    let chargeCoefMult = 1
    let paladinCharge = false
    if (!isMagic) {
      if (jobId === 'paladin') {
        charge = chargeFromUi(chargeState)
        paladinCharge = !!charge
      } else if (jobId === 'soulMaster') {
        const lv = activeBuffs['11111007'] // 소울 차지(성속성)
        if (lv) {
          charge = { main: 'holy', mainLevel: lv, thunderLevel: null }
          chargeCoefMult = skillNumAt(11111007, lv, 'damage') / 100
        }
      }
    }
    // 속성배율 — 차지 활성 시 차지 속성/레벨 배율로 대체
    // 팔라딘: ORIGINAL_V86 통합 차지배율(속성+계수). 소울마스터: 홀리 단일 반응(계수는 chargeCoefMult 별도)
    let elementMult: number
    if (paladinCharge && charge) {
      elementMult = chargeMultiplier(charge, monster.elemAttr)
    } else if (charge) {
      elementMult = chargeElementMult(charge, monster.elemAttr)
    } else {
      elementMult = baseElementMult(elementReaction(monster.elemAttr, att.element))
    }
    // 엘리멘탈 리셋(플위): 무속성화 blend — elementMult × (1−r) + 1.0 × r (마스터 r=1 → 항상 ×1.0)
    if (jobId === 'flameWizard') {
      const rLv = activeBuffs['12101005']
      if (rLv) {
        const r = Math.min(1, skillNumAt(12101005, rLv, 'x') / 100)
        elementMult = elementMult * (1 - r) + r
      }
    }

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
    // 패닉/코마: 최대 콤보 카운터(5~10) 전량 소모 → 카운터 뎀증 ×2.5 (콤보 활성 시)
    const counterMult = COMA_PANIC.has(selectedSkill.id) && comboBonus > 0 ? MAX_COUNTER_MULT : 1
    // 쉐도우 파트너: 그림자가 스킬 데미지의 y% 추가타 → ×(1 + y/100) (마스터 ×1.5)
    const shadowMult = 1 + (effects.shadowPartnerP ?? 0) / 100
    // 방컷·DPM 미제공 스킬(패닉/코마/돌진)
    const noDpm = NO_DPM.has(selectedSkill.id)
    // 모든 데미지 증가 배수를 하나로 통일(콤보·버서크·위협·카운터·쉐파·차지 계수·마법엘앰프) → 방어 앞(2단계) 적용
    const damageMult = (isMagic ? magicAmpMultiplier(effects) : 1) * finalMult * threatenMult * counterMult * shadowMult * chargeCoefMult

    const watk = totalAttack(effects)
    // 럭세/트스: LUK 전용 예외식 base(모션·부스탯·숙련 무시). 스킬%는 그대로 적용
    const lineBase = !isMagic && LUCKY_SKILLS.has(selectedSkill.id) ? calcLuckyBase(finalStats.LUK, watk) : undefined

    const cast = computeCast({
      weaponType: weaponType ?? 'oneHandedSword',
      skillId: selectedSkill.id,
      attackCount: skillLineCount(selectedSkill, skillLevel),
      kind: att.kind,
      primary: job ? finalStats[job.primaryStat] : 0,
      secondary: job ? job.secondaryStats.reduce((a, s) => a + finalStats[s], 0) : 0,
      watk,
      mastery: masteryRatio(effects),
      magic: totalMagic(effects, finalStats.INT),
      int: finalStats.INT,
      spellAtk: att.spellAtk,
      elementMult,
      defense,
      skillPercent: effSkillPercent,
      damageMult,
      critProb,
      critMult,
      lineBase,
    })
    if (!cast) return { unsupported: true as const }

    const hp = monster.maxHP ?? 0
    const isBoss = !!monster.isBoss
    // 물리: 무기 부스터(attackSpeedBoost) + 윈드부스터(windBoostStep) 중첩 공속상승
    const boosterSteps = (effects.attackSpeedBoost ?? 0) + (effects.windBoostStep ?? 0)
    // 마법: 매직부스터(castSpeedBoost) 또는 윈드부스터 활성 여부만 사용
    const magicBooster = ((effects.castSpeedBoost ?? 0) + (effects.windBoostStep ?? 0)) > 0
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
      coef: Math.round(effSkillPercent),
      // 패닉/코마/돌진은 방컷·DPM 미제공(데미지 범위만)
      nhit: isBoss || noDpm ? null : computeNhit(cast.dist, hp, 10),
      apm, dpm, killSec, isMagic, effStep, boosterActive: magicBooster, noDpm,
    }
  })()

  return (
    <CollapsiblePanel
      id="nhit"
      title={
        <>
          데미지 계산
          <Box component="span" sx={{ fontSize: 11, fontWeight: 400, color: 'text.disabled', ml: 0.75 }}>
            * 오류 발견 시 문의하기로 남겨주세요
          </Box>
        </>
      }
    >
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
              sx={{ flexGrow: 1, fontSize: 13, '& .MuiSelect-select': { display: 'flex', alignItems: 'center', gap: 1.25, py: 0.5 } }}
            >
              <MenuItem value=""><em>스킬 선택</em></MenuItem>
              {attackSkills.map((s) => (
                <MenuItem key={s.id} value={s.id} sx={{ fontSize: 13, gap: 1.25, alignItems: 'center' }}>
                  <Box component="img" src={skillIconSrc(s.id)} alt="" onError={hideOnError} sx={{ width: 32, height: 32, imageRendering: 'pixelated', display: 'block', flexShrink: 0 }} />
                  <Box component="span" sx={{ lineHeight: 1.2 }}>{s.description?.name ?? s.id}</Box>
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

          {result === null ? (
            <Typography variant="body2" color="text.disabled">스킬을 선택하세요.</Typography>
          ) : result.unsupported ? (
            <Typography variant="body2" color="warning.main">이 스킬은 아직 지원하지 않습니다.</Typography>
          ) : (
            <>
              {/* 데미지 범위 */}
              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>데미지 범위</Typography>
              {result.lines > 1 && <Row label={`1회 타격 (${result.lines}타, ${result.coef}%)`} value={rng(result.lineRange)} />}
              <Row label={result.lines > 1 ? '총 데미지' : `데미지 (${result.coef}%)`} value={rng(result.totalRange)} strong />

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
                  <Row label="기대 처치 타수" value={result.nhit.over >= 0.9995 ? '알 수 없음' : `${result.nhit.meanHits.toFixed(2)}방`} strong />
                </>
              )}

              {/* DPM (패닉/코마/돌진은 미제공) */}
              {!result.noDpm && (
                <>
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
            </>
          )}
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
