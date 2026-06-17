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
import FormControlLabel from '@mui/material/FormControlLabel'
import CollapsiblePanel from '../common/CollapsiblePanel'
import { useBuildStore } from '../../store/buildStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { equippedWeaponType } from '../../store/aggregate'
import { COMMON_BUFFS, PARTY_BUFFS, PERSONAL_BUFFS, DOPING_ITEMS, JOB_BUFFS, getBuff } from '../../data/buff'
import { canUseBuff, buffEffectsAtLevel, defaultBuffLevel } from '../../domain/buff'
import type { Buff } from '../../domain/buff'
import { JOBS } from '../../domain/jobs'
import type { JobId } from '../../domain/jobs'
import type { EffectId } from '../../domain/effects'
import { formatEffects } from '../../lib/effectFormat'

/** 레벨 조정 대상: 토글버프 / 공통슬롯 / 마스터리 (레벨 저장 위치가 다름) */
type BuffKind = 'toggle' | 'common' | 'mastery'

/** 스킬=base64 data URI, 아이템=id로 아이콘 URL 유도 */
function buffIconUrl(buff: Buff): string | undefined {
  if (buff.icon) return buff.icon
  if (buff.type === 'item') return `https://maplestory.io/api/gms/62/item/${buff.id}/icon`
  return undefined
}

function BuffIcon({ buff, active = true, onClick, size = 46 }: { buff: Buff; active?: boolean; onClick?: () => void; size?: number }) {
  const icon = buffIconUrl(buff)
  const img = Math.round(size * 0.82)
  return (
    <Box
      onClick={onClick}
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'action.hover',
        borderRadius: 0.5,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {icon && <Box component="img" src={icon} alt="" sx={{ width: img, height: img, imageRendering: 'pixelated', filter: active ? 'none' : 'grayscale(1)' }} />}
    </Box>
  )
}

/** 아이콘 클릭 시 열리는 레벨(+토글) 조정 모달 */
function BuffDialog({ buff, kind, onClose }: { buff: Buff; kind: BuffKind; onClose: () => void }) {
  const activeBuffs = useBuildStore((s) => s.activeBuffs)
  const toggleBuff = useBuildStore((s) => s.toggleBuff)
  const setBuffLevel = useBuildStore((s) => s.setBuffLevel)
  const commonLevels = useBuildStore((s) => s.commonLevels)
  const setCommonLevel = useBuildStore((s) => s.setCommonLevel)
  const masteryLevels = useBuildStore((s) => s.masteryLevels)
  const setMasteryLevel = useBuildStore((s) => s.setMasteryLevel)

  const isSkill = buff.type === 'skill'
  const master = isSkill ? buff.masterLevel : 1
  const active = kind === 'toggle' ? buff.id in activeBuffs : true
  const level =
    kind === 'toggle' ? activeBuffs[buff.id] ?? master : kind === 'common' ? commonLevels[buff.id] ?? master : masteryLevels[buff.id] ?? master

  const setLevel = (n: number) => {
    if (kind === 'toggle') setBuffLevel(buff.id, n)
    else if (kind === 'common') setCommonLevel(buff.id, n)
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
        {hasLevel ? (
          <Box sx={{ mt: 1, px: 1 }}>
            <Typography variant="body2" gutterBottom>스킬 레벨: {level} / {master}</Typography>
            <Slider
              min={1}
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

/** 토글형 버프 행 (영메·메용 / 특화 패시브) — 아이콘 클릭 시 모달 */
function BuffRow({ buff, onOpen }: { buff: Buff; onOpen: (b: Buff) => void }) {
  const level = useBuildStore((s) => s.activeBuffs[buff.id])
  const active = level !== undefined
  const isSkill = buff.type === 'skill'
  const shownLevel = active ? level : isSkill ? buff.masterLevel : 1
  const eff = buffEffectsAtLevel(buff, shownLevel)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.25 }}>
      <BuffIcon buff={buff} active={active} onClick={() => onOpen(buff)} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap>{buff.name}</Typography>
        <Typography variant="caption" color={active ? 'success.main' : 'text.disabled'} noWrap sx={{ display: 'block' }}>
          {formatEffects(eff) || '—'}
        </Typography>
      </Box>
    </Box>
  )
}

/** 공통버프 슬롯 '없음' 상태 기본 아이콘 URL */
function slotDefaultIcon(id: number): string {
  return `https://maplestory.io/api/GMS/200/item/${id}/icon?resize=4`
}

/** 공통버프 8슬롯 정의 (마법사는 공격력→마력 / 추가공격력→추가마력) · defIcon=없음 기본 아이콘 */
const COMMON_SLOTS: { key: string; defIcon: number; phys: { label: string; stat: EffectId }; mag: { label: string; stat: EffectId } }[] = [
  { key: 'attack', defIcon: 2022359, phys: { label: '공격력', stat: 'pad' }, mag: { label: '마력', stat: 'mad' } },
  { key: 'addAttack', defIcon: 2022360, phys: { label: '추가 공격력', stat: 'addPad' }, mag: { label: '추가 마력', stat: 'addMad' } },
  { key: 'pdef', defIcon: 2022361, phys: { label: '방어력', stat: 'pdef' }, mag: { label: '방어력', stat: 'pdef' } },
  { key: 'mdef', defIcon: 2022362, phys: { label: '마법 방어력', stat: 'mdef' }, mag: { label: '마법 방어력', stat: 'mdef' } },
  { key: 'acc', defIcon: 2022363, phys: { label: '명중', stat: 'acc' }, mag: { label: '명중', stat: 'acc' } },
  { key: 'eva', defIcon: 2022364, phys: { label: '회피', stat: 'eva' }, mag: { label: '회피', stat: 'eva' } },
  { key: 'speed', defIcon: 2022365, phys: { label: '이동속도', stat: 'speed' }, mag: { label: '이동속도', stat: 'speed' } },
  { key: 'jump', defIcon: 2022376, phys: { label: '점프', stat: 'jump' }, mag: { label: '점프', stat: 'jump' } },
]

/** 공통버프 8슬롯이 다루는 능력치 */
const COMMON_SLOT_STATS: EffectId[] = ['pad', 'mad', 'addPad', 'addMad', 'pdef', 'mdef', 'acc', 'eva', 'speed', 'jump']

/** 8슬롯 능력치에 하나도 해당하지 않는 버프(슬롯으로 못 다룸) */
function hasNoSlotStat(buff: Buff): boolean {
  const eff = buffEffectsAtLevel(buff, defaultBuffLevel(buff))
  return !COMMON_SLOT_STATS.some((s) => (eff[s] ?? 0) !== 0)
}

/** 해당 능력치에 기여하는 후보 버프(파티 + 도핑 + 개인특화 액티브) */
function candidatesForStat(stat: EffectId, jobId: JobId): { buff: Buff; value: number }[] {
  const pool: Buff[] = [...PARTY_BUFFS, ...DOPING_ITEMS, ...PERSONAL_BUFFS.filter((b) => canUseBuff(b, jobId))]
  return pool
    .map((buff) => ({ buff, value: buffEffectsAtLevel(buff, defaultBuffLevel(buff))[stat] ?? 0 }))
    .filter((o) => o.value !== 0)
}

function CommonSlot({ slotKey, label, stat, defIcon, options, onOpen }: { slotKey: string; label: string; stat: EffectId; defIcon: number; options: { buff: Buff; value: number }[]; onOpen: (b: Buff) => void }) {
  const selectedId = useBuildStore((s) => s.commonSlots[slotKey] ?? '')
  const setCommonSlot = useBuildStore((s) => s.setCommonSlot)
  const storedLevel = useBuildStore((s) => (selectedId ? s.commonLevels[selectedId] : undefined))

  const selBuff = selectedId ? getBuff(selectedId) : undefined
  const isSkill = selBuff?.type === 'skill'
  const hasLevel = isSkill && selBuff.masterLevel > 1
  const levelValue = hasLevel ? storedLevel ?? selBuff.masterLevel : 1
  const selValue = selBuff ? buffEffectsAtLevel(selBuff, levelValue)[stat] ?? 0 : 0

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.25 }}>
      {selBuff ? (
        <BuffIcon buff={selBuff} size={40} onClick={() => onOpen(selBuff)} />
      ) : (
        <Box sx={{ width: 40, height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover', borderRadius: 0.5 }}>
          <Box component="img" src={slotDefaultIcon(defIcon)} alt="" sx={{ width: 33, height: 33, imageRendering: 'pixelated', opacity: 0.4 }} />
        </Box>
      )}
      <Typography sx={{ width: 60, flexShrink: 0, fontSize: 12, lineHeight: 1.15 }}>{label}</Typography>
      <Select
        size="small"
        fullWidth
        displayEmpty
        value={selectedId}
        onChange={(e) => setCommonSlot(slotKey, (e.target.value as string) || null)}
        renderValue={(val) => {
          if (!val || !selBuff) return <Box component="em" sx={{ color: 'text.disabled' }}>없음</Box>
          return (
            <>
              {selBuff.name}
              <Box component="span" sx={{ ml: 0.5, color: 'success.main' }}>{selValue > 0 ? `+${selValue}` : selValue}</Box>
            </>
          )
        }}
        sx={{ '& .MuiSelect-select': { py: 0.5, fontSize: 13 } }}
      >
        <MenuItem value=""><em>없음</em></MenuItem>
        {options.map((o) => (
          <MenuItem key={o.buff.id} value={o.buff.id} sx={{ fontSize: 13 }}>
            {o.buff.name}
            <Box component="span" sx={{ ml: 0.5, color: 'success.main' }}>{o.value > 0 ? `+${o.value}` : o.value}</Box>
          </MenuItem>
        ))}
      </Select>
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
      <BuffIcon buff={buff} onClick={() => onOpen(buff)} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap>{buff.name}</Typography>
        <Typography variant="caption" color="success.main" noWrap sx={{ display: 'block' }}>
          {formatEffects(eff) || '—'}
        </Typography>
      </Box>
    </Box>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.25 }}>
      {children}
    </Typography>
  )
}

export default function SkillPanel() {
  const jobId = useBuildStore((s) => s.jobId)
  const equipped = useBuildStore((s) => s.equipped)
  const invItems = useInventoryStore((s) => s.items)
  const isMagician = jobId ? JOBS[jobId].attackType === 'magical' : false
  const weaponType = equippedWeaponType(equipped, invItems)

  const [dlg, setDlg] = useState<{ buff: Buff; kind: BuffKind } | null>(null)
  const open = (kind: BuffKind) => (buff: Buff) => setDlg({ buff, kind })

  const jobPassives = jobId ? JOB_BUFFS.filter((b) => canUseBuff(b, jobId)) : []
  const masteries = jobPassives.filter((b) => b.type === 'skill' && b.weaponTypes)
  const activeMasteries = weaponType ? masteries.filter((b) => b.type === 'skill' && b.weaponTypes?.includes(weaponType)) : []
  const otherPassives = jobPassives.filter((b) => !(b.type === 'skill' && b.weaponTypes))
  // 8슬롯으로 못 다루는 버프 — 공통(파티 전용칸) / 특화(개인 액티브)
  const specialParty = PARTY_BUFFS.filter((b) => b.name === '샤프 아이즈' || b.name === '하이퍼 바디')
  const orphanActives = jobId ? PERSONAL_BUFFS.filter((b) => canUseBuff(b, jobId) && hasNoSlotStat(b)) : []

  return (
    <CollapsiblePanel id="skill" title="스킬 및 도핑">
      <SectionTitle>영웅의 메아리 · 메이플 용사</SectionTitle>
      {COMMON_BUFFS.map((b) => (
        <BuffRow key={b.id} buff={b} onOpen={open('toggle')} />
      ))}

      <Divider sx={{ my: 1 }} />

      <SectionTitle>공통 버프</SectionTitle>
      {!jobId ? (
        <Typography variant="caption" color="text.disabled">직업 선택 후 표시</Typography>
      ) : (
        <>
          {COMMON_SLOTS.map((s) => {
            const { label, stat } = isMagician ? s.mag : s.phys
            return <CommonSlot key={s.key} slotKey={s.key} label={label} stat={stat} defIcon={s.defIcon} options={candidatesForStat(stat, jobId)} onOpen={open('common')} />
          })}
          {specialParty.length > 0 && <Divider sx={{ my: 0.75 }} />}
          {specialParty.map((b) => (
            <BuffRow key={b.id} buff={b} onOpen={open('toggle')} />
          ))}
        </>
      )}

      <Divider sx={{ my: 1 }} />

      <SectionTitle>특화 버프 (패시브)</SectionTitle>
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
      {orphanActives.map((b) => <BuffRow key={b.id} buff={b} onOpen={open('toggle')} />)}
      {masteries.length === 0 && otherPassives.length === 0 && orphanActives.length === 0 && (
        <Typography variant="caption" color="text.disabled">사용 가능한 특화 버프 없음</Typography>
      )}

      {dlg && <BuffDialog buff={dlg.buff} kind={dlg.kind} onClose={() => setDlg(null)} />}
    </CollapsiblePanel>
  )
}
