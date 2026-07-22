import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import CollapsiblePanel from '../common/CollapsiblePanel'
import ItemTooltip from '../common/ItemTooltip'
import ItemIcon from '../common/ItemIcon'
import { useBuildStore } from '../../store/buildStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { useActivation } from '../../store/activation'
import { instanceLabel } from '../../store/equipInstance'
import type { EquipInstance } from '../../store/equipInstance'
import { resolveBuiltItem } from '../../domain/builtItem'
import type { BuiltItem } from '../../domain/builtItem'
import { WEAPON_CONSTANTS } from '../../domain/weapons'
import { formatEffects } from '../../lib/effectFormat'

const TILE = 46
const ICON = 30

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
  const activation = useActivation()

  const byId = useMemo(() => new Map(invItems.map((it) => [it.id, it.built])), [invItems])
  const disabled = disabledInstances(equipped, byId)

  const renderTile = (inst: EquipInstance, key: number) => {
    const invId = equipped[inst]
    const built = invId ? byId.get(invId) : undefined
    const isBlocked = disabled.has(inst) && !built // 한벌옷/두손무기로 막힌 빈 칸
    const isInactive = !!built && activation[inst] === false // 요구조건 미달 비활성
    const grade = built ? resolveBuiltItem(built).grade : null
    const label = instanceLabel(inst)

    const borderColor = isInactive || isBlocked ? 'error.main' : grade ? grade.info.color : 'divider'
    const bordered = isInactive || isBlocked || !!grade

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
          onClick={built ? () => unequip(inst) : undefined}
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
            bgcolor: isInactive || isBlocked ? 'rgba(211,47,47,0.14)' : undefined,
            '&:hover': built
              ? { bgcolor: isInactive ? 'rgba(211,47,47,0.24)' : 'action.hover' }
              : undefined,
          }}
        >
          {built ? (
            <ItemIcon
              src={built.base.iconUrl}
              alt={built.base.name}
              size={ICON}
              outlineColor={grade!.info.color}
            />
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
    </CollapsiblePanel>
  )
}
