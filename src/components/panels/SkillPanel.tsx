import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import Slider from '@mui/material/Slider'
import Switch from '@mui/material/Switch'
import Button from '@mui/material/Button'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Tooltip from '@mui/material/Tooltip'
import CollapsiblePanel from '../common/CollapsiblePanel'
import { useBuildStore } from '../../store/buildStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { equippedWeaponType } from '../../store/aggregate'
import { COMMON_BUFFS, PARTY_BUFFS, PERSONAL_BUFFS, DOPING_ITEMS, JOB_BUFFS } from '../../data/buff'
import { canUseBuff, buffEffectsAtLevel, defaultBuffLevel } from '../../domain/buff'
import type { Buff } from '../../domain/buff'
import { maxEffects } from '../../domain/effects'
import { formatEffects } from '../../lib/effectFormat'

/** 레벨 조정 대상: 토글버프(영메·메용/직업패시브) / 적용버프(도핑·개인·파티) / 마스터리 */
type BuffKind = 'toggle' | 'applied' | 'mastery'

/** 스킬=base64 data URI, 아이템=id로 아이콘 URL 유도 */
function buffIconUrl(buff: Buff): string | undefined {
  if (buff.icon) return buff.icon
  if (buff.type === 'item') return `https://maplestory.io/api/gms/62/item/${buff.id}/icon`
  return undefined
}

/** 이름 앞 접두사: 변형='[변형명]' / 레벨스킬='[Lv. n]' / 그 외 없음 */
function buffLabel(buff: Buff, level: number): string {
  if (buff.type === 'skill' && buff.variants) return `[${buff.variants[level - 1] ?? '?'}]${buff.name}`
  if (buff.type === 'skill' && buff.masterLevel > 1) return `[Lv. ${level}]${buff.name}`
  return buff.name
}

/** 버프 툴팁 내용: 이름(+레벨) / 효과 */
function buffTooltip(buff: Buff, level: number): React.ReactNode {
  const isSkill = buff.type === 'skill'
  return (
    <Box sx={{ py: 0.25 }}>
      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
        {buff.name}
        {isSkill && buff.masterLevel > 1 ? ` Lv.${level}` : ''}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block' }}>
        {formatEffects(buffEffectsAtLevel(buff, level)) || '—'}
      </Typography>
    </Box>
  )
}

function BuffIcon({
  buff,
  active = true,
  onClick,
  onContextMenu,
  size = 46,
  tooltip,
  highlightActive = false,
}: {
  buff: Buff
  active?: boolean
  onClick?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  size?: number
  tooltip?: React.ReactNode
  /** 적용(active) 시 밝은 황금빛 테두리로 강조할지 여부 */
  highlightActive?: boolean
}) {
  const icon = buffIconUrl(buff)
  const img = Math.round(size * 0.82)
  const highlighted = highlightActive && active
  const box = (
    <Box
      onClick={onClick}
      onContextMenu={onContextMenu}
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
        cursor: onClick || onContextMenu ? 'pointer' : 'default',
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

/** 아이콘 클릭 시 열리는 레벨(+토글) 조정 모달 */
function BuffDialog({ buff, kind, onClose }: { buff: Buff; kind: BuffKind; onClose: () => void }) {
  const activeBuffs = useBuildStore((s) => s.activeBuffs)
  const toggleBuff = useBuildStore((s) => s.toggleBuff)
  const setBuffLevel = useBuildStore((s) => s.setBuffLevel)
  const appliedBuffs = useBuildStore((s) => s.appliedBuffs)
  const setAppliedLevel = useBuildStore((s) => s.setAppliedLevel)
  const masteryLevels = useBuildStore((s) => s.masteryLevels)
  const setMasteryLevel = useBuildStore((s) => s.setMasteryLevel)
  const buffLevels = useBuildStore((s) => s.buffLevels)

  const isSkill = buff.type === 'skill'
  const master = isSkill ? buff.masterLevel : 1
  const active = kind === 'toggle' ? buff.id in activeBuffs : true
  const fallback = kind === 'toggle' ? buffLevels[buff.id] ?? defaultBuffLevel(buff) : defaultBuffLevel(buff)
  const level =
    kind === 'toggle' ? activeBuffs[buff.id] ?? fallback : kind === 'applied' ? appliedBuffs[buff.id] ?? fallback : masteryLevels[buff.id] ?? fallback

  const setLevel = (n: number) => {
    if (kind === 'toggle') setBuffLevel(buff.id, n)
    else if (kind === 'applied') setAppliedLevel(buff.id, n)
    else setMasteryLevel(buff.id, n)
  }

  const hasLevel = isSkill && master > 1
  const eff = buffEffectsAtLevel(buff, level)

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <BuffIcon buff={buff} active={active} size={36} />
        {buff.name}
      </DialogTitle>
      <DialogContent>
        {kind === 'toggle' && (
          <FormControlLabel control={<Switch checked={active} onChange={() => toggleBuff(buff.id)} />} label="적용" />
        )}
        {buff.type === 'skill' && buff.variants ? (
          <Box sx={{ mt: 1, px: 1 }}>
            <Typography variant="body2" gutterBottom>버전 선택</Typography>
            <RadioGroup value={level} onChange={(_, v) => setLevel(Number(v))}>
              {buff.variants.map((name, i) => (
                <FormControlLabel
                  key={name}
                  value={i + 1}
                  control={<Radio size="small" />}
                  label={name}
                  disabled={kind === 'toggle' && !active}
                />
              ))}
            </RadioGroup>
          </Box>
        ) : hasLevel ? (
          <Box sx={{ mt: 1, px: 1 }}>
            <Typography variant="body2" gutterBottom>스킬 레벨: {level} / {master}</Typography>
            {buff.id === '1121000' && (
              <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                {[0, 10, 20, 30].map((v) => (
                  <Button
                    key={v}
                    size="small"
                    variant={level === v ? 'contained' : 'outlined'}
                    disabled={kind === 'toggle' && !active}
                    onClick={() => setLevel(v)}
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
              value={level}
              disabled={kind === 'toggle' && !active}
              onChange={(_, v) => setLevel(v as number)}
              valueLabelDisplay="auto"
            />
          </Box>
        ) : (
          <Typography variant="caption" color="text.disabled">레벨 조정 없음</Typography>
        )}
        <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
          {formatEffects(eff) || '—'}
        </Typography>
      </DialogContent>
    </Dialog>
  )
}

/** 토글형 버프 행 (영메·메용 / 직업 특화 패시브) — 아이콘 클릭 시 모달 */
function BuffRow({ buff, onOpen }: { buff: Buff; onOpen: (b: Buff) => void }) {
  const level = useBuildStore((s) => s.activeBuffs[buff.id])
  const remembered = useBuildStore((s) => s.buffLevels[buff.id])
  const toggleBuff = useBuildStore((s) => s.toggleBuff)
  const active = level !== undefined
  const shownLevel = active ? level : remembered ?? defaultBuffLevel(buff)
  const eff = buffEffectsAtLevel(buff, shownLevel)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.25 }}>
      <BuffIcon buff={buff} active={active} highlightActive onClick={() => onOpen(buff)} onContextMenu={(e) => { e.preventDefault(); toggleBuff(buff.id) }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap>{buffLabel(buff, shownLevel)}</Typography>
        <Typography variant="caption" color={active ? 'success.main' : 'text.disabled'} noWrap sx={{ display: 'block' }}>
          {formatEffects(eff) || '—'}
        </Typography>
      </Box>
    </Box>
  )
}

/** 무기 마스터리/엑스퍼트 행 (장착 무기 자동 적용 · 아이콘 클릭 시 레벨 모달) */
function MasteryRow({ buff, onOpen }: { buff: Buff; onOpen: (b: Buff) => void }) {
  const level = useBuildStore((s) => s.masteryLevels[buff.id])
  const isSkill = buff.type === 'skill'
  const shownLevel = level ?? (isSkill ? buff.masterLevel : 1)
  const eff = buffEffectsAtLevel(buff, shownLevel)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.25 }}>
      <BuffIcon buff={buff} highlightActive onClick={() => onOpen(buff)} onContextMenu={(e) => { e.preventDefault(); onOpen(buff) }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap>{buffLabel(buff, shownLevel)}</Typography>
        <Typography variant="caption" color="success.main" noWrap sx={{ display: 'block' }}>
          {formatEffects(eff) || '—'}
        </Typography>
      </Box>
    </Box>
  )
}

/** 선택용 드롭다운 — 항목 선택 시 적용 목록에 추가(이미 적용된 버프는 목록에서 제외) */
function BuffSelect({ buffs, appliedIds, onAdd, placeholder }: { buffs: Buff[]; appliedIds: Set<string>; onAdd: (id: string) => void; placeholder: string }) {
  const available = buffs.filter((b) => !appliedIds.has(b.id))
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
      {available.length === 0 ? (
        <MenuItem value="" disabled>추가할 버프 없음</MenuItem>
      ) : (
        available.map((b) => (
          <MenuItem key={b.id} value={b.id} sx={{ fontSize: 13, gap: 0.75 }}>
            <BuffIcon buff={b} size={28} />
            <Box component="span" sx={{ flex: 1, minWidth: 0 }}>{b.name}</Box>
            <Box component="span" sx={{ color: 'success.main' }}>{formatEffects(buffEffectsAtLevel(b, defaultBuffLevel(b))) || '—'}</Box>
          </MenuItem>
        ))
      )}
    </Select>
  )
}

/** 적용된 버프 목록 — 좌클릭: 레벨 변경(아이템 제외) / 우클릭: 제거 / 호버: 효과 */
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
            onClick={hasLevel ? () => onOpen(b) : undefined}
            onContextMenu={(e) => {
              e.preventDefault()
              onRemove(b.id)
            }}
          />
        )
      })}
    </Box>
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
  const masteries = jobPassives.filter((b) => b.type === 'skill' && b.weaponTypes)
  const activeMasteries = weaponType ? masteries.filter((b) => b.type === 'skill' && b.weaponTypes?.includes(weaponType)) : []
  // 특화 패시브: 직업 패시브(무기 마스터리 제외) + 개인 패시브 스킬(블로킹 등)
  const otherPassives = [
    ...jobPassives.filter((b) => !(b.type === 'skill' && b.weaponTypes)),
    ...(jobId ? PERSONAL_BUFFS.filter((b) => canUseBuff(b, jobId) && b.type === 'skill' && b.mode === 'passive') : []),
  ]

  // 개인 버프 드롭다운 풀 (액티브만 — 패시브는 특화 섹션으로) · 파티 버프는 전 직업(샤프아이즈/하이퍼바디 포함)
  const personalPool = jobId ? PERSONAL_BUFFS.filter((b) => canUseBuff(b, jobId) && !(b.type === 'skill' && b.mode === 'passive')) : []

  const appliedIds = new Set(Object.keys(appliedBuffs))
  const appliedEntries = Object.keys(appliedBuffs)
    .map((id) => [...DOPING_ITEMS, ...PERSONAL_BUFFS, ...PARTY_BUFFS].find((b) => b.id === id))
    .filter((b): b is Buff => !!b)
  const appliedEff = maxEffects(...appliedEntries.map((b) => buffEffectsAtLevel(b, appliedBuffs[b.id])))

  return (
    <CollapsiblePanel id="skill" title="스킬 및 도핑">
      <SectionTitle>공통 버프</SectionTitle>
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.25 }}>
        좌클릭: 레벨 변경 · 우클릭: ON/OFF
      </Typography>
      {COMMON_BUFFS.map((b) => (
        <BuffRow key={b.id} buff={b} onOpen={open('toggle')} />
      ))}

      <Divider sx={{ my: 1 }} />

      <SectionTitle>아이템 도핑</SectionTitle>
      <BuffSelect buffs={DOPING_ITEMS} appliedIds={appliedIds} onAdd={addBuff} placeholder="도핑 선택하여 추가" />

      <SectionTitle sx={{ mt: 0.75 }}>개인 버프</SectionTitle>
      {jobId ? (
        <BuffSelect buffs={personalPool} appliedIds={appliedIds} onAdd={addBuff} placeholder="개인 버프 선택하여 추가" />
      ) : (
        <Typography variant="caption" color="text.disabled">직업 선택 후 표시</Typography>
      )}

      <SectionTitle sx={{ mt: 0.75 }}>파티 버프</SectionTitle>
      <BuffSelect buffs={PARTY_BUFFS} appliedIds={appliedIds} onAdd={addBuff} placeholder="파티 버프 선택하여 추가" />

      <Divider sx={{ my: 1 }} />

      <SectionTitle>적용된 버프</SectionTitle>
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.5 }}>
        좌클릭: 레벨 변경 · 우클릭: 제거 · 호버: 효과
      </Typography>
      <AppliedBuffList entries={appliedEntries} levels={appliedBuffs} onOpen={open('applied')} onRemove={removeBuff} />

      <SectionTitle sx={{ mt: 1 }}>적용된 효과</SectionTitle>
      <Typography variant="body2" color="success.main">
        {formatEffects(appliedEff) || '—'}
      </Typography>

      <Divider sx={{ my: 1 }} />

      <SectionTitle>특화 버프 (패시브)</SectionTitle>
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.25 }}>
        좌클릭: 레벨 변경 · 우클릭: ON/OFF
      </Typography>
      {masteries.length > 0 && (
        <>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>무기 마스터리 (장착 무기 자동)</Typography>
          {activeMasteries.length === 0 ? (
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.5 }}>
              {weaponType ? '장착 무기에 해당하는 마스터리 없음' : '무기 장착 시 자동 적용'}
            </Typography>
          ) : (
            activeMasteries.map((b) => <MasteryRow key={b.id} buff={b} onOpen={open('mastery')} />)
          )}
        </>
      )}
      {otherPassives.map((b) => <BuffRow key={b.id} buff={b} onOpen={open('toggle')} />)}
      {masteries.length === 0 && otherPassives.length === 0 && (
        <Typography variant="caption" color="text.disabled">사용 가능한 특화 버프 없음</Typography>
      )}

      {dlg && <BuffDialog buff={dlg.buff} kind={dlg.kind} onClose={() => setDlg(null)} />}
    </CollapsiblePanel>
  )
}
