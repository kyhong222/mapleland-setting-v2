/**
 * '이 기기에서 불러오기' — 로그인 전에 이 기기에서 쓰던 것을 계정으로 옮긴다.
 * docs/cloud-sync.md §5
 *
 * 로그인하면 화면이 계정 기준으로 바뀌는데, 그때 게스트 데이터를 `mlsv2:guest`로 옮겨 둔다.
 * 그건 로그아웃하면 그대로 돌아오므로 사라진 게 아니고, 여기서는 그 벌을 계정으로 **복사**한다.
 *
 * 두 단계로 나뉘고, 둘 다 저장 슬롯 화면과 같은 카드를 쓴다 — 고르는 대상이 같으니
 * 생김새도 같아야 한다.
 *   1) 가져올 것 고르기 (게스트 벌)
 *   2) 넣을 칸 고르기  (계정의 24칸)
 */

import { useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Paper from '@mui/material/Paper'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import SnapshotCard from './common/SnapshotCard'
import { JOBS } from '../domain/jobs'
import { equippedPreview } from '../lib/slotPreview'
import type { BuildSnapshot } from '../store/buildStore'
import { useInventoryStore, ownerOf } from '../store/inventoryStore'
import { useSlotsStore, SLOT_GROUP_SIZE } from '../store/slotsStore'
import {
  bundleCurrentBuild,
  importSharedItems,
  importSlot,
  loadGuestBundle,
  ownerCountOfShared,
  restoreBundle,
  type LocalBundle,
} from '../store/snapshot'

/** 가져올 항목 하나 — 게스트 벌의 저장 슬롯이거나 '작업하던 빌드' */
interface Entry {
  key: string
  name: string
  savedAt: number
  snapshot: BuildSnapshot
}

const jobLine = (s: BuildSnapshot) => `[Lv. ${s.level}] ${JOBS[s.jobId].label}`

/** 저장 슬롯 화면과 같은 격자 (한 계정당 캐릭터 6개) */
const GRID_SX = {
  display: 'grid',
  gridTemplateColumns: {
    xs: 'repeat(2, 1fr)',
    sm: 'repeat(3, 1fr)',
    md: `repeat(${SLOT_GROUP_SIZE}, 1fr)`,
  },
  gap: 1.25,
} as const

const ACTION_SX = { flex: 1, minWidth: 0, px: 0.5, whiteSpace: 'nowrap' } as const

export default function LocalImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const slots = useSlotsStore((s) => s.slots)
  const invItems = useInventoryStore((s) => s.items)
  const [bundle, setBundle] = useState<LocalBundle | null>(null)
  /** 넣을 칸을 고르는 중인 항목 (null이면 1단계) */
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

  const entries = useMemo<Entry[]>(() => {
    if (!bundle) return []
    const out: Entry[] = []
    const current = bundleCurrentBuild(bundle)
    if (current) out.push({ key: 'current', name: '작업하던 빌드', savedAt: bundle.at, snapshot: current })
    bundle.slots.forEach((s, i) => {
      if (s) {
        out.push({
          key: `slot-${i}`,
          name: s.name?.trim() || `슬롯 ${i + 1}`,
          savedAt: s.savedAt,
          snapshot: s.snapshot,
        })
      }
    })
    return out
  }, [bundle])

  // 게스트 카드는 **게스트 벌의** 공용 인벤토리로 풀어야 장비 이름이 나온다(lib/slotPreview 주석)
  const guestShared = useMemo(
    () => (bundle?.state.inventory ?? []).filter((it) => ownerOf(it) === 'shared'),
    [bundle],
  )
  const guestPreviews = useMemo(
    () => entries.map((e) => equippedPreview(e.snapshot, guestShared)),
    [entries, guestShared],
  )

  // 계정(현재) 칸 카드는 현재 스토어의 공용 인벤토리로 푼다
  const accountShared = useMemo(() => invItems.filter((it) => ownerOf(it) === 'shared'), [invItems])
  const accountPreviews = useMemo(
    () => slots.map((s) => (s ? equippedPreview(s.snapshot, accountShared) : [])),
    [slots, accountShared],
  )

  const sharedCount = bundle ? ownerCountOfShared(bundle.state.inventory) : 0

  const doImport = (target: number) => {
    if (!pick) return
    importSlot(pick.snapshot, target, pick.name)
    setToast(`'${pick.name}'을(를) ${target + 1}번 칸에 넣었습니다.`)
    setPick(null)
  }

  /** 24칸을 6칸 묶음으로 자른다 (저장 슬롯 화면과 동일) */
  const groups: number[][] = []
  for (let i = 0; i < slots.length; i += SLOT_GROUP_SIZE) {
    groups.push(Array.from({ length: SLOT_GROUP_SIZE }, (_, j) => i + j).filter((n) => n < slots.length))
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
        <DialogTitle>{pick ? `'${pick.name}'을(를) 어느 칸에 넣을까요?` : '이 기기에서 불러오기'}</DialogTitle>
        <DialogContent dividers>
          {!bundle ? (
            <Typography variant="body2" color="text.secondary">
              로그인 전에 이 기기에서 쓰던 내용이 없습니다.
            </Typography>
          ) : pick ? (
            /* ── 2단계: 넣을 칸 고르기 ───────────────────────────── */
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                이미 쓰는 칸을 고르면 그 내용은 덮입니다.
              </Typography>
              {groups.map((group, g) => (
                <Paper key={g} variant="outlined" sx={{ p: 1.25, bgcolor: 'action.hover' }}>
                  <Box sx={GRID_SX}>
                    {group.map((i) => {
                      const slot = slots[i]
                      return (
                        <SnapshotCard
                          key={i}
                          title={slot?.name?.trim() || `슬롯 ${i + 1}`}
                          subtitle={slot ? jobLine(slot.snapshot) : undefined}
                          savedAt={slot?.savedAt}
                          preview={accountPreviews[i]}
                          empty={!slot}
                        >
                          <Stack direction="row" sx={{ mt: 0.75 }}>
                            <Button
                              size="small"
                              variant="contained"
                              color={slot ? 'error' : 'primary'}
                              onClick={() => doImport(i)}
                              sx={ACTION_SX}
                            >
                              {slot ? '덮어쓰기' : '여기에 넣기'}
                            </Button>
                          </Stack>
                        </SnapshotCard>
                      )
                    })}
                  </Box>
                </Paper>
              ))}
            </Stack>
          ) : (
            /* ── 1단계: 가져올 것 고르기 ─────────────────────────── */
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                로그인 전 이 기기에서 쓰던 내용입니다. 로그아웃하면 그대로 돌아오니, 여기서는 계정으로 복사만 합니다.
              </Typography>

              {entries.length > 0 ? (
                <Box sx={GRID_SX}>
                  {entries.map((e, n) => (
                    <SnapshotCard
                      key={e.key}
                      title={e.name}
                      subtitle={jobLine(e.snapshot)}
                      savedAt={e.savedAt}
                      preview={guestPreviews[n]}
                    >
                      <Stack direction="row" sx={{ mt: 0.75 }}>
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          onClick={() => setPick(e)}
                          sx={ACTION_SX}
                        >
                          가져오기
                        </Button>
                      </Stack>
                    </SnapshotCard>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  가져올 빌드가 없습니다.
                </Typography>
              )}

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
              >
                {sharedCount > 0 ? (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      const n = importSharedItems(bundle.state.inventory)
                      setToast(n > 0 ? `공용 아이템 ${n}개를 더했습니다.` : '더할 아이템이 없습니다.')
                    }}
                  >
                    공용 인벤토리 {sharedCount}개 합치기
                  </Button>
                ) : (
                  <Box />
                )}
                <Button size="small" color="error" onClick={() => setConfirmAll(true)}>
                  이 기기 내용으로 전체 덮어쓰기
                </Button>
              </Stack>

              {confirmAll && (
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
              )}
            </Stack>
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
