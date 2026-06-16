import type { ReactNode } from 'react'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Collapse from '@mui/material/Collapse'
import { useUiStore } from '../../store/uiStore'
import type { PanelId } from '../../store/uiStore'

interface Props {
  id: PanelId
  title: string
  children?: ReactNode
}

export default function CollapsiblePanel({ id, title, children }: Props) {
  const folded = useUiStore((s) => !!s.folded[id])
  const toggle = useUiStore((s) => s.toggle)

  return (
    <Paper variant="outlined" sx={{ display: 'flex', flexDirection: 'column' }}>
      <Box
        onClick={() => toggle(id)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 1,
          cursor: 'pointer',
          userSelect: 'none',
          borderBottom: folded ? 'none' : 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle2">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {folded ? '▸' : '▾'}
        </Typography>
      </Box>
      <Collapse in={!folded}>
        <Box sx={{ p: 1.5 }}>{children}</Box>
      </Collapse>
    </Paper>
  )
}
