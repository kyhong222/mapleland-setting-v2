import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { theme, COLOR_MODE_STORAGE_KEY, COLOR_SCHEME_STORAGE_KEY } from './theme'
import App from './App'
import { initAuth } from './store/authStore'

// 세션 구독 시작. 키가 없으면 내부에서 그냥 빠진다. docs/cloud-sync.md §6
initAuth()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider
      theme={theme}
      defaultMode="system"
      modeStorageKey={COLOR_MODE_STORAGE_KEY}
      colorSchemeStorageKey={COLOR_SCHEME_STORAGE_KEY}
    >
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
