import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import CollapsiblePanel from '../common/CollapsiblePanel'
import ItemIcon from '../common/ItemIcon'
import ItemMakerDialog from '../maker/ItemMakerDialog'
import { useInventoryStore } from '../../store/inventoryStore'
import { resolveBuiltItem } from '../../domain/builtItem'
import type { BuiltItem } from '../../domain/builtItem'
import { formatEffects } from '../../lib/effectFormat'

export default function InventoryPanel() {
  const items = useInventoryStore((s) => s.items)
  const add = useInventoryStore((s) => s.add)
  const updateAt = useInventoryStore((s) => s.updateAt)
  const removeAt = useInventoryStore((s) => s.removeAt)

  const [open, setOpen] = useState(false)
  const [editIndex, setEditIndex] = useState<number | null>(null)

  const openNew = () => {
    setEditIndex(null)
    setOpen(true)
  }
  const openEdit = (i: number) => {
    setEditIndex(i)
    setOpen(true)
  }
  const handleConfirm = (item: BuiltItem) => {
    if (editIndex === null) add(item)
    else updateAt(editIndex, item)
  }

  return (
    <CollapsiblePanel
      id="inventory"
      title="인벤토리"
      headerAction={
        <Button variant="contained" size="small" onClick={openNew}>
          + 아이템 제작
        </Button>
      }
    >
      <Stack spacing={1}>
        {items.map((item, i) => {
          const { finalEffects, grade } = resolveBuiltItem(item)
          return (
            <Paper key={i} variant="outlined" sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <ItemIcon src={item.base.iconUrl} alt={item.base.name} size={32} outlineColor={grade.info.color} />
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: grade.info.textColor }} noWrap>
                  {item.base.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                  {formatEffects(finalEffects) || '효과 없음'}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => openEdit(i)} title="편집">
                ✎
              </IconButton>
              <IconButton size="small" color="error" onClick={() => removeAt(i)} title="삭제">
                ×
              </IconButton>
            </Paper>
          )
        })}
        {items.length === 0 && (
          <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 2 }}>
            제작한 아이템이 없습니다.
          </Typography>
        )}
      </Stack>

      <ItemMakerDialog
        open={open}
        initial={editIndex !== null ? items[editIndex] : undefined}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
      />
    </CollapsiblePanel>
  )
}
