import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import SvgIcon from '@mui/material/SvgIcon'
import { useColorScheme } from '@mui/material/styles'

type Mode = 'system' | 'light' | 'dark'

/** 누를 때마다 시스템 → 라이트 → 다크 순으로 돈다 */
const NEXT: Record<Mode, Mode> = { system: 'light', light: 'dark', dark: 'system' }
const LABEL: Record<Mode, string> = { system: '시스템 설정', light: '라이트 모드', dark: '다크 모드' }

// Material Symbols 경로 (light_mode / dark_mode / brightness_auto)
const ICON: Record<Mode, string> = {
  light:
    'M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z',
  dark:
    'M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z',
  system:
    'M10.85 12.65h2.3L12 9l-1.15 3.65zM20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM14.3 16l-.7-2h-3.2l-.7 2H7.8L11 7h2l3.2 9h-1.9z',
}

export default function ColorModeButton() {
  const { mode, setMode } = useColorScheme()
  // 첫 렌더 직후에는 mode가 비어 있을 수 있다
  const current: Mode = mode ?? 'system'
  return (
    <Tooltip title={`${LABEL[current]} (눌러서 ${LABEL[NEXT[current]]}로)`}>
      <IconButton size="small" onClick={() => setMode(NEXT[current])} aria-label="화면 모드 전환">
        <SvgIcon fontSize="small">
          <path d={ICON[current]} />
        </SvgIcon>
      </IconButton>
    </Tooltip>
  )
}
