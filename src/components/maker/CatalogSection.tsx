import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import { CATALOG_ITEMS } from '../../data/catalog'
import { SLOTS } from '../../domain/equipSlots'
import type { SlotId } from '../../domain/equipSlots'
import { ALL_CLASSES, JOBS } from '../../domain/jobs'
import type { ClassId } from '../../domain/jobs'
import type { ItemData } from '../../domain/item'
import type { WeaponType } from '../../domain/weapons'
import type { EffectId, EffectMap } from '../../domain/effects'
import { EFFECTS } from '../../domain/effects'
import { useBuildStore } from '../../store/buildStore'
import ItemIcon from '../common/ItemIcon'

interface Props {
  base: ItemData | null
  adjustments: EffectMap
  onPickBase: (item: ItemData) => void
  onChangeAdjust: (next: EffectMap) => void
}

/** 무기 종류 표시 순서 (한손검→…→건) */
const WEAPON_ORDER: Partial<Record<WeaponType, number>> = {
  oneHandedSword: 0, oneHandedAxe: 1, oneHandedMace: 2,
  twoHandedSword: 3, twoHandedAxe: 4, twoHandedMace: 5,
  spear: 6, polearm: 7, bow: 8, crossbow: 9,
  staff: 10, wand: 11, dagger: 12, claw: 13, knuckle: 14, gun: 15,
}
const weaponOrder = (it: ItemData) => (it.weaponType ? WEAPON_ORDER[it.weaponType] ?? 99 : 99)

/** 클래스 → reqJob 비트마스크 */
const CLASS_BIT: Record<ClassId, number> = {
  warrior: 1,
  magician: 2,
  bowman: 4,
  thief: 8,
  pirate: 16,
}

const RENDER_CAP = 600

/** 부위 선택 드롭다운: 방어구 슬롯(개별) */
const ARMOR_SLOTS: SlotId[] = [
  'hat', 'faceAccessory', 'eyeAccessory', 'earring', 'top', 'bottom', 'overall',
  'shoes', 'gloves', 'cape', 'shield', 'pendant', 'ring', 'belt', 'petAcc', 'medal',
]

/** 필터 key → 해당 슬롯 집합 (화살=화살+볼트) */
const FILTER_SLOTS: Record<string, SlotId[]> = {
  weapon: ['weapon'],
  ...Object.fromEntries(ARMOR_SLOTS.map((s) => [s, [s]])),
  arrow: ['arrow', 'bolt'],
  throwingStar: ['throwingStar'],
  bullet: ['bullet'],
}

export default function CatalogSection({
  base,
  adjustments,
  onPickBase,
  onChangeAdjust,
}: Props) {
  const jobId = useBuildStore((s) => s.jobId)
  const [q, setQ] = useState('')
  const [slotFilter, setSlotFilter] = useState('')
  const [classes, setClasses] = useState<Set<ClassId>>(() => {
    const cls = jobId ? JOBS[jobId].classId : null
    return new Set(cls ? [cls] : ALL_CLASSES.map((c) => c.id))
  })

  const toggleClass = (id: ClassId) =>
    setClasses((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const { groups, total } = useMemo(() => {
    if (!slotFilter) return { groups: [], total: 0 }
    const slots = FILTER_SLOTS[slotFilter] ?? []
    const k = q.trim()
    const mask = [...classes].reduce((m, c) => m | CLASS_BIT[c], 0)
    const filtered = CATALOG_ITEMS.filter((i) => {
      if (!slots.includes(i.slot)) return false
      if (k && !i.name.includes(k)) return false
      const rj = i.reqJob ?? 0
      if (rj !== 0 && (rj & mask) === 0) return false // 공용(0)은 항상 통과
      return true
    })
    const capped = filtered.slice(0, RENDER_CAP)
    const byBucket = new Map<number, ItemData[]>()
    for (const it of capped) {
      const b = Math.floor((it.reqLevel ?? 0) / 10) * 10
      const arr = byBucket.get(b)
      if (arr) arr.push(it)
      else byBucket.set(b, [it])
    }
    // 버킷은 레벨 오름차순, 버킷 내부는 무기종류→reqLevel→이름 순(예: 리버스 < 타임리스)
    for (const items of byBucket.values()) {
      items.sort((x, y) =>
        weaponOrder(x) - weaponOrder(y) ||
        (x.reqLevel ?? 0) - (y.reqLevel ?? 0) ||
        x.name.localeCompare(y.name, 'ko'),
      )
    }
    return {
      groups: [...byBucket.entries()].sort((a, b) => a[0] - b[0]),
      total: filtered.length,
    }
  }, [q, slotFilter, classes])

  if (!base) {
    return (
      <Box>
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <Select
            size="small"
            displayEmpty
            value={slotFilter}
            onChange={(e) => setSlotFilter(e.target.value)}
            sx={{ minWidth: 130 }}
          >
            <MenuItem value="" disabled>
              부위 선택
            </MenuItem>
            <MenuItem value="weapon">무기</MenuItem>
            <Divider />
            {ARMOR_SLOTS.map((s) => (
              <MenuItem key={s} value={s}>
                {SLOTS[s].label}
              </MenuItem>
            ))}
            <Divider />
            <MenuItem value="arrow">화살</MenuItem>
            <MenuItem value="throwingStar">표창</MenuItem>
            <MenuItem value="bullet">불릿</MenuItem>
          </Select>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="아이템 이름 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', mb: 1 }}>
          {ALL_CLASSES.map((c) => (
            <FormControlLabel
              key={c.id}
              control={
                <Checkbox size="small" checked={classes.has(c.id)} onChange={() => toggleClass(c.id)} />
              }
              label={<Typography variant="body2">{c.label}</Typography>}
              sx={{ mr: 1 }}
            />
          ))}
        </Box>

        {total > RENDER_CAP && (
          <Typography variant="caption" color="warning.main" sx={{ display: 'block', mb: 0.5 }}>
            {total}개 중 {RENDER_CAP}개만 표시 — 필터/검색으로 좁혀주세요.
          </Typography>
        )}

        <Box sx={{ maxHeight: 360, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
          {groups.map(([bucket, items]) => (
            <Box key={bucket} sx={{ mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Lv.{bucket}~{bucket + 9}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {items.map((item) => (
                  <Tooltip key={item.id} title={`Lv.${item.reqLevel ?? 0} ${item.name}`} placement="top" arrow disableInteractive>
                    <Box
                      component="button"
                      type="button"
                      onClick={() => onPickBase(item)}
                      sx={{
                        p: 0.5,
                        m: 0,
                        lineHeight: 0,
                        cursor: 'pointer',
                        borderRadius: 1,
                        border: 1,
                        borderColor: 'divider',
                        bgcolor: 'transparent',
                        '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                      }}
                    >
                      <ItemIcon src={item.iconUrl} alt={item.name} size={32} />
                    </Box>
                  </Tooltip>
                ))}
              </Box>
            </Box>
          ))}
          {groups.length === 0 && (
            <Typography sx={{ p: 1 }} variant="body2" color="text.secondary">
              {slotFilter === '' ? '부위를 먼저 선택하세요.' : '검색 결과가 없습니다.'}
            </Typography>
          )}
        </Box>
      </Box>
    )
  }

  // 공격속도(step)는 수치조정 대상에서 제외
  const keys = (Object.keys(base.effects) as EffectId[]).filter(
    (id) => EFFECTS[id].unit !== 'step',
  )
  const setFinal = (id: EffectId, finalVal: number) => {
    const baseVal = base.effects[id] ?? 0
    const diff = finalVal - baseVal
    const next = { ...adjustments }
    if (diff === 0) delete next[id]
    else next[id] = diff
    onChangeAdjust(next)
  }

  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        수치 조정 (기준값 편집)
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
        {keys.map((id) => {
          const finalVal = (base.effects[id] ?? 0) + (adjustments[id] ?? 0)
          return (
            <Box
              key={id}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                px: 0.5,
                py: 0.25,
                minWidth: 96,
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
                {EFFECTS[id].label}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <IconButton size="small" onClick={() => setFinal(id, finalVal - 1)}>
                  −
                </IconButton>
                <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 28, textAlign: 'center' }}>
                  {finalVal}
                </Typography>
                <IconButton size="small" onClick={() => setFinal(id, finalVal + 1)}>
                  +
                </IconButton>
              </Box>
            </Box>
          )
        })}
        {keys.length === 0 && (
          <Typography variant="body2" color="text.disabled">
            기본 옵션이 없습니다.
          </Typography>
        )}
      </Box>
    </Box>
  )
}
