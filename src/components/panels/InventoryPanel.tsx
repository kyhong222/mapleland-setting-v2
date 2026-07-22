import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import Popover from '@mui/material/Popover'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Divider from '@mui/material/Divider'
import Snackbar from '@mui/material/Snackbar'
import CollapsiblePanel from '../common/CollapsiblePanel'
import ItemIcon from '../common/ItemIcon'
import ItemMakerDialog from '../maker/ItemMakerDialog'
import { useInventoryStore } from '../../store/inventoryStore'
import type { InventoryItem } from '../../store/inventoryStore'
import { useBuildStore } from '../../store/buildStore'
import { targetInstancesForSlot, SECONDARY_SLOTS } from '../../store/equipInstance'
import { aggregateBuild } from '../../store/aggregate'
import { useActiveEquippedBuilts } from '../../store/activation'
import { resolveBuiltItem } from '../../domain/builtItem'
import type { BuiltItem } from '../../domain/builtItem'
import { checkWearable } from '../../domain/equip'
import { WEAPON_CONSTANTS } from '../../domain/weapons'
import ItemTooltip from '../common/ItemTooltip'
import { ALL_CLASSES, JOBS } from '../../domain/jobs'
import type { ClassId } from '../../domain/jobs'
import { ALL_SLOTS } from '../../domain/equipSlots'
import type { SlotId } from '../../domain/equipSlots'

const CLASS_BIT: Record<ClassId, number> = { warrior: 1, magician: 2, bowman: 4, thief: 8, pirate: 16 }
const ALL_SLOT_IDS = ALL_SLOTS.map((s) => s.id)

export default function InventoryPanel() {
  const items = useInventoryStore((s) => s.items)
  const add = useInventoryStore((s) => s.add)
  const update = useInventoryStore((s) => s.update)
  const remove = useInventoryStore((s) => s.remove)

  const jobId = useBuildStore((s) => s.jobId)
  const level = useBuildStore((s) => s.level)
  const baseStats = useBuildStore((s) => s.baseStats)
  const equipped = useBuildStore((s) => s.equipped)
  const equip = useBuildStore((s) => s.equip)
  const unequip = useBuildStore((s) => s.unequip)
  const unequipByInvId = useBuildStore((s) => s.unequipByInvId)

  const activeBuilts = useActiveEquippedBuilts()

  const [makerOpen, setMakerOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null)
  const [menu, setMenu] = useState<{ anchor: HTMLElement; id: string } | null>(null)
  const [msg, setMsg] = useState('')
  const [classes, setClasses] = useState<Set<ClassId>>(new Set())
  const [slots, setSlots] = useState<Set<SlotId>>(new Set(ALL_SLOT_IDS))

  useEffect(() => {
    const cls = jobId ? JOBS[jobId].classId : null
    setClasses(new Set(cls ? [cls] : ALL_CLASSES.map((c) => c.id)))
    setSlots(new Set(ALL_SLOT_IDS))
  }, [jobId])

  const handleConfirm = (built: BuiltItem) => {
    if (editId === null) add(built)
    else update(editId, built)
  }

  const handleDelete = (id: string) => {
    remove(id)
    unequipByInvId(id)
    setMenu(null)
  }

  const handleDuplicate = (inv: InventoryItem) => {
    const b = inv.built
    add({
      base: b.base,
      adjustments: b.adjustments ? { ...b.adjustments } : undefined,
      scrolls: b.scrolls.map((s) => ({ ...s })),
      gems: b.gems.map((g) => ({ ...g })),
      growth: b.growth ? { ...b.growth } : undefined,
    })
    setMenu(null)
    setMsg(`${b.base.name} 복제됨`)
  }

  /** 좌클릭: 장착 ↔ 해제 토글 */
  const handleToggleEquip = (inv: InventoryItem) => {
    if (Object.values(equipped).includes(inv.id)) {
      unequipByInvId(inv.id)
      setMsg(`${inv.built.base.name} 해제`)
    } else {
      handleEquip(inv)
    }
  }

  const handleEquip = (inv: InventoryItem) => {
    setMenu(null)
    if (!jobId) return
    const base = inv.built.base
    // 장착가능여부 prehook: '장착' 시점의 현재(장착 직전) 활성 장비 총스탯/레벨로 착용조건 판정
    const stats = aggregateBuild(baseStats, activeBuilts).finalStats
    const check = checkWearable(base, { jobId, level, stats })
    if (!check.ok) {
      setMsg(`${base.name}: ${check.reasons.join(', ')}`)
      return
    }
    const slot = base.slot
    const weaponBuilt = equipped.weapon ? items.find((i) => i.id === equipped.weapon)?.built : undefined
    const weaponIs2H =
      !!weaponBuilt?.base.weaponType && WEAPON_CONSTANTS[weaponBuilt.base.weaponType].secondary.length === 0

    // 차단 규칙
    if (slot === 'bottom') {
      const topBuilt = equipped.top ? items.find((i) => i.id === equipped.top)?.built : undefined
      if (topBuilt?.base.slot === 'overall') {
        setMsg('한벌옷 착용 중에는 하의를 착용할 수 없습니다')
        return
      }
    }
    if (SECONDARY_SLOTS.includes(slot) && weaponIs2H) {
      setMsg('두손무기 착용 중에는 보조무기를 착용할 수 없습니다')
      return
    }

    // 충돌 해제
    if (slot === 'overall') unequip('bottom') // 한벌옷 → 상의 칸, 하의 제거
    if (slot === 'weapon') {
      const wt = base.weaponType
      if (wt && WEAPON_CONSTANTS[wt].secondary.length === 0) unequip('secondary')
    }

    const candidates = targetInstancesForSlot(slot)
    if (candidates.length === 0) {
      setMsg('장착할 수 없는 부위입니다')
      return
    }
    const target = candidates.find((c) => !equipped[c]) ?? candidates[0]
    equip(target, inv.id)
    setMsg(`${base.name} 장착`)
  }

  const toggle = <T,>(set: React.Dispatch<React.SetStateAction<Set<T>>>, id: T) =>
    set((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const mask = [...classes].reduce((m, c) => m | CLASS_BIT[c], 0)
  const visible = items
    .filter((inv) => {
      if (!slots.has(inv.built.base.slot)) return false
      const rj = inv.built.base.reqJob ?? 0
      return rj === 0 || (rj & mask) !== 0
    })

  const menuItem = menu ? items.find((i) => i.id === menu.id) : undefined

  return (
    <CollapsiblePanel
      id="inventory"
      title="인벤토리"
      headerAction={
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Button size="small" variant="outlined" onClick={(e) => setFilterAnchor(e.currentTarget)}>
            필터
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => {
              setEditId(null)
              setMakerOpen(true)
            }}
          >
            + 아이템 제작
          </Button>
        </Box>
      }
    >
      <Popover
        open={!!filterAnchor}
        anchorEl={filterAnchor}
        onClose={() => setFilterAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ p: 1.5, maxWidth: 320 }}>
          <Typography variant="caption" color="text.secondary">직업</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
            {ALL_CLASSES.map((c) => (
              <FormControlLabel
                key={c.id}
                sx={{ mr: 1 }}
                control={<Checkbox size="small" checked={classes.has(c.id)} onChange={() => toggle(setClasses, c.id)} />}
                label={<Typography variant="body2">{c.label}</Typography>}
              />
            ))}
          </Box>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">장비 종류</Typography>
            <Box>
              <Button size="small" onClick={() => setSlots(new Set(ALL_SLOT_IDS))}>전체</Button>
              <Button size="small" onClick={() => setSlots(new Set())}>해제</Button>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
            {ALL_SLOTS.map((s) => (
              <FormControlLabel
                key={s.id}
                sx={{ mr: 1, width: 92 }}
                control={<Checkbox size="small" checked={slots.has(s.id)} onChange={() => toggle(setSlots, s.id)} />}
                label={<Typography variant="body2">{s.label}</Typography>}
              />
            ))}
          </Box>
        </Box>
      </Popover>

      {items.length === 0 ? (
        <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 2 }}>
          제작한 아이템이 없습니다.
        </Typography>
      ) : visible.length === 0 ? (
        <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 2 }}>
          필터에 해당하는 아이템이 없습니다.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {visible.map((inv) => {
            const { grade } = resolveBuiltItem(inv.built)
            const isEquipped = Object.values(equipped).includes(inv.id)
            return (
              <Tooltip
                key={inv.id}
                title={<ItemTooltip built={inv.built} />}
                placement="right"
                followCursor
                disableInteractive
                slotProps={{ tooltip: { sx: { bgcolor: 'transparent', p: 0, maxWidth: 'none' } } }}
              >
                <Box
                  component="button"
                  type="button"
                  onClick={() => handleToggleEquip(inv)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setMenu({ anchor: e.currentTarget, id: inv.id })
                  }}
                  sx={{
                    p: 0.5,
                    lineHeight: 0,
                    cursor: 'pointer',
                    borderRadius: 1,
                    border: isEquipped ? 2 : 1,
                    borderColor: isEquipped ? 'primary.main' : 'divider',
                    bgcolor: 'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <ItemIcon src={inv.built.base.iconUrl} alt={inv.built.base.name} size={36} outlineColor={grade.info.color} />
                </Box>
              </Tooltip>
            )
          })}
        </Box>
      )}

      {items.length > 0 && (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
          좌클릭: 장착/해제 · 우클릭: 메뉴(편집·복제·삭제)
        </Typography>
      )}

      <Menu anchorEl={menu?.anchor ?? null} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem onClick={() => menuItem && handleEquip(menuItem)}>장착</MenuItem>
        <MenuItem
          onClick={() => {
            if (menu) {
              setEditId(menu.id)
              setMakerOpen(true)
            }
            setMenu(null)
          }}
        >
          편집
        </MenuItem>
        <MenuItem onClick={() => menuItem && handleDuplicate(menuItem)}>복제</MenuItem>
        <MenuItem onClick={() => menu && handleDelete(menu.id)} sx={{ color: 'error.main' }}>
          삭제
        </MenuItem>
      </Menu>

      <Snackbar
        open={!!msg}
        autoHideDuration={2500}
        onClose={() => setMsg('')}
        message={msg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      <ItemMakerDialog
        open={makerOpen}
        initial={editId !== null ? items.find((i) => i.id === editId)?.built : undefined}
        onClose={() => setMakerOpen(false)}
        onConfirm={handleConfirm}
      />
    </CollapsiblePanel>
  )
}
