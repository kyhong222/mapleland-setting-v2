import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Slider from '@mui/material/Slider'
import Switch from '@mui/material/Switch'
import Button from '@mui/material/Button'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Tooltip from '@mui/material/Tooltip'
import Checkbox from '@mui/material/Checkbox'
import CollapsiblePanel from '../common/CollapsiblePanel'
import ActionHint from '../common/ActionHint'
import EditBadge from '../common/EditBadge'
import { useBuildStore } from '../../store/buildStore'
import { useUiStore } from '../../store/uiStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { equippedWeaponType, equippedHasShield, jobMasteries, displayedMasteries, appliedMasteries, weaponGateOk } from '../../store/aggregate'
import { COMMON_BUFFS, PARTY_BUFFS, PERSONAL_BUFFS, DOPING_ITEMS, JOB_BUFFS, getBuff } from '../../data/buff'
import { canUseBuff, buffEffectsAtLevel, defaultBuffLevel, effectiveMasterLevel } from '../../domain/buff'
import type { Buff } from '../../domain/buff'
import { maxEffects } from '../../domain/effects'
import { BUFF_CATEGORIES, buffCategoriesOf } from '../../domain/buffCategory'
import type { BuffCategoryId } from '../../domain/buffCategory'
import type { EffectMap } from '../../domain/effects'
import type { JobId } from '../../domain/jobs'
import { WEAPON_CONSTANTS } from '../../domain/weapons'
import type { WeaponType } from '../../domain/weapons'
import { comboFinalDamageP, COMBO_SKILLS, findSkillById, skillAttackAt, skillNumAt, chargeDamagePercent, chargeStats } from '../../data/skills'
import { CHARGE_LABEL, CHARGE_MASTER, CHARGE_ELEMENTS } from '../../domain/paladinCharge'
import type { ChargeElement } from '../../domain/paladinCharge'
import { DEFAULT_CHARGE } from '../../store/buildStore'
import { MAGIC_GUARD_IDS } from '../../domain/incomingDamage'
import { formatEffects } from '../../lib/effectFormat'
import { buffIconUrl, CHARGE_ICON } from '../../lib/buffIcon'
import { useTouchLongPress } from '../../lib/useLongPress'

/** 레벨 조정 대상: 토글버프(영메·메용/직업패시브) / 적용버프(도핑·개인·파티) / 마스터리 */
type BuffKind = 'toggle' | 'applied' | 'mastery'

/** 파티 버프를 이 직업이 직접 가지고 있는가 (가지고 있으면 '개인'으로 분류) */
function ownsBuff(buff: Buff, jobId: JobId | null): boolean {
  if (!jobId || buff.type !== 'skill') return false
  return buff.scope === 'personal' ? !!buff.jobs?.includes(jobId) : !!buff.owners?.includes(jobId)
}

/** 이름 앞 접두사: 변형='[변형명]' / 레벨스킬='[Lv. n]' / 그 외 없음 */
function buffPrefix(buff: Buff, level: number): string {
  if (buff.type === 'skill' && buff.variants) return `[${buff.variants[level - 1] ?? '?'}]`
  if (buff.type === 'skill' && buff.masterLevel > 1) return `[Lv. ${level}]`
  return ''
}

/** 접두사(볼드) + 버프명 */
function BuffName({ buff, level }: { buff: Buff; level: number }) {
  const prefix = buffPrefix(buff, level)
  return (
    <Typography variant="body2" noWrap>
      {prefix && <Box component="span" sx={{ fontWeight: 700 }}>{prefix}</Box>}
      {buff.name}
    </Typography>
  )
}

/**
 * 무기 전용 버프(무기 부스터 등)가 장착 주무기와 맞지 않을 때의 미적용 사유.
 * 맞거나 무기 제한이 없는 버프면 null.
 */
function weaponGateNote(buff: Buff, weaponType?: WeaponType): string | null {
  if (weaponGateOk(buff, weaponType)) return null
  const need = (buff.type === 'skill' ? buff.weaponTypes ?? [] : [])
    .map((w) => WEAPON_CONSTANTS[w].label)
    .join('/')
  return weaponType ? `${need} 필요 — 미적용` : '무기 미장착 — 미적용'
}

/** 버프 툴팁 내용: 이름(+레벨) / 효과 / 미적용 사유 / 보조 안내문(note) */
function buffTooltip(buff: Buff, level: number, unappliedNote?: string | null): React.ReactNode {
  const isSkill = buff.type === 'skill'
  const effText = formatEffects(buffEffectsAtLevel(buff, level))
  return (
    <Box sx={{ py: 0.25 }}>
      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
        {buff.name}
        {isSkill && buff.masterLevel > 1 ? ` Lv.${level}` : ''}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block' }}>
        {effText || '—'}
      </Typography>
      {unappliedNote && (
        <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>
          {unappliedNote}
        </Typography>
      )}
      {buff.note && (
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.75 }}>
          {buff.note}
        </Typography>
      )}
    </Box>
  )
}

/**
 * 아이콘 우상단 편집 버튼 — 우클릭(= 레벨 변경)을 찾지 못하는 사용자를 위한 가이드.
 * 호버 가능한 기기에서만 뜬다(모바일은 길게 누르기 안내로 대체).
 * 겉모습은 공용 EditBadge — 조작 안내문에 인라인으로 넣는 것과 같은 컴포넌트다.
 */
function EditBadgeButton({ onClick }: { onClick: () => void }) {
  return (
    <Box
      className="edit-badge"
      role="button"
      aria-label="레벨 변경"
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onClick() }}
      sx={{
        position: 'absolute',
        top: -5,
        right: -5,
        zIndex: 1,
        display: 'flex',
        // 기본은 숨김 + 클릭 통과 — 터치 기기에서 :hover가 눌러붙어도 오작동하지 않게
        opacity: 0,
        pointerEvents: 'none',
        transition: 'opacity 120ms',
      }}
    >
      <EditBadge />
    </Box>
  )
}

/** 안내문에 끼워 넣는 '편집 버튼' 표기 — 실제 버튼과 같은 모양 */
const EDIT_HINT_KEY = (
  <>
    우클릭 /{' '}
    <EditBadge size={16} sx={{ verticalAlign: 'text-bottom', mr: 0.25 }} />
  </>
)

/**
 * 버프 아이콘 우상단 레벨 배지 — 공유 카드(ShareCardDialog '적용 버프')와 같은 모양.
 * 꺼진 버프는 아이콘처럼 흐리게 둔다.
 */
function LevelBadge({ level, dim = false }: { level: number; dim?: boolean }) {
  return (
    <Box
      sx={{
        position: 'absolute', top: -4, right: -4,
        minWidth: 16, height: 16, px: '3px', boxSizing: 'border-box',
        borderRadius: '8px', bgcolor: '#0a0c1c', border: '1px solid #ffc53d',
        color: '#ffc53d', fontSize: 10, fontWeight: 700, lineHeight: '14px', textAlign: 'center',
        opacity: dim ? 0.55 : 1,
        pointerEvents: 'none',
      }}
    >
      {level}
    </Box>
  )
}

/** 레벨 배지를 다는 버프인지 — 레벨이 있는 스킬만(변형 선택형 제외). 공유 카드와 같은 기준 */
function hasLevelBadge(buff: Buff): boolean {
  return buff.type === 'skill' && buff.masterLevel > 1 && !buff.variants
}

function BuffIcon({
  buff,
  active = true,
  onClick,
  onLongPress,
  size = 46,
  imgSize,
  pixelScale,
  tooltip,
  highlightActive = false,
  levelBadge,
  ringed,
}: {
  buff: Buff
  active?: boolean
  onClick?: () => void
  /** 우클릭(데스크톱) / 롱프레스(모바일) 동작 — 레벨 조정 등 */
  onLongPress?: () => void
  size?: number
  /**
   * 이미지 자체 크기를 직접 지정. 아이콘 원본이 32px 픽셀아트라, 정수배가 아닌
   * 배율로 줄이면 픽셀이 통째로 빠져 깨져 보인다. 1:1로 그려야 할 때 쓴다.
   */
  imgSize?: number
  /**
   * 원본 크기의 정수배로 확대 (예: 2 → 32px 아이콘을 64px로). 지정하면 imgSize보다 우선한다.
   * 아이템 아이콘은 원본 크기가 제각각이라 고정 너비로 맞추면 정수배가 깨진다 → 원본 크기를 그대로 두고 배율만 건다.
   */
  pixelScale?: number
  tooltip?: React.ReactNode
  /** 적용(active) 시 밝은 황금빛 테두리로 강조할지 여부 */
  highlightActive?: boolean
  /** 우상단 레벨 배지 (공유 카드와 같은 모양). 없으면 표시 안 함 */
  levelBadge?: number
  /** 황금빛 테두리를 직접 지정 (지정하면 highlightActive보다 우선). 고르기 화면에서 '선택됨' 표시용 */
  ringed?: boolean
}) {
  const lp = useTouchLongPress(() => onLongPress?.())
  const iconJobId = useBuildStore((s) => s.jobId)
  const icon = buffIconUrl(buff, iconJobId)
  const img = imgSize ?? Math.round(size * 0.82)
  const highlighted = ringed ?? (highlightActive && active)
  const box = (
    <Box
      onClick={onClick ? () => { if (lp.fired.current) { lp.fired.current = false; return } onClick() } : undefined}
      onContextMenu={onLongPress ? (e) => { e.preventDefault(); onLongPress() } : undefined}
      {...lp.touchProps}
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'action.hover',
        borderRadius: 0.5,
        // 활성 시 안쪽 황금빛 링(inset). 투명 테두리로 링을 가장자리보다 안쪽에 배치
        border: '2.5px solid transparent',
        boxShadow: highlighted ? 'inset 0 0 0 5px #ffc53d' : 'none',
        cursor: onClick || onLongPress ? 'pointer' : 'default',
        WebkitTouchCallout: 'none',
        userSelect: 'none',
        position: 'relative',
        '@media (hover: hover)': { '&:hover .edit-badge': { opacity: 1, pointerEvents: 'auto' } },
      }}
    >
      {icon && (
        <Box
          component="img"
          src={icon}
          alt=""
          sx={{
            ...(pixelScale ? { transform: `scale(${pixelScale})` } : { width: img, height: img }),
            imageRendering: 'pixelated',
            filter: active ? 'none' : 'grayscale(1)',
          }}
        />
      )}
      {levelBadge !== undefined && <LevelBadge level={levelBadge} dim={!active} />}
      {onLongPress && <EditBadgeButton onClick={onLongPress} />}
    </Box>
  )
  if (!tooltip) return box
  return (
    <Tooltip title={tooltip} arrow enterDelay={200} disableInteractive>
      {box}
    </Tooltip>
  )
}

/**
 * 아이콘 우클릭 시 열리는 레벨(+토글) 조정 모달.
 * 슬라이더/스위치는 로컬 draft에만 반영하고, [적용]을 눌러야 스토어에 커밋된다
 * (드래그마다 전역 재계산되는 문제 방지).
 */
function BuffDialog({ buff, kind, onClose }: { buff: Buff; kind: BuffKind; onClose: () => void }) {
  const toggleBuff = useBuildStore((s) => s.toggleBuff)
  const setBuffLevel = useBuildStore((s) => s.setBuffLevel)
  const setAppliedLevel = useBuildStore((s) => s.setAppliedLevel)
  const setMasteryLevel = useBuildStore((s) => s.setMasteryLevel)
  const removeBuff = useBuildStore((s) => s.removeBuff)
  const jobId = useBuildStore((s) => s.jobId)

  const isSkill = buff.type === 'skill'
  const master = effectiveMasterLevel(buff, jobId)

  // 스토어의 현재값(초기 draft) — 열릴 때 한 번만 캡처
  const [storeActive, storeLevel] = useState(() => {
    const s = useBuildStore.getState()
    const active = kind === 'toggle' ? buff.id in s.activeBuffs : true
    const fb = kind === 'toggle' ? s.buffLevels[buff.id] ?? defaultBuffLevel(buff, jobId) : defaultBuffLevel(buff, jobId)
    const lv = kind === 'toggle'
      ? s.activeBuffs[buff.id] ?? fb
      : kind === 'applied'
        ? s.appliedBuffs[buff.id] ?? s.dopingList?.[buff.id] ?? fb
        : s.masteryLevels[buff.id] ?? fb
    return [active, lv] as const
  })[0]

  const [draftLevel, setDraftLevel] = useState(storeLevel)
  const [draftActive, setDraftActive] = useState(storeActive)

  const hasLevel = isSkill && master > 1
  const eff = buffEffectsAtLevel(buff, draftLevel)

  const apply = () => {
    if (kind === 'toggle') {
      setBuffLevel(buff.id, draftLevel) // 메모리(+활성 시 레벨) 갱신
      if (draftActive !== storeActive) toggleBuff(buff.id) // 활성 상태 반영(켤 때 방금 저장한 레벨 사용)
    } else if (kind === 'applied') {
      setAppliedLevel(buff.id, draftLevel)
    } else {
      setMasteryLevel(buff.id, draftLevel)
    }
    onClose()
  }

  const levelDisabled = kind === 'toggle' && !draftActive

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <BuffIcon buff={buff} active={draftActive} size={36} />
        {buff.name}
      </DialogTitle>
      <DialogContent>
        {kind === 'toggle' && (
          <FormControlLabel control={<Switch checked={draftActive} onChange={(e) => setDraftActive(e.target.checked)} />} label="적용" />
        )}
        {buff.type === 'skill' && buff.variants ? (
          <Box sx={{ mt: 1, px: 1 }}>
            <Typography variant="body2" gutterBottom>버전 선택</Typography>
            <RadioGroup value={draftLevel} onChange={(_, v) => setDraftLevel(Number(v))}>
              {buff.variants.map((name, i) => (
                <FormControlLabel
                  key={name}
                  value={i + 1}
                  control={<Radio size="small" />}
                  label={name}
                  disabled={levelDisabled}
                />
              ))}
            </RadioGroup>
          </Box>
        ) : hasLevel ? (
          <Box sx={{ mt: 1, px: 1 }}>
            <Typography variant="body2" gutterBottom>스킬 레벨: {draftLevel} / {master}</Typography>
            {buff.id === '1121000' && (
              <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                {[0, 10, 20, 30].map((v) => (
                  <Button
                    key={v}
                    size="small"
                    variant={draftLevel === v ? 'contained' : 'outlined'}
                    disabled={levelDisabled}
                    onClick={() => setDraftLevel(v)}
                    sx={{ minWidth: 0, flex: 1, py: 0.25 }}
                  >
                    {v}
                  </Button>
                ))}
              </Box>
            )}
            <Slider
              min={buff.id === '1121000' ? 0 : 1}
              max={master}
              value={draftLevel}
              disabled={levelDisabled}
              onChange={(_, v) => setDraftLevel(v as number)}
              valueLabelDisplay="auto"
            />
          </Box>
        ) : (
          <Typography variant="caption" color="text.disabled">레벨 조정 없음</Typography>
        )}
        {buff.id === SUPER_BODY_ID ? (
          // 슈퍼바디: 세 오라의 강화 내용을 모두 보여준다
          <Box sx={{ mt: 1 }}>
            {SUPER_BODY_AURAS.map((a) => (
              <Typography key={a.id} variant="body2" color="success.main">
                {a.name}: {superBodyAuraText(a.id, draftLevel)}
              </Typography>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
            {buff.id === '1220010' ? advChargeCaption(draftLevel) : (magicGuardCaption(buff, draftLevel) ?? (formatEffects(eff) || '—'))}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        {/* 적용된 버프(도핑 목록)만 — 목록에서 바로 뺀다 */}
        {kind === 'applied' && (
          <Button
            color="error"
            onClick={() => {
              removeBuff(buff.id)
              onClose()
            }}
            sx={{ mr: 'auto' }}
          >
            삭제
          </Button>
        )}
        <Button onClick={onClose} color="inherit">취소</Button>
        <Button onClick={apply} variant="contained">적용</Button>
      </DialogActions>
    </Dialog>
  )
}

/** 토글형 버프 행 (영메·메용 / 직업 특화 패시브) — 아이콘 클릭 시 모달 */
function BuffRow({ buff, onOpen }: { buff: Buff; onOpen: (b: Buff) => void }) {
  const level = useBuildStore((s) => s.activeBuffs[buff.id])
  const remembered = useBuildStore((s) => s.buffLevels[buff.id])
  const toggleBuff = useBuildStore((s) => s.toggleBuff)
  const jobId = useBuildStore((s) => s.jobId)
  const activeBuffs = useBuildStore((s) => s.activeBuffs)
  const equipped = useBuildStore((s) => s.equipped)
  const invItems = useInventoryStore((s) => s.items)
  // 선행 버프(requires)가 off면 이 버프도 off로 취급(표시)
  const requires = buff.type === 'skill' ? buff.requires : undefined
  const reqActive = requires ? activeBuffs[requires] !== undefined : true
  // 방패 필요(블로킹): 보조무기에 방패가 없으면 off로 취급
  const requiresShield = buff.type === 'skill' && !!buff.requiresShield
  const shieldOk = !requiresShield || equippedHasShield(equipped, invItems)
  const active = level !== undefined && reqActive && shieldOk
  const shownLevel = Math.min(active ? (level as number) : remembered ?? defaultBuffLevel(buff, jobId), effectiveMasterLevel(buff, jobId))
  const eff = buffEffectsAtLevel(buff, shownLevel)
  const comboText = comboEffectText(buff, activeBuffs, jobId)
  // 어드밴스드 차지: 차지 블로우 계수 강화 설명
  const advText = buff.id === '1220010' ? advChargeCaption(shownLevel) : null
  const mgText = magicGuardCaption(buff, shownLevel)
  const lcText = skillChargeCaption(buff, shownLevel, eff)
  const effText = formatEffects(eff)
  // note는 보조 안내문 — 효과가 있으면 뒤에 덧붙이고(스턴 마스터리의 적용 범위 안내),
  // 효과가 없으면 단독 표시(미구현 스킬 표기)
  const noteText = buff.note ? (effText ? `${effText} · ${buff.note}` : buff.note) : null
  const sbText = superBodyCaption(buff, shownLevel, activeBuffs)
  const caption = requiresShield && !shieldOk ? '방패 착용 필요' : (mgText ?? lcText ?? sbText ?? noteText ?? advText ?? comboText ?? (effText || '—'))
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.25 }}>
      <BuffIcon buff={buff} active={active} highlightActive onClick={() => toggleBuff(buff.id)} onLongPress={() => onOpen(buff)} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <BuffName buff={buff} level={shownLevel} />
        <Typography variant="caption" color={active ? 'success.main' : 'text.disabled'} noWrap sx={{ display: 'block' }}>
          {caption}
        </Typography>
      </Box>
    </Box>
  )
}

/** 슈퍼바디(배틀메이지) — 켜진 오라에 강화분을 얹는다(boostedBy) */
const SUPER_BODY_ID = '32111005'
/** 슈퍼바디가 강화하는 오라(기본 오라 id). 어드밴스드 오라도 같은 강화분이라 기본 쪽 데이터로 표시 */
const SUPER_BODY_AURAS = [
  { id: '32001003', name: '다크 오라' },
  { id: '32101003', name: '옐로우 오라' },
  { id: '32101002', name: '블루 오라' },
]

/** 슈퍼바디 레벨별 오라 하나의 강화 문구. 블루 오라는 무적이라 EffectMap이 없어 스킬북 blueTime으로 적는다 */
function superBodyAuraText(auraId: string, level: number): string {
  const aura = getBuff(auraId)
  const boost = aura?.type === 'skill' ? aura.boostedBy : undefined
  if (boost) return formatEffects(boost.effectsByLevel[level - 1] ?? {}) || '—'
  return `${skillNumAt(Number(SUPER_BODY_ID), level, 'blueTime')}초간 무적`
}

/** 슈퍼바디 행 설명 — 켜진 오라가 있으면 그 오라의 강화 내용, 없으면 null(기본 note) */
function superBodyCaption(buff: Buff, level: number, activeBuffs: Record<string, number>): string | null {
  if (buff.id !== SUPER_BODY_ID) return null
  const on = SUPER_BODY_AURAS.find((a) => activeBuffs[a.id] !== undefined)
  return on ? `${on.name}: ${superBodyAuraText(on.id, level)}` : null
}

/** 어드밴스드 차지 설명: 차지 블로우 계수를 레벨별 값으로 강화 */
function advChargeCaption(level: number): string {
  const sk = findSkillById(1220010)
  const att = sk ? skillAttackAt(sk, level) : null
  return `차지 블로우 데미지 계수 ${att?.skillPercent ?? 350}%`
}

/** 스킬 damage%가 곧 차지 기본배수인 차지 — 버프 id → 속성 표시명 */
const SKILL_CHARGE_ELEMENT: Record<string, string> = {
  '15101006': '번개', // 라이트닝 차지 (스트라이커)
  '11111007': '성',   // 소울 차지 (소울마스터)
}

/**
 * 차지 버프 설명: 속성 / 데미지% / 약점·반감 공격 시 총 배율.
 * 차지는 데미지 증가(`damage`)와 속성배율(`z`)을 함께 갖고 서로 곱해진다.
 *   무반응 = damage%,  약점 = damage% × (1 + z/200),  반감 = damage% × (1 − z/200)
 */
function skillChargeCaption(buff: Buff, level: number, eff: EffectMap): string | null {
  const el = SKILL_CHARGE_ELEMENT[buff.id]
  if (!el) return null
  const id = Number(buff.id)
  const dmg = skillNumAt(id, level, 'damage')
  const z = skillNumAt(id, level, 'z')
  const parts = [`${el} 속성`, `데미지 ${dmg}%`]
  parts.push(`약점 공격시 ${Math.round(dmg * (1 + z / 200))}%`)
  parts.push(`반감 공격시 ${Math.round(dmg * (1 - z / 200))}%`)
  if (eff.mad) parts.push(`마력 +${eff.mad}`)
  return parts.join(', ')
}

/** 매직가드(2001002·12001001) 설명: 레벨별 MP 전환 비율. 그 외 null */
function magicGuardCaption(buff: Buff, level: number): string | null {
  if (!MAGIC_GUARD_IDS.has(buff.id)) return null
  const n = buffEffectsAtLevel(buff, level).incomingDamageReduceP ?? 0
  return `데미지의 ${n}%를 MP로 전환`
}

/** 콤보 어택 계열 버프의 효과 표기 ("데미지 ×n배 증가"). 그 외 null */
function comboEffectText(buff: Buff, activeBuffs: Record<string, number>, jobId: JobId | null): string | null {
  const cs = jobId ? COMBO_SKILLS[jobId] : undefined
  if (!cs) return null
  const cl = activeBuffs[String(cs.combo)] ?? 0
  const al = activeBuffs[String(cs.adv)] ?? 0
  if (buff.id === String(cs.combo)) {
    const mult = 1 + comboFinalDamageP(cs.combo, cl, cs.adv, al) / 100
    return `데미지 ×${mult.toFixed(2)} 증가`
  }
  if (buff.id === String(cs.adv)) return '최대 콤보 10 카운터'
  return null
}

/**
 * 무기 마스터리/엑스퍼트 행 (장착 무기 자동 적용 · 아이콘 클릭 시 레벨 모달).
 * applied=false면 장착 무기가 맞지 않아 효과가 안 들어가는 상태 — 회색으로 표시한다.
 */
function MasteryRow({ buff, applied, unappliedNote, onOpen }: {
  buff: Buff
  applied: boolean
  /** 미적용 사유 캡션 (applied=false일 때만 사용) */
  unappliedNote?: string
  onOpen: (b: Buff) => void
}) {
  const level = useBuildStore((s) => s.masteryLevels[buff.id])
  const off = useBuildStore((s) => !!s.masteryOff[buff.id])
  const toggleMastery = useBuildStore((s) => s.toggleMastery)
  const isSkill = buff.type === 'skill'
  const shownLevel = level ?? (isSkill ? buff.masterLevel : 1)
  const eff = buffEffectsAtLevel(buff, shownLevel)
  const active = applied && !off
  const effText = formatEffects(eff) || '—'
  const caption = applied ? effText : unappliedNote ?? effText
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.25 }}>
      <BuffIcon buff={buff} active={active} highlightActive onClick={() => toggleMastery(buff.id)} onLongPress={() => onOpen(buff)} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <BuffName buff={buff} level={shownLevel} />
        <Typography variant="caption" color={active ? 'success.main' : 'text.disabled'} noWrap sx={{ display: 'block' }}>
          {caption}
        </Typography>
      </Box>
    </Box>
  )
}

/**
 * 도핑 목록 편집 창 안에서 쓰는 레벨 고르기 — draft에만 반영한다(스토어 커밋은 편집 창의 [적용]).
 * 변형형 버프는 버전 라디오, 그 외는 레벨 슬라이더.
 */
function DraftLevelDialog({ buff, level, onApply, onRemove, onClose }: {
  buff: Buff
  level: number
  onApply: (lv: number) => void
  /** 목록에 들어 있는 항목일 때만 — 목록에서 뺀다 */
  onRemove?: () => void
  onClose: () => void
}) {
  const jobId = useBuildStore((s) => s.jobId)
  const master = effectiveMasterLevel(buff, jobId)
  const [lv, setLv] = useState(Math.min(level, master))
  const variants = buff.type === 'skill' ? buff.variants : undefined
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <BuffIcon buff={buff} size={36} />
        {buff.name}
      </DialogTitle>
      <DialogContent>
        {variants ? (
          <RadioGroup value={lv} onChange={(_, v) => setLv(Number(v))}>
            {variants.map((name, i) => (
              <FormControlLabel key={name} value={i + 1} control={<Radio size="small" />} label={name} />
            ))}
          </RadioGroup>
        ) : master > 1 ? (
          <Box sx={{ px: 1 }}>
            <Typography variant="body2" gutterBottom>스킬 레벨: {lv} / {master}</Typography>
            <Slider min={1} max={master} value={lv} onChange={(_, v) => setLv(v as number)} valueLabelDisplay="auto" />
          </Box>
        ) : (
          <Typography variant="caption" color="text.disabled">레벨 조정 없음</Typography>
        )}
        <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
          {formatEffects(buffEffectsAtLevel(buff, lv)) || '—'}
        </Typography>
      </DialogContent>
      <DialogActions>
        {onRemove && (
          <Button color="error" onClick={onRemove} sx={{ mr: 'auto' }}>
            삭제
          </Button>
        )}
        <Button onClick={onClose} color="inherit">취소</Button>
        <Button onClick={() => onApply(lv)} variant="contained">적용</Button>
      </DialogActions>
    </Dialog>
  )
}

/** 카테고리 필터 기본값 — 전부 표시 */
const ALL_CATEGORY_IDS: BuffCategoryId[] = BUFF_CATEGORIES.map((c) => c.id)

/**
 * 필터 체크박스 배치 — 2줄 × 3묶음(묶음마다 2개), 첫 열에 '전체'.
 *   전체 | 공격력     마력     | 방어력 마법방어력 | 이동속도           점프력
 *        | 추가공격력 추가마력 | 회피율 명중률     | 공격속도(시전속도) 기타
 * 체크박스 하나가 격자 한 칸이라 위아래 줄이 같은 열끼리 정렬된다.
 */
const FILTER_ROWS: BuffCategoryId[][][] = [
  [['pad', 'mad'], ['pdef', 'mdef'], ['speed', 'jump']],
  [['addPad', 'addMad'], ['eva', 'acc'], ['attackSpeed', 'etc']],
]
const CATEGORY_LABEL = new Map(BUFF_CATEGORIES.map((c) => [c.id, c.label]))

/**
 * 도핑 목록 편집 — 위에서부터
 *  1) 목록에 올라간 도핑 (좌클릭: 목록에서 제거)
 *  2) 카테고리 필터 체크박스
 *  3) 카테고리별(공격력·마력·…·기타) 고를 수 있는 도핑 — 한 줄에 '스킬 아이콘 | 아이템 아이콘'
 *     (좌클릭: 추가/제거, 목록에 있으면 황금 테두리). 효과가 여럿이면 해당 카테고리마다 나온다(domain/buffCategory.ts)
 * 우클릭(모바일 길게 누르기)은 어디서든 레벨 변경 — 레벨 있는 스킬만. 아래에서 고르면 목록에도 들어간다.
 * 전부 로컬 draft에만 반영하고 [적용]을 눌러야 스토어에 커밋된다.
 * 새로 넣은 항목은 켜진 채로 들어가고, 원래 있던 항목은 on/off를 유지한다(buildStore.setDopingList).
 */
function DopingEditorDialog({ skills, items, onClose }: {
  /** 버프 스킬 (이 직업이 가진 것이 앞) */
  skills: Buff[]
  /** 아이템 도핑 */
  items: Buff[]
  onClose: () => void
}) {
  const setDopingList = useBuildStore((s) => s.setDopingList)
  const jobId = useBuildStore((s) => s.jobId)
  const [draft, setDraft] = useState<Record<string, number>>(() => {
    const s = useBuildStore.getState()
    return { ...(s.dopingList ?? {}), ...s.appliedBuffs }
  })
  const [levelFor, setLevelFor] = useState<Buff | null>(null)
  // 필터 체크 상태는 기기별로 기억한다(uiStore) — 열 때마다 마지막 상태로
  const hiddenCats = useUiStore((s) => s.hiddenDopingCategories)
  const setHiddenCats = useUiStore((s) => s.setHiddenDopingCategories)
  const shownCats = new Set(ALL_CATEGORY_IDS.filter((id) => !hiddenCats.includes(id)))
  const setShownCats = (next: Set<BuffCategoryId>) => setHiddenCats(ALL_CATEGORY_IDS.filter((id) => !next.has(id)))

  const all = [...skills, ...items]
  // 목록 줄은 넣은 순서대로 (draft 키 순서)
  const listed = Object.keys(draft)
    .map((id) => all.find((b) => b.id === id))
    .filter((b): b is Buff => !!b)

  const toggle = (b: Buff) =>
    setDraft((d) => {
      const next = { ...d }
      if (b.id in next) delete next[b.id]
      else next[b.id] = defaultBuffLevel(b, jobId)
      return next
    })
  const levelOf = (b: Buff) => draft[b.id] ?? defaultBuffLevel(b, jobId)
  const leveled = (b: Buff) => b.type === 'skill' && effectiveMasterLevel(b, jobId) > 1

  // 카테고리 판정은 기본 레벨(스킬은 마스터) 효과로 한다 — 레벨을 바꿔도 카테고리가 흔들리지 않게
  const catsOf = (b: Buff) => buffCategoriesOf(buffEffectsAtLevel(b, defaultBuffLevel(b, jobId)))
  const sections = BUFF_CATEGORIES.map((c) => ({
    ...c,
    skills: skills.filter((b) => catsOf(b).includes(c.id)),
    items: items.filter((b) => catsOf(b).includes(c.id)),
  })).filter((c) => c.skills.length + c.items.length > 0)

  const allShown = ALL_CATEGORY_IDS.every((id) => shownCats.has(id))
  const noneShown = ALL_CATEGORY_IDS.every((id) => !shownCats.has(id))
  const toggleCat = (id: BuffCategoryId) => {
    const next = new Set(shownCats)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setShownCats(next)
  }

  const pickIcon = (b: Buff) => {
    const on = b.id in draft
    return (
      <BuffIcon
        key={b.id}
        buff={b}
        size={44}
        pixelScale={1}
        ringed={on}
        levelBadge={on && hasLevelBadge(b) ? levelOf(b) : undefined}
        tooltip={buffTooltip(b, levelOf(b))}
        onClick={() => toggle(b)}
        onLongPress={leveled(b) || on ? () => setLevelFor(b) : undefined}
      />
    )
  }

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>도핑 목록 편집</DialogTitle>
      <DialogContent dividers sx={{ pt: 1 }}>
        <ActionHint
          sx={{ mb: 1 }}
          actions={[
            { key: '좌클릭', desc: '추가 / 제거' },
            { key: EDIT_HINT_KEY, desc: '편집 (레벨 · 삭제)', tone: 'secondary', note: '모바일: 길게 누르기' },
          ]}
        />

        {/* 1) 목록에 올라간 도핑 */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, minHeight: 48, alignItems: 'center', pt: 0.5 }}>
          {listed.length === 0 ? (
            <Typography variant="caption" color="text.disabled">아래에서 아이콘을 눌러 목록에 추가하세요</Typography>
          ) : (
            listed.map((b) => (
              <BuffIcon
                key={b.id}
                buff={b}
                size={44}
                pixelScale={1}
                ringed={false}
                levelBadge={hasLevelBadge(b) ? levelOf(b) : undefined}
                tooltip={buffTooltip(b, levelOf(b), '좌클릭으로 목록에서 제거')}
                onClick={() => toggle(b)}
                onLongPress={() => setLevelFor(b)}
              />
            ))
          )}
        </Box>

        {/* 2) 카테고리 필터 */}
        <Divider sx={{ my: 1.25 }} />
        <Box
          sx={{
            display: 'grid',
            // 전체 + (묶음 3개 × 체크박스 2개)
            gridTemplateColumns: 'auto repeat(6, auto)',
            justifyContent: 'start',
            alignItems: 'center',
            columnGap: 1,
            // 묶음 첫 칸 왼쪽에 세로 구분선
            '& > .grp': { borderLeft: 1, borderColor: 'divider', pl: 1 },
          }}
        >
          {FILTER_ROWS.map((row, ri) => [
            <Box key={`all-${ri}`}>
              {ri === 0 && (
                <FormControlLabel
                  sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontSize: 13, fontWeight: 700 } }}
                  control={
                    <Checkbox
                      size="small"
                      sx={{ p: 0.5 }}
                      checked={allShown}
                      indeterminate={!allShown && !noneShown}
                      onChange={() => setShownCats(allShown ? new Set() : new Set(ALL_CATEGORY_IDS))}
                    />
                  }
                  label="전체"
                />
              )}
            </Box>,
            ...row.flatMap((pair, ci) =>
              pair.map((id, k) => (
                <Box key={`${ri}-${ci}-${id}`} className={k === 0 ? 'grp' : undefined}>
                  <FormControlLabel
                    sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontSize: 13, whiteSpace: 'nowrap' } }}
                    control={<Checkbox size="small" sx={{ p: 0.5 }} checked={shownCats.has(id)} onChange={() => toggleCat(id)} />}
                    label={CATEGORY_LABEL.get(id)}
                  />
                </Box>
              )),
            ),
          ])}
        </Box>

        {/* 3) 카테고리별 도핑 — 스킬 | 아이템 */}
        {noneShown && (
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.5, textAlign: 'center' }}>
            표시할 카테고리를 선택하세요
          </Typography>
        )}
        {sections
          .filter((c) => shownCats.has(c.id))
          .map((c) => (
            <Box key={c.id} sx={{ mt: 1.25 }}>
              {/* '공격력 ───────' — 제목과 구분선을 한 줄에 (왼쪽 선은 없앤다) */}
              <Divider
                textAlign="left"
                sx={{
                  mb: 0.75,
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'text.secondary',
                  '&::before': { display: 'none' },
                  '& .MuiDivider-wrapper': { pl: 0 },
                }}
              >
                {c.label}
              </Divider>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
                {c.skills.map(pickIcon)}
                {c.skills.length > 0 && c.items.length > 0 && (
                  <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                )}
                {c.items.map(pickIcon)}
              </Box>
            </Box>
          ))}
      </DialogContent>
      <DialogActions>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto', pl: 1 }}>
          {listed.length}개 선택
        </Typography>
        <Button color="inherit" disabled={listed.length === 0} onClick={() => setDraft({})}>
          전체 해제
        </Button>
        <Button onClick={onClose} color="inherit">취소</Button>
        <Button
          variant="contained"
          onClick={() => {
            setDopingList(draft)
            onClose()
          }}
        >
          적용
        </Button>
      </DialogActions>
      {levelFor && (
        <DraftLevelDialog
          buff={levelFor}
          level={levelOf(levelFor)}
          // 레벨을 고르면 그 항목은 목록에 들어간다
          onApply={(lv) => {
            setDraft((d) => ({ ...d, [levelFor.id]: lv }))
            setLevelFor(null)
          }}
          onRemove={
            levelFor.id in draft
              ? () => {
                  toggle(levelFor)
                  setLevelFor(null)
                }
              : undefined
          }
          onClose={() => setLevelFor(null)}
        />
      )}
    </Dialog>
  )
}

/**
 * 적용된 버프(도핑 목록) — 좌클릭: ON/OFF / 우클릭: 편집(레벨 변경·삭제) / 호버: 효과.
 * 켜진 항목은 황금빛 테두리, 꺼진 항목은 회색. 레벨이 있는 스킬은 우상단에 레벨 배지.
 * 무기 부스터처럼 장착 무기를 타는 버프는 무기가 맞지 않으면 켜져 있어도 회색(미적용)으로 표시한다.
 */
function AppliedBuffList({ entries, levels, applied, weaponType, onOpen, onToggle }: {
  entries: Buff[]
  /** 목록의 레벨 기억 (꺼진 항목 포함) */
  levels: Record<string, number>
  /** 켜진 항목 */
  applied: Record<string, number>
  weaponType?: WeaponType
  onOpen: (b: Buff) => void
  onToggle: (id: string) => void
}) {
  if (entries.length === 0) {
    return <Typography variant="caption" color="text.disabled">도핑 목록 편집에서 버프를 추가하세요</Typography>
  }
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, pt: 0.5 }}>
      {entries.map((b) => {
        const on = b.id in applied
        const lv = applied[b.id] ?? levels[b.id] ?? defaultBuffLevel(b)
        const gateNote = weaponGateNote(b, weaponType)
        return (
          <BuffIcon
            key={b.id}
            buff={b}
            active={on && !gateNote}
            highlightActive
            size={44}
            levelBadge={hasLevelBadge(b) ? lv : undefined}
            tooltip={buffTooltip(b, lv, on ? gateNote : '꺼짐 — 좌클릭으로 켜기')}
            onClick={() => onToggle(b.id)}
            onLongPress={() => onOpen(b)}
          />
        )
      })}
    </Box>
  )
}

/** 차지 행 (메인/보조) — 좌클릭 토글, 우클릭 편집 */
function ChargeRow({
  icon, active, disabled = false, title, caption, onToggle, onOpen,
}: {
  icon: string; active: boolean; disabled?: boolean; title: string; caption: string
  onToggle: () => void; onOpen?: () => void
}) {
  const lp = useTouchLongPress(() => onOpen?.())
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.25, opacity: disabled ? 0.5 : 1 }}>
      <Box
        onClick={disabled ? undefined : () => { if (lp.fired.current) { lp.fired.current = false; return } onToggle() }}
        onContextMenu={disabled || !onOpen ? undefined : (e) => { e.preventDefault(); onOpen() }}
        {...(disabled ? {} : lp.touchProps)}
        sx={{
          width: 46, height: 46, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: 'action.hover', borderRadius: 0.5, border: '2.5px solid transparent',
          boxShadow: active ? 'inset 0 0 0 5px #ffc53d' : 'none', cursor: disabled ? 'default' : 'pointer',
          WebkitTouchCallout: 'none', userSelect: 'none',
          position: 'relative',
          '@media (hover: hover)': { '&:hover .edit-badge': { opacity: 1, pointerEvents: 'auto' } },
        }}
      >
        <Box component="img" src={icon} alt="" sx={{ width: 38, height: 38, imageRendering: 'pixelated', filter: active ? 'none' : 'grayscale(1)' }} />
        {!disabled && onOpen && <EditBadgeButton onClick={onOpen} />}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap>{title}</Typography>
        <Typography variant="caption" color={active ? 'success.main' : 'text.disabled'} noWrap sx={{ display: 'block' }}>{caption}</Typography>
      </Box>
    </Box>
  )
}

/** 메인 차지 편집 모달: 원소 라디오 + 레벨 슬라이더 (적용/취소) */
function ChargeMainDialog({ element, level, onApply, onClose }: { element: ChargeElement; level: number; onApply: (el: ChargeElement, lv: number) => void; onClose: () => void }) {
  const [el, setEl] = useState<ChargeElement>(element)
  const [lv, setLv] = useState(level)
  const max = CHARGE_MASTER[el]
  const shown = Math.min(lv, max)
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>메인 차지 선택</DialogTitle>
      <DialogContent>
        <RadioGroup value={el} onChange={(_, v) => setEl(v as ChargeElement)} sx={{ mb: 1 }}>
          {CHARGE_ELEMENTS.map((e) => (
            <FormControlLabel key={e} value={e} control={<Radio size="small" />} label={`${CHARGE_LABEL[e]} 차지`} />
          ))}
        </RadioGroup>
        <Typography variant="body2" gutterBottom>스킬 레벨: {shown} / {max}</Typography>
        <Slider min={1} max={max} value={shown} onChange={(_, v) => setLv(v as number)} valueLabelDisplay="auto" />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">취소</Button>
        <Button onClick={() => onApply(el, Math.min(lv, max))} variant="contained">적용</Button>
      </DialogActions>
    </Dialog>
  )
}

/** 보조(썬더) 차지 레벨 편집 모달 */
function ChargeSubDialog({ level, onApply, onClose }: { level: number; onApply: (lv: number) => void; onClose: () => void }) {
  const [lv, setLv] = useState(level)
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>보조 차지 (썬더)</DialogTitle>
      <DialogContent>
        <Typography variant="body2" gutterBottom>스킬 레벨: {lv} / 30</Typography>
        <Slider min={1} max={30} value={lv} onChange={(_, v) => setLv(v as number)} valueLabelDisplay="auto" />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">취소</Button>
        <Button onClick={() => onApply(lv)} variant="contained">적용</Button>
      </DialogActions>
    </Dialog>
  )
}

/** 팔라딘 차지 섹션 (메인 + 보조) */
function ChargeSection() {
  const charge = useBuildStore((s) => s.charge) ?? DEFAULT_CHARGE
  const setCharge = useBuildStore((s) => s.setCharge)
  const [dlg, setDlg] = useState<'main' | 'sub' | null>(null)
  const mainIsThunder = charge.mainElement === 'lightning'
  // 각 차지의 데미지 증가%(damage 필드). 예: 파이어 30레벨 = 140%
  const mainBase = chargeDamagePercent(charge.mainElement, charge.mainLevel)
  const subBase = chargeDamagePercent('lightning', charge.subLevel)
  return (
    <>
      {/* 차지배율은 데미지 계산 섹션에서만 표기한다(대상 몬스터가 있어야 의미가 있어서) */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        차지
      </Typography>
      <ActionHint
        sx={{ mb: 0.5 }}
        actions={[
          { key: '좌클릭', desc: 'ON / OFF' },
          { key: EDIT_HINT_KEY, desc: '편집', tone: 'secondary', note: '모바일: 길게 누르기' },
        ]}
      />
      <ChargeRow
        icon={CHARGE_ICON[charge.mainElement]}
        active={charge.mainOn}
        title={`메인 차지 [${CHARGE_LABEL[charge.mainElement]}]`}
        caption={charge.mainOn ? `Lv.${charge.mainLevel} · 데미지 ${mainBase}%` : '꺼짐'}
        onToggle={() => setCharge({ mainOn: !charge.mainOn })}
        onOpen={() => setDlg('main')}
      />
      <ChargeRow
        icon={CHARGE_ICON.lightning}
        active={charge.subOn && !mainIsThunder}
        disabled={mainIsThunder}
        title="보조 차지 [썬더]"
        caption={mainIsThunder ? '비활성' : charge.subOn ? `Lv.${charge.subLevel} · 데미지 ${subBase}%` : '꺼짐'}
        onToggle={() => setCharge({ subOn: !charge.subOn })}
        onOpen={() => setDlg('sub')}
      />
      {dlg === 'main' && (
        <ChargeMainDialog element={charge.mainElement} level={charge.mainLevel}
          onApply={(el, lv) => { setCharge({ mainElement: el, mainLevel: lv }); setDlg(null) }} onClose={() => setDlg(null)} />
      )}
      {dlg === 'sub' && (
        <ChargeSubDialog level={charge.subLevel} onApply={(lv) => { setCharge({ subLevel: lv }); setDlg(null) }} onClose={() => setDlg(null)} />
      )}
    </>
  )
}

function SectionTitle({ children, sx }: { children: React.ReactNode; sx?: object }) {
  return (
    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.25, ...sx }}>
      {children}
    </Typography>
  )
}

export default function SkillPanel() {
  const jobId = useBuildStore((s) => s.jobId)
  const equipped = useBuildStore((s) => s.equipped)
  const invItems = useInventoryStore((s) => s.items)
  const appliedBuffs = useBuildStore((s) => s.appliedBuffs)
  const dopingList = useBuildStore((s) => s.dopingList)
  const toggleDoping = useBuildStore((s) => s.toggleDoping)
  const weaponType = equippedWeaponType(equipped, invItems)

  const [dlg, setDlg] = useState<{ buff: Buff; kind: BuffKind } | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const open = (kind: BuffKind) => (buff: Buff) => setDlg({ buff, kind })

  const jobPassives = jobId ? JOB_BUFFS.filter((b) => canUseBuff(b, jobId)) : []
  // 무기 마스터리는 장착 여부와 무관하게 노출한다. 장착 무기에 맞는 게 없으면
  // 직업 기본 무기의 마스터리를 회색(미적용)으로 보여줘, 스킬 자체가 없는 것처럼
  // 보이지 않게 한다. 효과 합산은 종전대로 장착 무기가 맞을 때만 들어간다.
  const masteries = jobMasteries(jobId)
  const shownMasteries = displayedMasteries(jobId, weaponType)
  const masteryApplied = appliedMasteries(jobId, weaponType).length > 0
  const unappliedNote = weaponType
    ? `${WEAPON_CONSTANTS[weaponType]?.label ?? '장착 무기'} 마스터리 없음 — 미적용`
    : '무기 미장착 — 미적용'
  // 특화 패시브: 직업 패시브(무기 마스터리 제외) + 개인 패시브 스킬(블로킹 등)
  // 매직가드는 맨 위로 (안정 정렬로 나머지 순서 유지)
  const otherPassives = [
    ...jobPassives.filter((b) => !(b.type === 'skill' && b.weaponTypes)),
    ...(jobId ? PERSONAL_BUFFS.filter((b) => canUseBuff(b, jobId) && b.type === 'skill' && b.mode === 'passive') : []),
  ].sort((a, b) => (MAGIC_GUARD_IDS.has(b.id) ? 1 : 0) - (MAGIC_GUARD_IDS.has(a.id) ? 1 : 0))

  // 도핑 목록 편집 풀 — 개인 액티브 스킬(패시브는 특화 섹션으로) + 파티 버프 전부.
  // 그중 이 직업이 직접 가진 것(개인스킬 + 소유 파티버프)을 '개인'으로 앞에 모은다.
  const buffPool = jobId
    ? [
        ...PERSONAL_BUFFS.filter((b) => canUseBuff(b, jobId) && !(b.type === 'skill' && b.mode === 'passive')),
        ...PARTY_BUFFS,
      ]
    : PARTY_BUFFS
  // 버프 스킬은 이 직업이 직접 가진 것(개인 스킬 + 소유 파티버프)을 앞에 둔다
  const editorSkills = [...buffPool.filter((b) => ownsBuff(b, jobId)), ...buffPool.filter((b) => !ownsBuff(b, jobId))]

  // 목록 = 편집으로 고른 것(꺼진 것 포함). 구버전 상태엔 목록이 없을 수 있어 켜진 것과 합친다
  const listLevels = { ...(dopingList ?? {}), ...appliedBuffs }
  const listEntries = Object.keys(listLevels)
    .map((id) => [...DOPING_ITEMS, ...PERSONAL_BUFFS, ...PARTY_BUFFS].find((b) => b.id === id))
    .filter((b): b is Buff => !!b)
  // 켜진 것만, 무기가 맞지 않아 미적용인 버프(부스터 등)는 빼고 합산 — activeBuffEffects와 같은 규칙
  const appliedEff = maxEffects(
    ...listEntries
      .filter((b) => b.id in appliedBuffs && weaponGateOk(b, weaponType))
      .map((b) => buffEffectsAtLevel(b, appliedBuffs[b.id])),
  )

  return (
    <CollapsiblePanel id="skill" title="스킬 및 도핑">
      <SectionTitle>공통 버프</SectionTitle>
      <ActionHint
        sx={{ mb: 0.75 }}
        actions={[
          { key: '좌클릭', desc: 'ON / OFF' },
          { key: EDIT_HINT_KEY, desc: '레벨 변경', tone: 'secondary', note: '모바일: 길게 누르기' },
        ]}
      />
      {COMMON_BUFFS.map((b) => (
        <BuffRow key={b.id} buff={b} onOpen={open('toggle')} />
      ))}

      <Divider sx={{ my: 1 }} />

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
        <SectionTitle sx={{ mb: 0 }}>적용된 버프</SectionTitle>
        <Button size="small" variant="outlined" onClick={() => setEditorOpen(true)} sx={{ py: 0.125, fontSize: 12 }}>
          도핑 목록 편집
        </Button>
      </Box>
      <ActionHint
        sx={{ mb: 0.75 }}
        actions={[
          { key: '좌클릭', desc: 'ON / OFF' },
          { key: EDIT_HINT_KEY, desc: '편집 (레벨 · 삭제)', tone: 'secondary', note: '모바일: 길게 누르기' },
          { desc: '마우스를 올리면 효과를 표시합니다.' },
        ]}
      />
      <AppliedBuffList
        entries={listEntries}
        levels={listLevels}
        applied={appliedBuffs}
        weaponType={weaponType}
        onOpen={open('applied')}
        onToggle={toggleDoping}
      />

      <SectionTitle sx={{ mt: 1 }}>적용된 효과</SectionTitle>
      <Typography variant="body2" color="success.main">
        {formatEffects(appliedEff) || '—'}
      </Typography>

      <Divider sx={{ my: 1 }} />

      <SectionTitle>특화 버프 (패시브)</SectionTitle>
      <ActionHint
        sx={{ mb: 0.75 }}
        actions={[
          { key: '좌클릭', desc: 'ON / OFF' },
          { key: EDIT_HINT_KEY, desc: '레벨 변경', tone: 'secondary', note: '모바일: 길게 누르기' },
        ]}
      />
      {masteries.length > 0 && (
        <>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>무기 마스터리 (장착 무기 자동)</Typography>
          {shownMasteries.map((b) => (
            <MasteryRow key={b.id} buff={b} applied={masteryApplied} unappliedNote={unappliedNote} onOpen={open('mastery')} />
          ))}
        </>
      )}
      {otherPassives.map((b) => <BuffRow key={b.id} buff={b} onOpen={open('toggle')} />)}
      {jobId === 'paladin' && <ChargeSection />}
      {masteries.length === 0 && otherPassives.length === 0 && jobId !== 'paladin' && (
        <Typography variant="caption" color="text.disabled">사용 가능한 특화 버프 없음</Typography>
      )}

      {dlg && <BuffDialog buff={dlg.buff} kind={dlg.kind} onClose={() => setDlg(null)} />}
      {editorOpen && <DopingEditorDialog skills={editorSkills} items={DOPING_ITEMS} onClose={() => setEditorOpen(false)} />}
    </CollapsiblePanel>
  )
}
