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
  /** 헤더 우측, 토글 버튼 왼쪽에 표시할 액션 (클릭이 토글로 전파되지 않음) */
  headerAction?: ReactNode
  children?: ReactNode
}

export default function CollapsiblePanel({ id, title, headerAction, children }: Props) {
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {headerAction && (
            <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'flex' }}>
              {headerAction}
            </Box>
          )}
          <Typography variant="body2" color="text.secondary">
            {folded ? '▸' : '▾'}
          </Typography>
        </Box>
      </Box>
      <Collapse in={!folded}>
        <Box sx={{ p: 1.5 }}>{children}</Box>
      </Collapse>
    </Paper>
  )
}
