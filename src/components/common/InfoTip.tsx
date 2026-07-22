import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import type { TooltipProps } from '@mui/material/Tooltip'
import type { ReactNode } from 'react'

interface Props {
  /** 호버 시 표시할 설명 (문자열 또는 JSX) */
  title: ReactNode
  /** 배지 지름(px) */
  size?: number
  placement?: TooltipProps['placement']
  /** 툴팁 최대 너비(px) */
  maxWidth?: number
}

/**
 * 라벨 옆 '?' 도움말 배지 — 호버 시 설명 툴팁.
 * 공식·주의사항처럼 본문에 넣기엔 긴 설명을 붙일 때 사용한다.
 *
 * 사용: <Typography>필요 마법명중률<InfoTip title={...} /></Typography>
 */
export default function InfoTip({ title, size = 13, placement = 'top', maxWidth = 320 }: Props) {
  return (
    <Tooltip
      title={<Box sx={{ fontSize: 11.5, lineHeight: 1.65, py: 0.25 }}>{title}</Box>}
      placement={placement}
      arrow
      disableInteractive
      slotProps={{ tooltip: { sx: { maxWidth } } }}
    >
      <Box
        component="span"
        sx={{
          ml: 0.5,
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 1,
          borderColor: 'text.disabled',
          color: 'text.secondary',
          fontSize: Math.round(size * 0.7),
          fontWeight: 700,
          lineHeight: 1,
          cursor: 'help',
        }}
      >
        ?
      </Box>
    </Tooltip>
  )
}

/** 도움말 툴팁 안 제목 줄 */
export function InfoTitle({ children }: { children: ReactNode }) {
  return <Box sx={{ fontWeight: 700, mb: 0.5 }}>{children}</Box>
}

/** 도움말 툴팁 안 공식 표기 (monospace) */
export function Formula({ children }: { children: ReactNode }) {
  return <Box sx={{ fontFamily: 'monospace', my: 0.5 }}>{children}</Box>
}

/** 도움말 툴팁 안 주의/경고 문단 */
export function InfoWarn({ children }: { children: ReactNode }) {
  return <Box sx={{ mt: 0.75, color: '#ffb74d' }}>{children}</Box>
}
