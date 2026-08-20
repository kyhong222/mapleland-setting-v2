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
import CollapsiblePanel from '../common/CollapsiblePanel'
import ActionHint from '../common/ActionHint'
import { useBuildStore } from '../../store/buildStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { equippedWeaponType, equippedHasShield, jobMasteries, displayedMasteries, appliedMasteries } from '../../store/aggregate'
import { COMMON_BUFFS, PARTY_BUFFS, PERSONAL_BUFFS, DOPING_ITEMS, JOB_BUFFS } from '../../data/buff'
import { canUseBuff, buffEffectsAtLevel, defaultBuffLevel, effectiveMasterLevel } from '../../domain/buff'
import type { Buff } from '../../domain/buff'
import { maxEffects } from '../../domain/effects'
import type { EffectMap } from '../../domain/effects'
import type { JobId } from '../../domain/jobs'
import { WEAPON_CONSTANTS } from '../../domain/weapons'
import { comboFinalDamageP, COMBO_SKILLS, findSkillById, skillAttackAt, skillNumAt, chargeDamagePercent, chargeStats } from '../../data/skills'
import { CHARGE_LABEL, CHARGE_MASTER, CHARGE_ELEMENTS, chargeMultiplier, chargeFromUi } from '../../domain/paladinCharge'
import type { ChargeElement } from '../../domain/paladinCharge'
import { DEFAULT_CHARGE } from '../../store/buildStore'
import { useMonsterStore } from '../../store/monsterStore'
import { getMonster } from '../../data/mobs'
import { formatEffects } from '../../lib/effectFormat'
import { useTouchLongPress } from '../../lib/useLongPress'

/** 레벨 조정 대상: 토글버프(영메·메용/직업패시브) / 적용버프(도핑·개인·파티) / 마스터리 */
type BuffKind = 'toggle' | 'applied' | 'mastery'

/**
 * 스킬=아이콘 경로, 아이템=id로 아이콘 URL 유도.
 * 같은 스킬이라도 직업에 따라 아이콘이 다른 경우(시그너스 분노 등) iconByJob이 우선한다.
 */
function buffIconUrl(buff: Buff, jobId: JobId | null): string | undefined {
  if (buff.type === 'skill' && jobId && buff.iconByJob?.[jobId]) return buff.iconByJob[jobId]
  if (buff.icon) return buff.icon
  if (buff.type === 'item') return `https://maplestory.io/api/gms/62/item/${buff.id}/icon`
  return undefined
}

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

/** 버프 툴팁 내용: 이름(+레벨) / 효과 / 보조 안내문(note) */
function buffTooltip(buff: Buff, level: number): React.ReactNode {
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
      {buff.note && (
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.75 }}>
          {buff.note}
        </Typography>
      )}
    </Box>
  )
}

function BuffIcon({
  buff,
  active = true,
  onClick,
  onLongPress,
  size = 46,
  tooltip,
  highlightActive = false,
}: {
  buff: Buff
  active?: boolean
  onClick?: () => void
  /** 우클릭(데스크톱) / 롱프레스(모바일) 동작 — 레벨 조정 등 */
  onLongPress?: () => void
  size?: number
  tooltip?: React.ReactNode
  /** 적용(active) 시 밝은 황금빛 테두리로 강조할지 여부 */
  highlightActive?: boolean
}) {
  const lp = useTouchLongPress(() => onLongPress?.())
  const iconJobId = useBuildStore((s) => s.jobId)
  const icon = buffIconUrl(buff, iconJobId)
  const img = Math.round(size * 0.82)
  const highlighted = highlightActive && active
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
      }}
    >
      {icon && <Box component="img" src={icon} alt="" sx={{ width: img, height: img, imageRendering: 'pixelated', filter: active ? 'none' : 'grayscale(1)' }} />}
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
  const jobId = useBuildStore((s) => s.jobId)

  const isSkill = buff.type === 'skill'
  const master = effectiveMasterLevel(buff, jobId)

  // 스토어의 현재값(초기 draft) — 열릴 때 한 번만 캡처
  const [storeActive, storeLevel] = useState(() => {
    const s = useBuildStore.getState()
    const active = kind === 'toggle' ? buff.id in s.activeBuffs : true
    const fb = kind === 'toggle' ? s.buffLevels[buff.id] ?? defaultBuffLevel(buff, jobId) : defaultBuffLevel(buff, jobId)
    const lv = kind === 'toggle' ? s.activeBuffs[buff.id] ?? fb : kind === 'applied' ? s.appliedBuffs[buff.id] ?? fb : s.masteryLevels[buff.id] ?? fb
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
        <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
          {buff.id === '1220010' ? advChargeCaption(draftLevel) : (magicGuardCaption(buff, draftLevel) ?? (formatEffects(eff) || '—'))}
        </Typography>
      </DialogContent>
      <DialogActions>
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
  // note는 보조 안내문 — 효과가 있으면 뒤에 덧붙이고(스턴 마스터리 '스턴 상황 가정'),
  // 효과가 없으면 단독 표시(미구현 스킬 표기)
  const noteText = buff.note ? (effText ? `${effText} · ${buff.note}` : buff.note) : null
  const caption = requiresShield && !shieldOk ? '방패 착용 필요' : (mgText ?? lcText ?? noteText ?? advText ?? comboText ?? (effText || '—'))
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
const MAGIC_GUARD_IDS = new Set(['2001002', '12001001'])
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

/** 선택용 드롭다운 — 항목 선택 시 적용 목록에 추가(이미 적용된 버프는 목록에서 제외) */
/** 드롭다운 한 그룹 (개인 / 파티) */
interface BuffGroup {
  label: string
  items: Buff[]
}

function BuffSelect({ groups, appliedIds, onAdd, placeholder }: {
  groups: BuffGroup[]
  appliedIds: Set<string>
  onAdd: (id: string) => void
  placeholder: string
}) {
  const shown = groups
    .map((g) => ({ ...g, items: g.items.filter((b) => !appliedIds.has(b.id)) }))
    .filter((g) => g.items.length > 0)
  const row = (b: Buff) => (
    <MenuItem key={b.id} value={b.id} sx={{ fontSize: 13, gap: 0.75 }}>
      <BuffIcon buff={b} size={28} />
      <Box component="span" sx={{ flex: 1, minWidth: 0 }}>{b.name}</Box>
      <Box component="span" sx={{ color: 'success.main' }}>{formatEffects(buffEffectsAtLevel(b, defaultBuffLevel(b))) || '—'}</Box>
    </MenuItem>
  )
  return (
    <Select
      size="small"
      fullWidth
      displayEmpty
      value=""
      onChange={(e) => {
        const id = e.target.value as string
        if (id) onAdd(id)
      }}
      renderValue={() => <Box component="em" sx={{ color: 'text.disabled' }}>{placeholder}</Box>}
      sx={{ '& .MuiSelect-select': { py: 0.5, fontSize: 13, display: 'flex', alignItems: 'center' } }}
    >
      {shown.length === 0
        ? <MenuItem value="" disabled>추가할 버프 없음</MenuItem>
        : shown.flatMap((g, gi) => [
            gi > 0 ? <Divider key={`div-${g.label}`} /> : null,
            // 그룹이 하나뿐이면 굳이 머리글을 달지 않는다
            shown.length > 1 ? (
              <MenuItem key={`hdr-${g.label}`} value="" disabled sx={{ fontSize: 11, opacity: 1, color: 'text.secondary', fontWeight: 700, minHeight: 0, py: 0.25 }}>
                {g.label}
              </MenuItem>
            ) : null,
            ...g.items.map(row),
          ])}
    </Select>
  )
}

/** 적용된 버프 목록 — 좌클릭: 제거 / 우클릭: 레벨 변경(아이템 제외) / 호버: 효과 */
function AppliedBuffList({ entries, levels, onOpen, onRemove }: { entries: Buff[]; levels: Record<string, number>; onOpen: (b: Buff) => void; onRemove: (id: string) => void }) {
  if (entries.length === 0) return <Typography variant="caption" color="text.disabled">위에서 버프를 선택해 추가하세요</Typography>
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {entries.map((b) => {
        const lv = levels[b.id] ?? defaultBuffLevel(b)
        const hasLevel = b.type === 'skill' && b.masterLevel > 1
        return (
          <BuffIcon
            key={b.id}
            buff={b}
            size={44}
            tooltip={buffTooltip(b, lv)}
            onClick={() => onRemove(b.id)}
            onLongPress={hasLevel ? () => onOpen(b) : undefined}
          />
        )
      })}
    </Box>
  )
}

/** 차지 원소 → 버프 아이콘(검 대표) */
const CHARGE_ICON: Record<ChargeElement, string> = {
  fire: '/buff-icons/1211003.png',
  ice: '/buff-icons/1211005.png',
  lightning: '/buff-icons/1211007.png',
  holy: '/buff-icons/1221003.png',
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
        }}
      >
        <Box component="img" src={icon} alt="" sx={{ width: 38, height: 38, imageRendering: 'pixelated', filter: active ? 'none' : 'grayscale(1)' }} />
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
  const selectedMobId = useMonsterStore((s) => s.selectedId)
  const [dlg, setDlg] = useState<'main' | 'sub' | null>(null)
  const mainIsThunder = charge.mainElement === 'lightning'
  // 선택 몬스터 기준 차지배율 (데미지배수 × 속성배수)
  const state = charge.mainOn ? chargeFromUi(charge, chargeStats) : null
  const monster = selectedMobId != null ? getMonster(selectedMobId) : undefined
  const appliedMult = state ? chargeMultiplier(state, monster?.elemAttr) : null
  // 각 차지의 데미지 증가%(damage 필드). 예: 파이어 30레벨 = 140%
  const mainBase = chargeDamagePercent(charge.mainElement, charge.mainLevel)
  const subBase = chargeDamagePercent('lightning', charge.subLevel)
  return (
    <>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        차지
        {charge.mainOn && appliedMult != null && (
          <Box component="span" sx={{ color: 'success.main', fontWeight: 700, ml: 0.5 }}>
            · 차지배율 ×{appliedMult.toFixed(2)}
          </Box>
        )}
      </Typography>
      <ActionHint
        sx={{ mb: 0.5 }}
        actions={[
          { key: '좌클릭', desc: 'ON / OFF' },
          { key: '우클릭', desc: '편집', tone: 'secondary' },
        ]}
        note="모바일: 길게 누르기"
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
  const addBuff = useBuildStore((s) => s.addBuff)
  const removeBuff = useBuildStore((s) => s.removeBuff)
  const weaponType = equippedWeaponType(equipped, invItems)

  const [dlg, setDlg] = useState<{ buff: Buff; kind: BuffKind } | null>(null)
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

  // 버프 드롭다운 풀 — 개인 액티브 스킬(패시브는 특화 섹션으로) + 파티 버프 전부.
  // 그중 이 직업이 직접 가진 것(개인스킬 + 소유 파티버프)을 '개인'으로 앞에 모은다.
  const buffPool = jobId
    ? [
        ...PERSONAL_BUFFS.filter((b) => canUseBuff(b, jobId) && !(b.type === 'skill' && b.mode === 'passive')),
        ...PARTY_BUFFS,
      ]
    : PARTY_BUFFS
  const buffGroups = [
    { label: '개인 버프', items: buffPool.filter((b) => ownsBuff(b, jobId)) },
    { label: '파티 버프', items: buffPool.filter((b) => !ownsBuff(b, jobId)) },
  ]

  const appliedIds = new Set(Object.keys(appliedBuffs))
  const appliedEntries = Object.keys(appliedBuffs)
    .map((id) => [...DOPING_ITEMS, ...PERSONAL_BUFFS, ...PARTY_BUFFS].find((b) => b.id === id))
    .filter((b): b is Buff => !!b)
  const appliedEff = maxEffects(...appliedEntries.map((b) => buffEffectsAtLevel(b, appliedBuffs[b.id])))

  return (
    <CollapsiblePanel id="skill" title="스킬 및 도핑">
      <SectionTitle>공통 버프</SectionTitle>
      <ActionHint
        sx={{ mb: 0.75 }}
        actions={[
          { key: '좌클릭', desc: 'ON / OFF' },
          { key: '우클릭', desc: '레벨 변경', tone: 'secondary' },
        ]}
        note="모바일: 길게 누르기"
      />
      {COMMON_BUFFS.map((b) => (
        <BuffRow key={b.id} buff={b} onOpen={open('toggle')} />
      ))}

      <Divider sx={{ my: 1 }} />

      <SectionTitle>아이템 도핑</SectionTitle>
      <BuffSelect groups={[{ label: '아이템 도핑', items: DOPING_ITEMS }]} appliedIds={appliedIds} onAdd={addBuff} placeholder="도핑 선택하여 추가" />

      <SectionTitle sx={{ mt: 0.75 }}>버프</SectionTitle>
      <BuffSelect groups={buffGroups} appliedIds={appliedIds} onAdd={addBuff} placeholder="버프 선택하여 추가" />

      <Divider sx={{ my: 1 }} />

      <SectionTitle>적용된 버프</SectionTitle>
      <ActionHint
        sx={{ mb: 0.75 }}
        actions={[
          { key: '좌클릭', desc: '제거' },
          { key: '우클릭', desc: '레벨 변경', tone: 'secondary' },
          { key: '호버', desc: '효과 보기', tone: 'default' },
        ]}
        note="모바일: 길게 누르기"
      />
      <AppliedBuffList entries={appliedEntries} levels={appliedBuffs} onOpen={open('applied')} onRemove={removeBuff} />

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
          { key: '우클릭', desc: '레벨 변경', tone: 'secondary' },
        ]}
        note="모바일: 길게 누르기"
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
    </CollapsiblePanel>
  )
}
