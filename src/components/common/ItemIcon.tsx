import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'

interface Props {
  src?: string
  alt?: string
  size?: number
  /** 등급 윤곽선 색상 (투명 스프라이트 외곽선) */
  outlineColor?: string
}

const MAX_RETRY = 2

/** maplestory.io 아이콘 표시 (없으면 빈 박스). 로드 실패 시 자동 재시도. */
export default function ItemIcon({ src, alt, size = 36, outlineColor }: Props) {
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setAttempt(0)
  }, [src])

  const finalSrc = src ? (attempt === 0 ? src : `${src}?r=${attempt}`) : undefined

  return (
    <Box
      sx={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {finalSrc && (
        <Box
          component="img"
          src={finalSrc}
          alt={alt ?? ''}
          loading="lazy"
          onError={() => {
            if (attempt < MAX_RETRY) {
              setTimeout(() => setAttempt((a) => a + 1), 300)
            }
          }}
          sx={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            filter: outlineColor
              ? `drop-shadow(1px 0 0 ${outlineColor}) drop-shadow(-1px 0 0 ${outlineColor}) drop-shadow(0 1px 0 ${outlineColor}) drop-shadow(0 -1px 0 ${outlineColor})`
              : undefined,
          }}
        />
      )}
    </Box>
  )
}
