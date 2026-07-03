import Box from '@mui/material/Box'
import { monsterIconUrl } from '../../domain/monster'

/** 몬스터 아이콘 (maplestory.io mob 아이콘 · 실패 시 빈 칸 유지) */
export default function MonsterIcon({ id, size = 40 }: { id: number; size?: number }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'action.hover',
        borderRadius: 0.5,
        overflow: 'hidden',
      }}
    >
      <Box
        component="img"
        src={monsterIconUrl(id)}
        alt=""
        loading="lazy"
        sx={{ maxWidth: '100%', maxHeight: '100%', imageRendering: 'pixelated' }}
        onError={(e) => {
          ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
        }}
      />
    </Box>
  )
}
