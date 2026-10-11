import { createTheme, lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'

/** 라이트/다크 모드 선택값의 localStorage 키 — index.html의 초기화 스크립트와 같아야 한다 */
export const COLOR_MODE_STORAGE_KEY = 'mlsv2:colorMode'
export const COLOR_SCHEME_STORAGE_KEY = 'mlsv2:colorScheme'

/**
 * 라이트·다크 두 벌 테마. CSS 변수 모드라 <html>의 `light`/`dark` 클래스로 전환된다.
 * sx 콜백에서 색을 읽을 때는 `theme.palette` 대신 `theme.vars.palette`를 쓸 것 —
 * `theme.palette`는 모드와 무관하게 라이트 값이 고정으로 들어 있다.
 */
export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#3b6fd6' },
        secondary: { main: '#e08a1e' },
        background: { default: '#f4f5f7', paper: '#ffffff' },
      },
    },
    dark: {
      palette: {
        primary: { main: '#6c9bf0' },
        secondary: { main: '#f0a446' },
        background: { default: '#121417', paper: '#1b1e23' },
      },
    },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily:
      '"Pretendard", "Noto Sans KR", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    h6: { fontWeight: 700 },
    subtitle2: { fontWeight: 700 },
  },
  components: {
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
  },
})

/**
 * 진한 배지색(보라·남색·청회색 등)을 **글자·테두리**로 쓸 때 다크 배경에 묻히지 않도록
 * 다크 모드에서만 밝혀 주는 sx 조각. 채운 배지(흰 글자)에는 필요 없다.
 * 예) `sx={[{ color: c, borderColor: c }, inkOnDark(c)]}`
 */
export const inkOnDark = (c: string, sel?: string) => (t: Theme) => {
  const ink = lighten(c, 0.45)
  const style = { color: ink, borderColor: ink }
  return t.applyStyles('dark', sel ? { ...style, [sel]: style } : style)
}
