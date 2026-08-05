import { useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import CollapsiblePanel from '../common/CollapsiblePanel'
import ItemTooltip from '../common/ItemTooltip'
import ItemIcon from '../common/ItemIcon'
import ItemMakerDialog from '../maker/ItemMakerDialog'
import { useBuildStore } from '../../store/buildStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { useUiStore } from '../../store/uiStore'
import { useActivation } from '../../store/activation'
import { instanceLabel } from '../../store/equipInstance'
import type { EquipInstance } from '../../store/equipInstance'
import { resolveBuiltItem } from '../../domain/builtItem'
import type { BuiltItem } from '../../domain/builtItem'
import { gemIconUrl, sortedGems } from '../../domain/maker'
import { WEAPON_CONSTANTS } from '../../domain/weapons'
import { formatEffects } from '../../lib/effectFormat'

const TILE = 60
const ICON = 42

/** 5×7 슬롯 배치 (null = 빈칸/비활성 박스) */
const LAYOUT: (EquipInstance | null)[][] = [
  [null, 'hat', null, null, null],
  ['medal', 'faceAccessory', null, 'ring1', 'ring2'],
  [null, null, 'eyeAccessory', 'earring', null],
  ['cape', 'top', 'pendant', 'weapon', 'secondary'],
  ['gloves', 'bottom', 'belt', 'ring3', 'ring4'],
  [null, null, 'shoes', null, null],
  [null, null, 'petAcc1', 'petAcc2', 'petAcc3'],
]

function disabledInstances(
  equipped: Partial<Record<EquipInstance, string>>,
  byId: Map<string, BuiltItem>,
): Set<EquipInstance> {
  const d = new Set<EquipInstance>()
  const topItem = equipped.top ? byId.get(equipped.top) : undefined
  if (topItem?.base.slot === 'overall') d.add('bottom')
  const w = equipped.weapon ? byId.get(equipped.weapon) : undefined
  const wt = w?.base.weaponType
  if (wt && WEAPON_CONSTANTS[wt].secondary.length === 0) d.add('secondary')
  return d
}

/** 차단 슬롯(한벌옷/두손무기로 막힌 칸) 사유 */
function blockedReason(inst: EquipInstance): string {
  if (inst === 'bottom') return '한벌옷 착용 중 — 하의 사용 불가'
  if (inst === 'secondary') return '두손무기 착용 중 — 보조무기 사용 불가'
  return instanceLabel(inst)
}

export default function EquipmentPanel() {
  const equipped = useBuildStore((s) => s.equipped)
  const unequip = useBuildStore((s) => s.unequip)
  const invItems = useInventoryStore((s) => s.items)
  const updateItem = useInventoryStore((s) => s.update)
  const setHovered = useUiStore((s) => s.setHoveredEquipInvId)
  const activation = useActivation()

  const byId = useMemo(() => new Map(invItems.map((it) => [it.id, it.built])), [invItems])
  const disabled = disabledInstances(equipped, byId)

  // 우클릭/롱프레스 컨텍스트 메뉴(해제·편집) + 편집 다이얼로그
  const [menu, setMenu] = useState<{ anchor: HTMLElement; inst: EquipInstance; invId: string } | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressFired = useRef(false)
  const pressStart = useRef<{ x: number; y: number } | null>(null)
  const clearPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
  }
  const editBuilt = editId ? byId.get(editId) : undefined

  const renderTile = (inst: EquipInstance, key: number) => {
    const invId = equipped[inst]
    const built = invId ? byId.get(invId) : undefined
    const isBlocked = disabled.has(inst) && !built // 한벌옷/두손무기로 막힌 빈 칸
    const isInactive = !!built && activation[inst] === false // 요구조건 미달 비활성
    const grade = built ? resolveBuiltItem(built).grade : null
    const label = instanceLabel(inst)

    // 장착 아이템 칸 테두리는 등급색으로 칠하지 않음 (비활성/차단만 빨강 강조)
    const borderColor = isInactive || isBlocked ? 'error.main' : 'divider'
    const bordered = isInactive || isBlocked

    return (
      <Tooltip
        key={key}
        title={
          built ? (
            <ItemTooltip built={built} note={isInactive ? '(비활성 — 요구조건 미달)' : undefined} />
          ) : isBlocked ? (
            blockedReason(inst)
          ) : (
            label
          )
        }
        placement="right"
        arrow={!built}
        disableInteractive
        slotProps={built ? { tooltip: { sx: { bgcolor: 'transparent', p: 0, maxWidth: 'none' } } } : undefined}
      >
        <Paper
          variant="outlined"
          onClick={built ? () => { if (pressFired.current) { pressFired.current = false; return } unequip(inst) } : undefined}
          onContextMenu={built && invId ? (e) => { e.preventDefault(); setMenu({ anchor: e.currentTarget, inst, invId }) } : undefined}
          onMouseEnter={built && invId ? () => setHovered(invId) : undefined}
          onMouseLeave={built ? () => setHovered(null) : undefined}
          onTouchStart={built && invId ? (e) => {
            const el = e.currentTarget
            const t = e.touches[0]
            pressStart.current = t ? { x: t.clientX, y: t.clientY } : null
            pressFired.current = false
            clearPress()
            pressTimer.current = setTimeout(() => { pressFired.current = true; setMenu({ anchor: el, inst, invId }) }, 450)
          } : undefined}
          onTouchEnd={clearPress}
          onTouchMove={(e) => {
            const s = pressStart.current
            const t = e.touches[0]
            if (s && t && Math.hypot(t.clientX - s.x, t.clientY - s.y) > 10) clearPress()
          }}
          onTouchCancel={clearPress}
          sx={{
            position: 'relative',
            width: TILE,
            height: TILE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: built ? 'pointer' : 'default',
            border: bordered ? 2 : 1,
            borderStyle: 'solid',
            borderColor,
            bgcolor: isInactive || isBlocked ? 'rgba(211,47,47,0.34)' : undefined,
            WebkitTouchCallout: 'none',
            userSelect: 'none',
            '&:hover': built
              ? { bgcolor: isInactive ? 'rgba(211,47,47,0.46)' : 'action.hover' }
              : undefined,
          }}
        >
          {built ? (
            <>
              <ItemIcon
                src={built.base.iconUrl}
                alt={built.base.name}
                size={ICON}
                outlineColor={grade!.info.color}
              />
              {built.gems.length > 0 && (
                <Box sx={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 0, '& img:not(:first-of-type)': { ml: '-4px' } }}>
                  {sortedGems(built.gems).map((g, gi) => (
                    <Box
                      key={gi}
                      component="img"
                      src={gemIconUrl(g.type, g.grade)}
                      alt=""
                      sx={{ width: 20, height: 20, imageRendering: 'pixelated', display: 'block' }}
                    />
                  ))}
                </Box>
              )}
            </>
          ) : isBlocked ? (
            <>
              <Typography sx={{ position: 'absolute', fontSize: 9, lineHeight: 1, color: 'error.main', opacity: 0.55, textAlign: 'center' }}>
                {label}
              </Typography>
              <Box component="span" sx={{ fontSize: 28, fontWeight: 900, color: 'error.main', lineHeight: 1 }}>
                ✕
              </Box>
            </>
          ) : (
            <Typography sx={{ fontSize: 10, lineHeight: 1.05, textAlign: 'center', px: 0.25, color: 'text.secondary' }}>
              {label}
            </Typography>
          )}
        </Paper>
      </Tooltip>
    )
  }

  return (
    <CollapsiblePanel id="equip" title="장비">
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(5, ${TILE}px)`,
          gap: 0.5,
          justifyContent: 'center',
        }}
      >
        {LAYOUT.flat().map((inst, i) =>
          inst ? (
            renderTile(inst, i)
          ) : (
            <Box
              key={i}
              sx={{
                width: TILE,
                height: TILE,
                borderRadius: 1,
                bgcolor: 'action.disabledBackground',
                opacity: 0.4,
              }}
            />
          ),
        )}
      </Box>

      <Menu anchorEl={menu?.anchor ?? null} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem onClick={() => { if (menu) unequip(menu.inst); setMenu(null) }}>해제</MenuItem>
        <MenuItem onClick={() => { if (menu) setEditId(menu.invId); setMenu(null) }}>편집</MenuItem>
      </Menu>

      <ItemMakerDialog
        open={editId !== null}
        initial={editBuilt}
        onClose={() => setEditId(null)}
        onConfirm={(built) => { if (editId) updateItem(editId, built) }}
      />
    </CollapsiblePanel>
  )
}
