/**
 * '이 기기에서 불러오기' — 로그인 전에 이 기기에서 쓰던 것을 계정으로 옮긴다.
 * docs/cloud-sync.md §5
 *
 * 로그인하면 화면이 계정 기준으로 바뀌는데, 그때 게스트 데이터를 `mlsv2:guest`로 옮겨 둔다.
 * 그건 로그아웃하면 그대로 돌아오므로 사라진 게 아니고, 여기서는 그 벌을 계정으로 **복사**한다.
 *
 * 옮기기는 한 번에 하나씩이다(항목 고르기 → 계정 칸 고르기). 기존 저장 슬롯 화면과 같은
 * 조작이라 따로 배울 게 없다. 통째로 가져올 때만 아래쪽 '전체 덮어쓰기'를 쓴다.
 */

import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import Paper from '@mui/material/Paper'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { JOBS } from '../domain/jobs'
import type { BuildSnapshot } from '../store/buildStore'
import { useSlotsStore } from '../store/slotsStore'
import {
  bundleCurrentBuild,
  importSharedItems,
  importSlot,
  loadGuestBundle,
  ownerCountOfShared,
  restoreBundle,
  type LocalBundle,
} from '../store/snapshot'

/** 옮길 항목 하나 — 게스트 벌의 저장 슬롯이거나 '작업하던 빌드' */
interface Entry {
  key: string
  name: string
  snapshot: BuildSnapshot
}

const jobLine = (s: BuildSnapshot) => `[Lv. ${s.level}] ${JOBS[s.jobId].label}`

export default function LocalImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const slots = useSlotsStore((s) => s.slots)
  const [bundle, setBundle] = useState<LocalBundle | null>(null)
  /** 대상 칸을 고르는 중인 항목 (null이면 목록 화면) */
  const [pick, setPick] = useState<Entry | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // 열 때마다 다시 읽는다 — 그 사이 다른 탭에서 로그인했을 수 있다
  useEffect(() => {
    if (open) {
      setBundle(loadGuestBundle())
      setPick(null)
      setConfirmAll(false)
    }
  }, [open])

  const entries: Entry[] = []
  if (bundle) {
    const current = bundleCurrentBuild(bundle)
    if (current) entries.push({ key: 'current', name: '작업하던 빌드', snapshot: current })
    bundle.slots.forEach((s, i) => {
      if (s) entries.push({ key: `slot-${i}`, name: s.name?.trim() || `슬롯 ${i + 1}`, snapshot: s.snapshot })
    })
  }
  const sharedCount = bundle ? ownerCountOfShared(bundle.state.inventory) : 0
  const savedAt = bundle?.at ? new Date(bundle.at).toLocaleString('ko-KR') : null

  const doImport = (target: number) => {
    if (!pick) return
    importSlot(pick.snapshot, target, pick.name)
    setToast(`'${pick.name}'을(를) ${target + 1}번 칸에 넣었습니다.`)
    setPick(null)
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pb: 0.5 }}>
          {pick ? '어느 칸에 넣을까요?' : '이 기기에서 불러오기'}
        </DialogTitle>
        <DialogContent dividers>
          {!bundle ? (
            <Typography variant="body2" color="text.secondary">
              로그인 전에 이 기기에서 쓰던 내용이 없습니다.
            </Typography>
          ) : pick ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                '{pick.name}'을(를) 넣을 칸을 고르세요. 이미 쓰는 칸을 고르면 그 내용은 덮입니다.
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(6, 1fr)' }, gap: 1 }}>
                {slots.map((slot, i) => (
                  <Button
                    key={i}
                    size="small"
                    variant={slot ? 'outlined' : 'contained'}
                    color={slot ? 'warning' : 'primary'}
                    onClick={() => doImport(i)}
                    sx={{ flexDirection: 'column', py: 0.75, lineHeight: 1.3 }}
                  >
                    <Box component="span" sx={{ fontWeight: 700 }}>
                      {i + 1}
                    </Box>
                    <Box component="span" sx={{ fontSize: '0.65rem', opacity: 0.9 }}>
                      {slot ? '사용 중' : '비어 있음'}
                    </Box>
                  </Button>
                ))}
              </Box>
            </>
          ) : (
            <>
              {savedAt && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  로그인 전({savedAt}) 이 기기 내용입니다. 로그아웃하면 그대로 돌아옵니다.
                </Typography>
              )}

              <Stack spacing={1}>
                {entries.map((e) => (
                  <Paper key={e.key} variant="outlined" sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontWeight: 700 }}>
                        {e.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {jobLine(e.snapshot)}
                      </Typography>
                    </Box>
                    <Button size="small" variant="outlined" onClick={() => setPick(e)}>
                      가져오기
                    </Button>
                  </Paper>
                ))}

                {sharedCount > 0 && (
                  <Paper variant="outlined" sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontWeight: 700 }}>
                        공용 인벤토리
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        아이템 {sharedCount}개 · 계정에 없는 것만 더합니다
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        const n = importSharedItems(bundle.state.inventory)
                        setToast(n > 0 ? `공용 아이템 ${n}개를 더했습니다.` : '더할 아이템이 없습니다.')
                      }}
                    >
                      합치기
                    </Button>
                  </Paper>
                )}

                {entries.length === 0 && sharedCount === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    가져올 내용이 없습니다.
                  </Typography>
                )}
              </Stack>

              <Divider sx={{ my: 2 }} />

              {confirmAll ? (
                <Alert
                  severity="warning"
                  action={
                    <Stack direction="row" spacing={1}>
                      <Button size="small" onClick={() => setConfirmAll(false)}>
                        취소
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        variant="contained"
                        onClick={() => {
                          restoreBundle(bundle)
                          setConfirmAll(false)
                          setToast('이 기기 내용으로 전체를 덮었습니다.')
                          onClose()
                        }}
                      >
                        덮어쓰기
                      </Button>
                    </Stack>
                  }
                >
                  계정의 슬롯과 인벤토리가 모두 이 기기 것으로 바뀝니다.
                </Alert>
              ) : (
                <Button color="error" size="small" onClick={() => setConfirmAll(true)}>
                  이 기기 내용으로 전체 덮어쓰기
                </Button>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          {pick && <Button onClick={() => setPick(null)}>뒤로</Button>}
          <Button onClick={onClose}>닫기</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast !== null}
        message={toast ?? ''}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
      />
    </>
  )
}
