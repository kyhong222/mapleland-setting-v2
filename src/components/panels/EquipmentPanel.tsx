import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import CollapsiblePanel from '../common/CollapsiblePanel'
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
    const isDisabled = disabled.has(inst) && !built
    const isInactive = !!built && activation[inst] === false
    const grade = built ? resolveBuiltItem(built).grade : null
    const label = instanceLabel(inst)
    const tip = built
      ? `${label} · ${built.base.name}${isInactive ? ' (비활성)' : ''}`
      : label
    return (
      <Tooltip key={key} title={tip} placement="top" arrow>
        <Paper
          variant="outlined"
          sx={{
            position: 'relative',
            width: TILE,
            height: TILE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isDisabled ? 0.35 : isInactive ? 0.5 : 1,
            border: grade ? `2px solid ${grade.info.color}` : undefined,
            '&:hover .eq-del': { opacity: 1 },
          }}
        >
          {built ? (
            <>
              <ItemIcon src={built.base.iconUrl} alt={built.base.name} size={ICON} outlineColor={grade!.info.color} />
              <IconButton
                className="eq-del"
                size="small"
                onClick={() => unequip(inst)}
                sx={{
                  position: 'absolute',
                  top: -9,
                  right: -9,
                  opacity: 0,
                  transition: 'opacity .12s',
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  p: 0.05,
                }}
              >
                ×
              </IconButton>
            </>
          ) : (
            <Typography sx={{ fontSize: 10, lineHeight: 1.05, textAlign: 'center', px: 0.25, color: isDisabled ? 'text.disabled' : 'text.secondary' }}>
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
