import type { SyntheticEvent } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import CollapsiblePanel from '../common/CollapsiblePanel'
import { useBuildStore, DEFAULT_CHARGE } from '../../store/buildStore'
import { useNhitStore } from '../../store/nhitStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { useMonsterStore } from '../../store/monsterStore'
import { aggregateBuild, equippedWeaponType, missingRequiredSecondary } from '../../store/aggregate'
import { useActiveEquippedBuilts } from '../../store/activation'
import { useBuffEffects, useConditionalBuffEffects } from '../../store/useBuffEffects'
import {
  totalAttack, totalMagic, masteryRatio, magicAmpMultiplier, levelPenalty, calcLuckyBase,
} from '../../domain/attackPower'
import { JOBS } from '../../domain/jobs'
import { getMonster } from '../../data/mobs'
import { elementReaction, formatElements } from '../../domain/monster'
import { skillAttackAt, skillLineCount, comboFinalDamageP, COMBO_SKILLS, findSkillById, skillNumAt, chargeStats, skillElements } from '../../data/skills'
import type { IJobSkill } from '../../data/skills'
import { damageSkillsForJob, baseSkillId, stunHitRatio } from '../../data/skills/variants'
import type { ChargeState } from '../../domain/paladinCharge'
import { computeCast, computeNhit, computeDpm, baseElementMult, mixCasts, SKILL_MOTION } from '../../domain/skillCombat'
import { convolve } from '../../domain/nhitProb'
import type { Dist } from '../../domain/nhitProb'
import { attacksPerMinute, effectiveCastStep, effectiveSpeedStep, type SpeedContext } from '../../data/attackSpeed'
import { chargeMultiplier, chargeFromUi, chargeElementCodes } from '../../domain/paladinCharge'
import type { ChargeElement } from '../../domain/paladinCharge'
import ChargeMultTip from '../common/ChargeMultTip'
import { objectJosa } from '../../lib/josa'
import { secondaryPrompt } from '../../lib/weaponNotice'
import { speedLabel } from '../../lib/speedLabel'

/**
 * 시그너스 차지 — 직업당 하나이며, 특화 버프 토글 레벨이 그대로 차지 레벨이 된다.
 *
 * 데미지배수 = `damage`/100 (마스터 120 → ×1.20), 속성배수는 `z`(마스터 50 → 1.25/0.75).
 *
 * 속성 근거는 스킬 설명("검에 성속성 부여" / "너클에 번개 속성 부여").
 * 차지류는 무기 속성을 바꾸는 방식이라 스킬 자체에 elemAttr가 붙지 않고(팔라딘도 동일),
 * 게다가 이 데이터셋은 시그너스 98개 스킬 전부 속성값이 비어 있다(플레임위자드
 * 파이어 에로우조차 undefined). 즉 elemAttr 부재는 판단 근거가 못 된다.
 */
const SKILL_CHARGES: Record<string, { id: number; element: ChargeElement }> = {
  striker: { id: 15101006, element: 'lightning' }, // 라이트닝 차지
  soulMaster: { id: 11111007, element: 'holy' },   // 소울 차지
}

/** 변형 스킬(…(스턴) 등)은 아이콘이 따로 없으므로 원래 스킬 id로 받는다 */
const skillIconSrc = (id: number) => `/skill-icons/${baseSkillId(id)}.png`
const hideOnError = (e: SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.visibility = 'hidden' }
const pct = (n: number) => `${(n * 100).toFixed(1)}%`

/** 패닉/코마(검·도끼/둔기, 히어로·소마) — 콤보 카운터 전량 소모형 */
const COMA_PANIC = new Set([1111003, 1111004, 1111005, 1111006, 11111002, 11111003])
/** 돌진(히어로·팔라딘·다크나이트) — 후딜레이가 커 방컷/DPM이 무의미 */
const RUSH = new Set([1121006, 1221007, 1321003])
/** 방컷·DPM 미제공(데미지 범위만): 패닉/코마 + 돌진 */
const NO_DPM = new Set([...COMA_PANIC, ...RUSH])
/** 럭키세븐/트리플스로우(나로·나워) — LUK 전용 예외식(부스탯·숙련 없음) */
const LUCKY_SKILLS = new Set([4001344, 14001004, 4121007, 14111005])
/** 피스트(바이퍼 5121007·스트라이커 15111004) — 6타 중 5타 ×2, 6타 ×4 (7단계 타수배율) */
const FIST_SKILLS = new Set([5121007, 15111004])
const FIST_HIT_MULT = [1, 1, 1, 1, 2, 4]
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
  // 구버전 영속 상태엔 charge가 없을 수 있다 (없으면 chargeFromUi에서 터진다)
  const chargeState = useBuildStore((s) => s.charge) ?? DEFAULT_CHARGE
  const buffEffects = useBuffEffects()
  // 스턴 마스터리 — 상시 효과가 아니라 '(스턴)' 변형 스킬에만 얹는 조건부 버프
  const stunEffects = useConditionalBuffEffects('stun')
  const builts = useActiveEquippedBuilts()

  // 선택 상태는 저장슬롯을 따라다녀야 해서 스토어에 둔다 (nhitStore)
  const skillId = useNhitStore((s) => s.skillId)
  const skillLevel = useNhitStore((s) => s.skillLevel)
  const preCast = useNhitStore((s) => s.preCast)
  const setSkill = useNhitStore((s) => s.setSkill)
  const setSkillLevel = useNhitStore((s) => s.setSkillLevel)
  const addPreCast = useNhitStore((s) => s.addPreCast)
  const setPreCastLevel = useNhitStore((s) => s.setPreCastLevel)
  const removePreCast = useNhitStore((s) => s.removePreCast)

  const { finalStats, effects } = aggregateBuild(baseStats, builts, buffEffects)
  const job = jobId ? JOBS[jobId] : null
  const monster = selectedMobId != null ? getMonster(selectedMobId) : undefined
  const weaponType = equippedWeaponType(equipped, invItems)
  // 아대의 표창처럼 필수 보조무기가 비어 있으면 인게임에서 공격이 성립하지 않는다 → 무기 미장착과 동일 취급
  const missingSecondary = missingRequiredSecondary(weaponType, equipped, invItems)
  const atkWeapon = missingSecondary ? undefined : weaponType
  // 공격 스킬 + 변형('(스턴)' 등, data/skills/variants.ts)
  const attackSkills = jobId ? damageSkillsForJob(jobId) : []
  const selectedSkill = attackSkills.find((s) => s.id === skillId)
  // 추가스킬 후보: 공격 스킬(돌진·베놈 등 포함). 패시브(크리티컬 스로우)·콤보·소환수 등은 제외.
  const precastCandidates = attackSkills

  const weaponSpeedStep = (() => {
    const id = equipped.weapon
    const w = id ? invItems.find((i) => i.id === id)?.built : undefined
    return w?.base.effects.attackSpeed ?? 6
  })()

  /**
   * 임의 스킬(sk, lv)의 1회 시전 데미지 분포 계산 — 메인/추가스킬 공용.
   * 캐릭터 스탯·버프·차지·크리·몬스터 방어를 모두 반영. 데미지 산출 불가 시 null.
   *
   * @param stunned 대상이 스턴 상태인지 — 스턴 마스터리 크리가 이때만 붙는다.
   */
  const buildCastAt = (sk: IJobSkill, lv: number, stunned: boolean) => {
    if (!job || !monster) return null
    const att = skillAttackAt(sk, lv)
    if (!att) return null
    const isMagic = att.kind === 'magic'
    if (!isMagic && !atkWeapon) return null
    // 변형 스킬은 id에 오프셋이 붙어 있다 — 모션 규칙/공속표/예외식은 전부 원래 id로 조회
    const baseId = baseSkillId(sk.id)

    // 차지 블로우(1211002): 어드밴스드 차지(1220010) 학습 시 계수를 어차 값(260~350%)으로 대체
    let effSkillPercent = att.skillPercent
    if (baseId === 1211002) {
      const advLv = activeBuffs['1220010'] ?? 0
      const adv = advLv > 0 ? findSkillById(1220010) : undefined
      const advAtt = adv ? skillAttackAt(adv, advLv) : null
      if (advAtt) effSkillPercent = advAtt.skillPercent
    }
    // 크리: 확률 혼합으로 분포에 반영. 물리=합연산 / 마법=곱연산(샤프아이즈만)
    // 스턴 상태면 스턴 마스터리 크리(확률·추뎀)가 샤프아이즈 등과 합산돼 얹힌다.
    const critChance = (effects.criticalP ?? 0) + (stunned ? (stunEffects.criticalP ?? 0) : 0)
    const critDmgTotal = (effects.criticalDamage ?? 0) + (stunned ? (stunEffects.criticalDamage ?? 0) : 0)
    let critMult = 1
    if (isMagic) {
      critMult = critDmgTotal > 100 ? 1 + (critDmgTotal - 100) / 100 : 1
    } else {
      critMult = critDmgTotal > 0 && effSkillPercent > 0 ? (effSkillPercent + critDmgTotal) / effSkillPercent : 1
    }
    const critProb = critChance > 0 && critMult > 1 ? critChance / 100 : 0

    // 차지(속성 부여) — 팔라딘(메인/보조) / 스트라이커 라이트닝 차지 / 소울마스터 소울차지.
    // 셋 다 속성반응과 데미지 계수를 하나로 합친 통합 배율(chargeMultiplier)을 쓴다.
    let charge: ChargeState | null = null
    if (!isMagic) {
      if (jobId === 'paladin') {
        charge = chargeFromUi(chargeState, chargeStats)
      } else {
        // 시그너스 차지 — 켠 레벨의 damage%가 데미지배수, z가 속성반응 강도
        const sc = SKILL_CHARGES[jobId ?? '']
        const clv = sc ? activeBuffs[String(sc.id)] : undefined
        if (sc && clv) {
          charge = {
            main: sc.element,
            mainLevel: clv,
            thunderLevel: null,
            baseMult: skillNumAt(sc.id, clv, 'damage') / 100,
            attrZ: skillNumAt(sc.id, clv, 'z'),
          }
        }
      }
    }
    // 최종 속성 — 차지가 걸려 있으면 스킬 속성이 아니라 차지 속성이 된다
    const skillElems = skillElements(sk, lv)
    const elements = charge ? chargeElementCodes(charge) : skillElems
    // 속성배율 — 차지 우선, 복합속성(매직 컴포지션)은 데미지를 반씩 나눠 각각 판정
    const elemMultFor = (elemAttr: string | undefined) =>
      charge
        ? chargeMultiplier(charge, elemAttr)
        : skillElems.length > 1
          ? skillElems.reduce((acc, e) => acc + baseElementMult(elementReaction(elemAttr, e)) / skillElems.length, 0)
          : baseElementMult(elementReaction(elemAttr, att.element))
    let elementMult: number = elemMultFor(monster.elemAttr)
    // 같은 조건에서 무속성 몹을 때렸을 때의 배율. 차지의 데미지 증가분이 여기 그대로 들어 있어,
    // 나눠주면 속성반응에 의한 몫만 남는다 (표시용).
    const elementMultNeutral = elemMultFor(undefined)
    // 엘리멘탈 리셋(플위): 무속성화 blend
    if (jobId === 'flameWizard') {
      const rLv = activeBuffs['12101005']
      if (rLv) {
        const r = Math.min(1, skillNumAt(12101005, rLv, 'x') / 100)
        elementMult = elementMult * (1 - r) + r
      }
    }
    /** 속성만의 배율 (데미지 증가분 제외) */
    const elementRatio = elementMultNeutral > 0 ? elementMult / elementMultNeutral : 1
    /**
     * 표기용 배율. 차지가 걸려 있으면 데미지 증가분까지 합친 **종합 차지배율**을 보여준다
     * (예: 무속성 몹에 홀리+썬더 = 1.625배). 차지가 없으면 속성반응 배율 그대로.
     */
    const displayMult = charge ? elementMult : elementRatio

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
    const finalMult = 1 + ((effects.finalDamageP ?? 0) + comboBonus) / 100
    const threatenMult = 1 + (effects.monsterDamageTakenP ?? 0) / 100
    const counterMult = COMA_PANIC.has(baseId) && comboBonus > 0 ? MAX_COUNTER_MULT : 1
    const damageMult = (isMagic ? magicAmpMultiplier(effects) : 1) * finalMult * threatenMult * counterMult
    // 쉐도우 파트너는 데미지 배수가 아니라 분신의 별도 타격이다 → computeCast가 라인을 늘린다
    const shadowRatio = (effects.shadowPartnerP ?? 0) / 100

    const watk = totalAttack(effects)
    // 럭세/트스: LUK 전용 예외식 base(모션·부스탯·숙련 무시). 스킬%는 그대로 적용
    const lineBase = !isMagic && LUCKY_SKILLS.has(baseId) ? calcLuckyBase(finalStats.LUK, watk) : undefined
    // 피스트: 타수별 배율(5타×2·6타×4)
    const hitMultipliers = FIST_SKILLS.has(baseId) ? FIST_HIT_MULT : undefined

    const cast = computeCast({
      weaponType: atkWeapon ?? 'oneHandedSword',
      skillId: baseId,
      attackCount: skillLineCount(sk, lv),
      kind: att.kind,
      primary: finalStats[job.primaryStat],
      secondary: job.secondaryStats.reduce((a, s) => a + finalStats[s], 0),
      watk,
      // 마법 숙련도는 스킬 자체에서(기본 10% + 스킬 mastery×5%), 물리는 무기 마스터리 버프에서 온다
      mastery: att.mastery ?? masteryRatio(effects),
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
      hitMultipliers,
      shadowRatio,
    })
    return { cast, att, effSkillPercent, isMagic, elements, displayMult, charge }
  }

  /** 스턴 마스터리가 실제로 켜져 있는지 (꺼져 있으면 변형 스킬도 기본 스킬과 같다) */
  const hasStunBonus = (stunEffects.criticalP ?? 0) > 0 || (stunEffects.criticalDamage ?? 0) > 0

  /**
   * 스킬 1회 시전 결과 — 변형에 따라 스턴 상황을 반영한다.
   *  - 기본 스킬 / (스턴): 스턴 여부를 하나로 고정해 한 번만 계산
   *  - (단독 운용): 스턴 확률만큼 두 분포를 섞는다 (variants.ts stunHitRatio)
   */
  const buildCast = (sk: IJobSkill, lv: number) => {
    const ratio = hasStunBonus ? stunHitRatio(sk.id, lv) : 0
    if (ratio <= 0 || ratio >= 1) return buildCastAt(sk, lv, ratio >= 1)
    const off = buildCastAt(sk, lv, false)
    const on = buildCastAt(sk, lv, true)
    if (!off?.cast || !on?.cast) return off
    return { ...on, cast: mixCasts([{ weight: 1 - ratio, cast: off.cast }, { weight: ratio, cast: on.cast }]) }
  }

  // 추가스킬 목록: 각 스킬 1회 시전 분포. 방컷 누적곱의 시작값(prior)으로 합성 → 데미지도 분포째 반영.
  const preCastInfos = preCast.map((pc) => {
    const sk = precastCandidates.find((s) => s.id === pc.id)
    const built = sk ? buildCast(sk, pc.level) : null
    const dist = built?.cast?.dist ?? null
    return {
      uid: pc.uid,
      id: pc.id,
      level: pc.level,
      name: sk?.description?.name ?? String(pc.id),
      masterLevel: sk?.masterLevel ?? 1,
      ok: !!dist,
      dist,
    }
  })
  // 추가스킬 분포들의 합(컨볼루션) = 방컷 prior
  const preCastPrior = preCastInfos.reduce<Dist | undefined>(
    (acc, p) => (p.dist ? (acc ? convolve(acc, p.dist) : p.dist) : acc),
    undefined,
  )

  const result = (() => {
    if (!job || !monster || !selectedSkill) return null
    const built = buildCast(selectedSkill, skillLevel)
    if (!built) return null
    const { cast, att, effSkillPercent, isMagic, elements, displayMult, charge } = built
    if (!cast) return { unsupported: true as const, elements, displayMult, charge }

    const baseId = baseSkillId(selectedSkill.id)
    const noDpm = NO_DPM.has(baseId)
    const hp = monster.maxHP ?? 0
    const isBoss = !!monster.isBoss
    // 물리: 무기 부스터(attackSpeedBoost) + 윈드부스터(windBoostStep) 중첩 공속상승
    // 마법: 매직부스터(castSpeedBoost) + 윈드부스터가 시전속도 단계를 내린다 (docs/attack-speed.md)
    const speedCtx: SpeedContext = {
      weaponSpeedStep,
      boosterSteps: (effects.attackSpeedBoost ?? 0) + (effects.windBoostStep ?? 0),
      castBoostSteps: effects.castSpeedBoost ?? 0,
      windBoostSteps: effects.windBoostStep ?? 0,
      skillLevel,
      kind: att.kind,
    }
    const effStep = att.kind === 'magic' ? effectiveCastStep(speedCtx) : effectiveSpeedStep(speedCtx)
    // 추가스킬을 섞으면 메인/추가 시전 비율이 정의되지 않아 분당횟수가 모호해진다 → DPM 미산출
    const apm = preCastPrior ? null : attacksPerMinute(baseId, speedCtx)
    const dpm = apm != null ? computeDpm(cast.dist, apm) : null
    const killSec = dpm && dpm > 0 && hp > 0 ? hp / (dpm / 60) : null
    return {
      unsupported: false as const,
      elements,
      displayMult,
      charge,
      isBoss,
      hp,
      hasPreCast: !!preCastPrior,
      lines: cast.lineRanges.length,
      lineRange: {
        min: Math.min(...cast.lineRanges.map((r) => r.min)),
        max: Math.max(...cast.lineRanges.map((r) => r.max)),
      },
      totalRange: cast.totalRange,
      coef: Math.round(effSkillPercent),
      // 패닉/코마/돌진은 방컷·DPM 미제공(데미지 범위만). 추가스킬은 prior 분포로 반영.
      nhit: isBoss || noDpm ? null : computeNhit(cast.dist, hp, 10, preCastPrior),
      apm, dpm, killSec, isMagic, effStep, noDpm,
    }
  })()

  /**
   * 추가스킬을 넣었을 때의 안내 문구 — '기대 처치 타수'가 **메인 스킬** 타수라는 뜻임을 밝힌다.
   * 메인/추가를 뒤집어 넣으면(더블 어퍼를 메인, 피스트를 추가스킬로) 타수가 오히려 늘어
   * 계산이 틀린 것처럼 보이기 때문에 덧붙였다.
   */
  const preCastNote = (() => {
    if (!selectedSkill || !preCastPrior) return null
    // 미지원(분포를 못 만든) 추가스킬은 계산에 안 들어가므로 문구에서도 뺀다
    const counts = new Map<string, number>()
    for (const p of preCastInfos) if (p.ok) counts.set(p.name, (counts.get(p.name) ?? 0) + 1)
    if (counts.size === 0) return null
    const pre = [...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)).join(' · ')
    const main = selectedSkill.description?.name ?? String(selectedSkill.id)
    return `※ ${pre} 이후 ${main}${objectJosa(main)} 몇 방 시전해야 하는지에 대한 기대 타수입니다.`
  })()

  /** 스턴이 걸리는 스킬을 골랐을 때의 안내 문구 (스턴 마스터리가 어떻게 들어가는지) */
  const stunNote = (() => {
    if (!selectedSkill) return null
    const ratio = stunHitRatio(selectedSkill.id, skillLevel)
    if (ratio <= 0) return null
    if (!hasStunBonus) return '스턴 마스터리를 켜야 차이가 생깁니다'
    if (ratio >= 1) return '스턴 상태 가정 — 스턴 마스터리 크리 적용'
    return `자체 스턴 확률 ${Math.round(ratio * 100)}%만큼 스턴 마스터리 크리 적용`
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
                const sk = attackSkills.find((s) => s.id === id)
                setSkill(id, sk ? sk.masterLevel : 1)
              }}
              sx={{ flexGrow: 1, fontSize: 13, '& .MuiSelect-select': { display: 'flex', alignItems: 'center', gap: 1.25, py: 0.5 } }}
            >
              <MenuItem value=""><em>스킬 선택</em></MenuItem>
              {attackSkills.map((s) => (
                <MenuItem key={s.id} value={s.id} sx={{ fontSize: 13, gap: 1.25, alignItems: 'center' }}>
                  <Box component="img" src={skillIconSrc(s.id)} alt="" onError={hideOnError} sx={{ width: 32, height: 32, imageRendering: 'pixelated', display: 'block', flexShrink: 0 }} />
                  <Box component="span" sx={{ lineHeight: 1.2 }}>{s.description?.name ?? s.id}</Box>
                  {SKILL_MOTION[baseSkillId(s.id)] && <Box component="span" sx={{ fontSize: 10, color: 'text.disabled' }}>*</Box>}
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
          {stunNote && (
            <Typography
              variant="caption"
              color={hasStunBonus ? 'success.main' : 'text.disabled'}
              sx={{ display: 'block', mt: -0.5, mb: 1 }}
            >
              {stunNote}
            </Typography>
          )}
          {/* 추가스킬 (1회 시전 후 잔여 HP 기준으로 방컷 계산) */}
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.25 }}>
              추가 스킬 <Box component="span" sx={{ fontWeight: 400, color: 'text.disabled' }}>· 1회 시전 후 잔여 HP 기준</Box>
            </Typography>
            {preCastInfos.map((p, idx) => (
              <Box key={p.uid} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                <Box component="img" src={skillIconSrc(p.id)} alt="" onError={hideOnError} sx={{ width: 24, height: 24, imageRendering: 'pixelated', flexShrink: 0 }} />
                <Box component="span" sx={{ fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: p.ok ? 'text.primary' : 'warning.main' }}>
                  {p.name}{!p.ok && ' (미지원)'}
                </Box>
                <TextField
                  size="small" type="number" value={p.level}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(p.masterLevel, Number(e.target.value) || 1))
                    setPreCastLevel(p.uid, v)
                  }}
                  slotProps={{ htmlInput: { style: { width: 38, textAlign: 'center' }, min: 1, max: p.masterLevel } }}
                />
                <Button size="small" color="inherit" onClick={() => removePreCast(p.uid)} sx={{ minWidth: 24, px: 0.5, lineHeight: 1 }}>×</Button>
              </Box>
            ))}
            <Select<number | ''>
              size="small" displayEmpty value={''}
              onChange={(e) => {
                const id = e.target.value === '' ? '' : Number(e.target.value)
                if (!id) return
                const sk = precastCandidates.find((s) => s.id === id)
                addPreCast(id, sk?.masterLevel ?? 1)
              }}
              sx={{ width: '100%', fontSize: 12, '& .MuiSelect-select': { display: 'flex', alignItems: 'center', gap: 1, py: 0.4 } }}
            >
              <MenuItem value=""><em>＋ 스킬 추가</em></MenuItem>
              {precastCandidates.map((s) => (
                <MenuItem key={s.id} value={s.id} sx={{ fontSize: 12, gap: 1, alignItems: 'center' }}>
                  <Box component="img" src={skillIconSrc(s.id)} alt="" onError={hideOnError} sx={{ width: 24, height: 24, imageRendering: 'pixelated', flexShrink: 0 }} />
                  <Box component="span">{s.description?.name ?? s.id}</Box>
                </MenuItem>
              ))}
            </Select>
          </Box>

          {missingSecondary ? (
            <Typography variant="body2" color="text.disabled">{secondaryPrompt(missingSecondary)}</Typography>
          ) : result === null ? (
            <Typography variant="body2" color="text.disabled">스킬을 선택하세요.</Typography>
          ) : result.unsupported ? (
            <Typography variant="body2" color="warning.main">이 스킬은 아직 지원하지 않습니다.</Typography>
          ) : (
            <>
              {/* 데미지 범위 */}
              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>데미지 범위</Typography>
              {result.lines > 1 && <Row label={`1회 타격 (${result.lines}타, ${result.coef}%)`} value={rng(result.lineRange)} />}
              <Row
                label={result.lines > 1 ? '총 데미지' : `데미지 (${result.coef}%)`}
                value={rng(result.totalRange)}
                strong
                note={
                  result.elements.length > 0 ? (
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', color: 'success.main', fontWeight: 700, fontSize: 12 }}>
                      {formatElements(result.elements)} ({result.displayMult.toFixed(2)}배)
                      {result.charge && (
                        <ChargeMultTip state={result.charge} elemAttr={monster.elemAttr} monsterName={monster.koreanName || monster.name} />
                      )}
                    </Box>
                  ) : undefined
                }
              />

              {/* 방컷 확률 (비보스) */}
              {result.nhit && (
                <>
                  <Divider sx={{ my: 0.75 }} />
                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.25 }}>
                    방컷 확률 (HP {result.hp.toLocaleString()})
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.25 }}>
                    {result.hasPreCast && result.nhit.zero >= 0.0005 && <Row label="0방 (추가스킬만)" value={pct(result.nhit.zero)} />}
                    {result.nhit.exact.map((p, i) => (p >= 0.0005 ? <Row key={i} label={`${i + 1}방`} value={pct(p)} /> : null))}
                    {result.nhit.over >= 0.0005 && <Row label="11방+" value={pct(result.nhit.over)} />}
                  </Box>
                  {/* 추가스킬을 넣었을 때 무엇을 세는 타수인지는 아래 preCastNote가 설명한다 */}
                  <Row label="기대 처치 타수" value={result.nhit.over >= 0.9995 ? '알 수 없음' : `${result.nhit.meanHits.toFixed(2)}방`} strong />
                  {preCastNote && (
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25, lineHeight: 1.4 }}>
                      {preCastNote}
                    </Typography>
                  )}
                </>
              )}

              {/* DPM (패닉/코마/돌진은 미제공) */}
              {!result.noDpm && (
                <>
                  <Divider sx={{ my: 0.75 }} />
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>DPM</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {result.isMagic ? '시전속도' : '공격속도'} {result.effStep}단계 ({speedLabel(result.effStep)})
                    </Typography>
                  </Box>
                  {result.dpm != null ? (
                    <>
                      <Row label="DPM" value={Math.round(result.dpm).toLocaleString()} strong />
                      <Row label="분당 공격횟수" value={`${result.apm}회`} />
                      {result.isBoss && result.killSec != null && <Row label="처치 소요(참고)" value={`${result.killSec.toFixed(1)}초`} />}
                    </>
                  ) : (
                    <Typography variant="body2" color="text.disabled">
                      {result.hasPreCast
                        ? '추가스킬을 섞으면 시전 비율이 정해지지 않아 DPM을 산출하지 않습니다.'
                        : '공속 데이터가 없어 DPM을 산출하지 않습니다.'}
                    </Typography>
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

function Row({ label, value, strong = false, note }: {
  label: string
  value: string
  strong?: boolean
  /** 라벨 뒤에 붙는 부가 표기 (속성 등) */
  note?: React.ReactNode
}) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, px: 1, py: 0.1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, minWidth: 0 }}>
        <Box component="span">{label}</Box>
        {note}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'nowrap', fontWeight: strong ? 700 : 500, color: strong ? 'error.main' : 'text.primary' }}>{value}</Typography>
    </Box>
  )
}
