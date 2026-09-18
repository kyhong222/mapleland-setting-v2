/**
 * TopBar의 디스코드 로그인 버튼. docs/cloud-sync.md §1
 *
 * Supabase 키가 없는 환경에서는 아무것도 그리지 않는다 — 로컬 전용으로 쓰던 그대로 보인다.
 */

import { useState } from 'react'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Snackbar from '@mui/material/Snackbar'
import Typography from '@mui/material/Typography'
import { useAuthStore } from '../store/authStore'
import { useCloudSyncStore } from '../store/cloudSync'

/** 동기화 상태 한 줄. idle은 보여줄 게 없어 비운다 */
const SYNC_LABEL: Record<string, string> = {
  syncing: '계정에 저장 중…',
  saved: '계정에 저장됨',
  offline: '오프라인 — 연결되면 자동 저장',
  conflict: '다른 기기와 충돌 — 선택이 필요합니다',
  error: '동기화 오류',
}

export default function AuthButton() {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const error = useAuthStore((s) => s.error)
  const signIn = useAuthStore((s) => s.signIn)
  const signOut = useAuthStore((s) => s.signOut)
  const syncStatus = useCloudSyncStore((s) => s.status)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  if (status === 'disabled') return null

  const closeMenu = () => setAnchor(null)

  return (
    <>
      {status === 'signedIn' && user ? (
        <>
          <Button
            size="small"
            variant="text"
            onClick={(e) => setAnchor(e.currentTarget)}
            sx={{ minWidth: 0, gap: 0.75, px: 1 }}
          >
            <Avatar src={user.avatarUrl} sx={{ width: 24, height: 24 }}>
              {user.name.slice(0, 1)}
            </Avatar>
            {/* 좁은 화면에서는 아바타만 — TopBar 버튼이 이미 많다 */}
            <Box
              component="span"
              sx={{ display: { xs: 'none', sm: 'inline' }, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {user.name}
            </Box>
          </Button>
          <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={closeMenu}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                디스코드로 로그인됨
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {user.name}
              </Typography>
              {SYNC_LABEL[syncStatus] && (
                <Typography
                  variant="caption"
                  color={syncStatus === 'error' || syncStatus === 'conflict' ? 'error' : 'text.secondary'}
                  sx={{ display: 'block', mt: 0.5 }}
                >
                  {SYNC_LABEL[syncStatus]}
                </Typography>
              )}
            </Box>
            <MenuItem
              onClick={() => {
                closeMenu()
                void signOut()
              }}
            >
              로그아웃
            </MenuItem>
          </Menu>
        </>
      ) : (
        <Button
          size="small"
          variant="outlined"
          disabled={status === 'loading'}
          onClick={() => void signIn()}
        >
          {status === 'loading' ? '확인 중…' : '디스코드 로그인'}
        </Button>
      )}

      <Snackbar
        open={Boolean(error)}
        message={error ?? ''}
        autoHideDuration={6000}
        onClose={() => useAuthStore.setState({ error: null })}
      />
    </>
  )
}
