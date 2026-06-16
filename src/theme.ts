import { createTheme } from '@mui/material/styles'

/** 정돈된 라이트 테마 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#3b6fd6' },
    secondary: { main: '#e08a1e' },
    background: { default: '#f4f5f7', paper: '#ffffff' },
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
