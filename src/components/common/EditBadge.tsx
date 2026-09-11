import Box from '@mui/material/Box'

/**
 * 편집(연필) 배지의 겉모습 — 버프 아이콘 우상단에 호버로 뜨는 편집 버튼.
 * 조작 안내문에서도 같은 컴포넌트를 인라인으로 써서 "이 버튼"을 그대로 가리킨다
 * (텍스트 글리프로는 실제 버튼과 모양이 달라 매칭이 안 됐다).
 *
 * 클릭 동작·위치 지정은 쓰는 쪽에서 감싼다. 여기는 모양만 담당한다.
 */
export default function EditBadge({ size = 18, sx }: { size?: number; sx?: object }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        boxSizing: 'border-box',
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        // outlined 스타일 — 아이콘을 가리지 않도록 채움 대신 테두리로만 표시
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'secondary.main',
        color: 'secondary.main',
        ...sx,
      }}
    >
      <Box component="svg" viewBox="0 0 24 24" sx={{ width: size * 0.61, height: size * 0.61, fill: 'currentColor' }}>
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
      </Box>
    </Box>
  )
}
