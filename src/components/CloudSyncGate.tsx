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
  const merge = useCloudSyncStore((s) => s.merge)
  const syncStatus = useCloudSyncStore((s) => s.status)
  const message = useCloudSyncStore((s) => s.message)
  const takeRemote = useCloudSyncStore((s) => s.takeRemote)
  const keepLocal = useCloudSyncStore((s) => s.keepLocal)
  const mergeBoth = useCloudSyncStore((s) => s.mergeBoth)
  const dismissMerge = useCloudSyncStore((s) => s.dismissMerge)

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
          {prompt === 'migrate' ? '이 기기의 데이터를 어떻게 할까요?' : '다른 기기에서 먼저 저장했습니다'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {prompt === 'migrate'
              ? '계정에 저장된 데이터가 있는데, 이 기기에도 작업하던 내용이 있습니다.'
              : '이 기기의 변경을 올리려 했지만 계정 데이터가 더 최신입니다.'}
          </Typography>

          <Stack spacing={1.25}>
            {prompt === 'migrate' && (
              <ChoiceButton
                recommended
                disabled={busy}
                label="병합"
                detail="계정 데이터를 기준으로 두고, 이 기기의 저장 슬롯을 빈 칸에 채웁니다. 작업하던 빌드는 '이 기기 빌드' 슬롯으로 보관돼 사라지지 않습니다."
                onClick={() => void mergeBoth()}
              />
            )}
            <ChoiceButton
              disabled={busy}
              label={prompt === 'migrate' ? '계정 데이터 사용' : '계정 것 받기'}
              detail="이 기기의 내용이 계정 것으로 바뀝니다. 되돌릴 수 있게 이 기기 상태를 한 벌 백업해 둡니다."
              onClick={() => void takeRemote()}
            />
            <ChoiceButton
              disabled={busy}
              label="이 기기 데이터로 덮기"
              detail="계정에 저장된 내용이 이 기기 것으로 바뀝니다. 다른 기기에서 저장한 내용은 사라집니다."
              onClick={() => void keepLocal()}
            />
          </Stack>
        </DialogContent>
      </Dialog>

      <Snackbar open={merge !== null} autoHideDuration={8000} onClose={dismissMerge}>
        <Alert severity="success" onClose={dismissMerge} variant="filled">
          {merge &&
            `저장 슬롯 ${merge.slotsAdded}개를 추가했습니다` +
              (merge.slotsSkipped > 0 ? ` (칸이 모자라 ${merge.slotsSkipped}개는 이 기기에 남겨뒀습니다)` : '') +
              (merge.sharedItemsAdded > 0 ? ` · 공용 아이템 ${merge.sharedItemsAdded}개 합침` : '')}
        </Alert>
      </Snackbar>

      <Snackbar open={syncStatus === 'error' && message !== null} autoHideDuration={10000}>
        <Alert severity="error" variant="filled">
          {message}
        </Alert>
      </Snackbar>
    </>
  )
}
