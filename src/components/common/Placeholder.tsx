import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

/** 패널 내부 자리표시자 (셸 단계, 내용 미정) */
export default function Placeholder({ height = 120 }: { height?: number }) {
  return (
    <Box
      sx={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px dashed',
        borderColor: 'divider',
        borderRadius: 1,
        color: 'text.disabled',
      }}
    >
      <Typography variant="caption">준비 중</Typography>
    </Box>
  )
}
