/**
 * 로그인 상태와 동기화 엔진을 잇고, 사용자에게 물어야 하는 순간에 다이얼로그를 띄운다.
 * docs/cloud-sync.md §5
 *
 * 화면에 자리를 차지하지 않는다 — App에 한 번 마운트해 두면 된다.
 * (스토어끼리 import하지 않는다는 규칙 때문에 authStore ↔ cloudSync 연결을 여기서 한다.)
 */

import { useEffect } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useAuthStore } from '../store/authStore'
import { startCloudSync, stopCloudSync, useCloudSyncStore } from '../store/cloudSync'

/** 제목 + 설명이 붙은 선택지 버튼 — 되돌릴 수 없는 선택이라 결과를 같이 적는다 */
function ChoiceButton({
  label,
  detail,
  recommended,
  disabled,
  onClick,
}: {
  label: string
  detail: string
  recommended?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      variant={recommended ? 'contained' : 'outlined'}
      disabled={disabled}
      onClick={onClick}
      sx={{ justifyContent: 'flex-start', textAlign: 'left', flexDirection: 'column', alignItems: 'flex-start', py: 1.25 }}
    >
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {label}
        {recommended && ' (추천)'}
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.85, whiteSpace: 'normal' }}>
        {detail}
      </Typography>
    </Button>
  )
}

export default function CloudSyncGate() {
  const status = useAuthStore((s) => s.status)
  const userId = useAuthStore((s) => s.user?.id)
  const prompt = useCloudSyncStore((s) => s.prompt)
  const busy = useCloudSyncStore((s) => s.busy)
  const syncStatus = useCloudSyncStore((s) => s.status)
  const message = useCloudSyncStore((s) => s.message)
  const takeRemote = useCloudSyncStore((s) => s.takeRemote)
  const keepLocal = useCloudSyncStore((s) => s.keepLocal)
  const postpone = useCloudSyncStore((s) => s.postpone)

  useEffect(() => {
    if (status === 'signedIn' && userId) {
      void startCloudSync(userId)
      return () => stopCloudSync()
    }
    if (status === 'signedOut') stopCloudSync()
  }, [status, userId])

  return (
    <>
      {/* 닫기 수단을 주지 않는다 — 고르기 전에는 동기화를 시작할 수 없다 */}
      <Dialog open={prompt !== null} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          {prompt === 'upload' ? '이 기기의 세팅을 계정에 올릴까요?' : '다른 기기에서 먼저 저장했습니다'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {prompt === 'upload'
              ? '계정이 비어 있습니다. 올려두면 다른 기기에서도 이어서 볼 수 있습니다.'
              : '어느 쪽을 남길까요?'}
          </Typography>

          <Stack spacing={1.25}>
            {prompt === 'upload' ? (
              <>
                <ChoiceButton
                  recommended
                  disabled={busy}
                  label="올리기"
                  detail="지금 내용을 계정에 저장하고, 이후 변경도 자동으로 저장합니다."
                  onClick={() => void keepLocal()}
                />
                <ChoiceButton
                  disabled={busy}
                  label="나중에"
                  detail="이 기기에만 저장합니다. 계정 메뉴에서 언제든 올릴 수 있습니다."
                  onClick={postpone}
                />
              </>
            ) : (
              <>
                <ChoiceButton
                  disabled={busy}
                  label="계정 것만 쓰기"
                  detail="이 기기의 내용은 사라집니다."
                  onClick={() => void takeRemote()}
                />
                <ChoiceButton
                  disabled={busy}
                  label="이 기기 것만 쓰기"
                  detail="계정에 저장된 내용은 사라집니다."
                  onClick={() => void keepLocal()}
                />
              </>
            )}
          </Stack>
        </DialogContent>
      </Dialog>

      <Snackbar open={syncStatus === 'error' && message !== null} autoHideDuration={10000}>
        <Alert severity="error" variant="filled">
          {message}
        </Alert>
      </Snackbar>
    </>
  )
}
