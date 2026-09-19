import { useEffect, useMemo, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import ItemIcon from './common/ItemIcon'
import { JOBS } from '../domain/jobs'
import { equippedPreview } from '../lib/slotPreview'
import { useSlotsStore, SLOT_COUNT, SLOT_GROUP_SIZE } from '../store/slotsStore'
import type { SavedSlot } from '../store/slotsStore'
import { useInventoryStore, ownerOf } from '../store/inventoryStore'
import { captureSnapshot, applySnapshot, loadGuestBundle } from '../store/snapshot'
import { useAuthStore } from '../store/authStore'
import { useBuildStore } from '../store/buildStore'

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * 슬롯 하단 액션 버튼 — 셋이 폭을 3등분해 꽉 채운다.
 * xl 폭에서 한 칸이 ≈240px라 기본 small 타이포로 '불러오기'가 한 줄에 들어간다.
 * (좁은 화면에선 열 수가 줄어 칸이 오히려 넓어지므로 nowrap만 유지하면 된다)
 */
const SLOT_ACTION_SX = {
  flex: 1,
  minWidth: 0,
  px: 0.5,
  whiteSpace: 'nowrap',
} as const

const NAME_MAX = 20

/** 슬롯 표시 이름 — 사용자가 붙인 이름이 없으면 '슬롯 N' */
const slotLabel = (slot: SavedSlot | null, index: number) => slot?.name?.trim() || `슬롯 ${index + 1}`

/** 이름 아래 보조줄 — '[Lv. 120] 히어로' */
const jobLine = (slot: SavedSlot) =>
  `[Lv. ${slot.snapshot.level}] ${JOBS[slot.snapshot.jobId].label}`

/** 되묻기 대상 — 빈 슬롯 저장은 잃을 게 없어 확인하지 않는다 */
type Confirm = { kind: 'save' | 'clear'; index: number } | null

/**
 * 어느 쪽 슬롯을 보고 있는지. docs/cloud-sync.md §5
 *  - account: 지금 스토어(로그인 중이면 계정 데이터). 편집 가능
 *  - local  : 로그인 전 이 기기 데이터. 로그인 중에는 게스트 벌이라 읽기 전용이다
 */
type SlotTab = 'account' | 'local'

export default function SlotManager({ open, onClose }: Props) {
  const slots = useSlotsStore((s) => s.slots)
  const save = useSlotsStore((s) => s.save)
  const clear = useSlotsStore((s) => s.clear)
  const rename = useSlotsStore((s) => s.rename)
  // 저장 가능 여부만 반응형으로 본다 (실제 캡처는 여러 스토어를 훑는 captureSnapshot이 담당)
  const canSave = useBuildStore((s) => s.jobId !== null)
  const authStatus = useAuthStore((s) => s.status)
  const signedIn = authStatus === 'signedIn'
  // Supabase 키가 없으면 탭 자체를 숨긴다 — 로컬 전용으로 쓰던 그대로 보인다
  const cloudEnabled = authStatus !== 'disabled'

  const [tab, setTab] = useState<SlotTab>('local')
  // 로그인하면 계정 쪽이 기본, 로그아웃하면 계정 탭이 잠기므로 로컬로 되돌린다
  useEffect(() => setTab(signedIn ? 'account' : 'local'), [signedIn])

  /**
   * 로그인 중의 '로컬' 탭은 게스트 벌을 본다. 열 때 한 번만 읽으면 되는 값이라
   * (그 사이 바뀌지 않는다) 여는 시점에만 잡는다.
   */
  const guest = useMemo(() => (open && signedIn ? loadGuestBundle() : null), [open, signedIn])
  /** 로그인 중 '로컬' 탭 = 읽기 전용. 저장/삭제/이름변경은 계정 쪽에서만 한다 */
  const readOnly = signedIn && tab === 'local'

  const viewSlots = useMemo(() => {
    if (!readOnly) return slots
    const padded: (SavedSlot | null)[] = Array.from({ length: SLOT_COUNT }, () => null)
    ;(guest?.slots ?? []).forEach((s, i) => {
      if (i < SLOT_COUNT) padded[i] = s ?? null
    })
    return padded
  }, [readOnly, slots, guest])

  // 장착 미리보기용 — 공용 인벤토리는 스냅샷에 없어서 보고 있는 쪽의 것을 쓴다.
  // 게스트 슬롯을 계정 인벤토리로 풀면 장비 이름이 조용히 빈다(lib/slotPreview 주석)
  const invItems = useInventoryStore((s) => s.items)
  const sharedItems = useMemo(() => {
    const source = readOnly ? (guest?.state.inventory ?? []) : invItems
    return source.filter((it) => ownerOf(it) === 'shared')
  }, [readOnly, guest, invItems])
  // 등급 산출까지 도는 계산이라 슬롯/인벤토리가 바뀔 때만 다시 푼다
  // (이름 편집 입력마다 24칸을 재계산하지 않도록)
  const previews = useMemo(
    () => viewSlots.map((s) => (s ? equippedPreview(s.snapshot, sharedItems) : [])),
    [viewSlots, sharedItems],
  )

  const [confirm, setConfirm] = useState<Confirm>(null)
  const [renameIndex, setRenameIndex] = useState<number | null>(null)
  const [renameText, setRenameText] = useState('')

  // 덮어쓰기는 기존 이름을 그대로 물려준다 (name을 빼면 스토어가 이름을 지운다)
  const doSave = (i: number) => {
    const snap = captureSnapshot()
    if (snap) save(i, snap, slots[i]?.name)
  }
  // 로컬 탭에서 불러오면 그 빌드가 현재 작업 빌드가 된다. 계정 탭에서 슬롯에 저장하면
  // 그대로 계정으로 넘어간다 — '로컬에서 계정으로 옮기기'가 이 두 동작으로 끝난다.
  const handleLoad = (i: number) => {
    const slot = viewSlots[i]
    if (slot) {
      applySnapshot(slot.snapshot)
      onClose()
    }
  }

  const openRename = (i: number) => {
    setRenameIndex(i)
    setRenameText(slots[i]?.name ?? '')
  }
  const closeRename = () => setRenameIndex(null)
  const submitRename = () => {
    if (renameIndex !== null) rename(renameIndex, renameText)
    closeRename()
  }

  const runConfirm = () => {
    if (!confirm) return
    if (confirm.kind === 'save') doSave(confirm.index)
    else clear(confirm.index)
    setConfirm(null)
  }

  // 한 계정당 캐릭터 6개 → 6칸씩 한 묶음으로 감싼다
  const groups: number[][] = []
  for (let i = 0; i < slots.length; i += SLOT_GROUP_SIZE) {
    groups.push(Array.from({ length: SLOT_GROUP_SIZE }, (_, j) => i + j).filter((n) => n < slots.length))
  }

  const confirmSlot = confirm ? slots[confirm.index] : null

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
        <DialogTitle sx={{ pb: cloudEnabled ? 0 : undefined }}>저장 슬롯</DialogTitle>
        {cloudEnabled && (
          <Tabs
            value={tab}
            onChange={(_, v: SlotTab) => setTab(v)}
            sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}
          >
            {/* 로그인 전에는 잠가 두어 '로그인하면 여기에 뭔가 있다'가 보이게 한다 */}
            <Tab value="account" label="디스코드 계정" disabled={!signedIn} />
            <Tab value="local" label="로컬" />
          </Tabs>
        )}
        <DialogContent dividers>
          <Stack spacing={2}>
            {cloudEnabled && !signedIn && (
              <Typography variant="body2" color="text.secondary">
                디스코드로 로그인하면 계정에 저장된 슬롯을 여기서 함께 볼 수 있습니다. 로그인해도 이 기기 내용은
                그대로 남습니다.
              </Typography>
            )}
            {readOnly && (
              <Typography variant="body2" color="text.secondary">
                로그인 전에 이 기기에서 쓰던 내용입니다. 여기서는 불러오기만 됩니다 — 불러온 뒤 '디스코드 계정'
                탭의 빈 칸에 저장하면 계정으로 넘어갑니다. 로그아웃하면 이 내용으로 돌아옵니다.
              </Typography>
            )}
            {groups.map((group, g) => (
              <Paper key={g} variant="outlined" sx={{ p: 1.25, bgcolor: 'action.hover' }}>
                <Box
                  sx={{
                    display: 'grid',
                    // 좁은 화면에서도 묶음은 유지하고 안에서만 줄바꿈된다
                    gridTemplateColumns: {
                      xs: 'repeat(2, 1fr)',
                      sm: 'repeat(3, 1fr)',
                      md: `repeat(${SLOT_GROUP_SIZE}, 1fr)`,
                    },
                    gap: 1.25,
                  }}
                >
                  {group.map((i) => {
                    const slot = viewSlots[i]
                    return (
                      <Paper
                        key={i}
                        variant="outlined"
                        sx={{
                          p: 1.25,
                          minHeight: 176,
                          display: 'flex',
                          flexDirection: 'column',
                          bgcolor: 'background.paper',
                        }}
                      >
                        {slot ? (
                          <>
                            {/* 사용자가 붙인 이름이 식별의 축이라 맨 위에 두고, 직업명은 그 아래 보조로 */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 0 }}>
                              <Typography
                                noWrap
                                title={slotLabel(slot, i)}
                                sx={{ flex: 1, minWidth: 0, fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.3 }}
                              >
                                {slotLabel(slot, i)}
                              </Typography>
                              {!readOnly && (
                                <IconButton
                                  size="small"
                                  onClick={() => openRename(i)}
                                  title="이름 편집"
                                  aria-label={`${slotLabel(slot, i)} 이름 편집`}
                                  sx={{ p: 0.75, fontSize: '1.15rem', lineHeight: 1, flexShrink: 0 }}
                                >
                                  ✎
                                </IconButton>
                              )}
                            </Box>
                            <Typography
                              color="text.secondary"
                              sx={{ fontSize: '1rem', fontWeight: 500 }}
                              noWrap
                              title={jobLine(slot)}
                            >
                              {jobLine(slot)}
                            </Typography>
                            <Typography variant="caption" color="text.disabled" noWrap>
                              {new Date(slot.savedAt).toLocaleString()}
                            </Typography>
                            {/* 저장시각과 버튼 사이 빈 공간에 장착 장비를 채운다 (없는 부위는 건너뜀).
                                이름은 hover 툴팁으로 빼고 아이콘만 한 줄에 늘어놓는다 */}
                            <Box sx={{ mt: 0.75, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {previews[i].map((e) => (
                                <Box
                                  key={e.inst}
                                  title={`${e.label} · ${e.name} (${e.grade.info.label})`}
                                  sx={{
                                    bgcolor: 'action.hover',
                                    borderRadius: 0.5,
                                    display: 'flex',
                                    flexShrink: 0,
                                  }}
                                >
                                  {/* 등급은 인벤토리와 같은 방식으로 아이콘 윤곽선 색에 싣는다 */}
                                  <ItemIcon
                                    src={e.iconUrl}
                                    alt={e.name}
                                    size={30}
                                    outlineColor={e.grade.info.color}
                                  />
                                </Box>
                              ))}
                            </Box>
                            <Box sx={{ flexGrow: 1 }} />
                            {/* 읽기 전용(로그인 중 로컬 탭)은 불러오기만. 그 외에는 3등분해 꽉 채운다 */}
                            <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }}>
                              <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                onClick={() => handleLoad(i)}
                                sx={SLOT_ACTION_SX}
                              >
                                불러오기
                              </Button>
                              {!readOnly && (
                                <>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="success"
                                    disabled={!canSave}
                                    onClick={() => setConfirm({ kind: 'save', index: i })}
                                    sx={SLOT_ACTION_SX}
                                  >
                                    저장
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="error"
                                    onClick={() => setConfirm({ kind: 'clear', index: i })}
                                    sx={SLOT_ACTION_SX}
                                  >
                                    삭제
                                  </Button>
                                </>
                              )}
                            </Stack>
                          </>
                        ) : (
                          <>
                            <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.3 }}>
                              슬롯 {i + 1}
                            </Typography>
                            <Box
                              sx={{
                                flexGrow: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Typography variant="body2" color="text.disabled">
                                비어있음
                              </Typography>
                            </Box>
                            {/* 빈 슬롯은 잃을 게 없어 되묻지 않고 바로 저장한다.
                                빈 칸이 많을 때 화면이 무거워지지 않게 outlined로 둔다 */}
                            {!readOnly && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="success"
                                fullWidth
                                disabled={!canSave}
                                onClick={() => doSave(i)}
                                sx={{ px: 0.5 }}
                              >
                                저장
                              </Button>
                            )}
                          </>
                        )}
                      </Paper>
                    )
                  })}
                </Box>
              </Paper>
            ))}
          </Stack>
        </DialogContent>
      </Dialog>

      {/* 덮어쓰기 / 삭제 확인 — 둘 다 기존 저장분이 사라지는 동작이다 */}
      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{confirm?.kind === 'save' ? '슬롯 덮어쓰기' : '슬롯 삭제'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {confirm && (
              <>
                <b>{slotLabel(confirmSlot, confirm.index)}</b>
                {confirmSlot && ` (${JOBS[confirmSlot.snapshot.jobId].label})`}
                {confirm.kind === 'save'
                  ? '에 현재 빌드를 덮어씁니다.'
                  : '을(를) 삭제합니다.'}
              </>
            )}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            기존에 저장된 빌드는 되돌릴 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>취소</Button>
          <Button
            variant="contained"
            color={confirm?.kind === 'save' ? 'success' : 'error'}
            onClick={runConfirm}
          >
            {confirm?.kind === 'save' ? '덮어쓰기' : '삭제'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 구분용 이름 지정 */}
      <Dialog open={renameIndex !== null} onClose={closeRename} maxWidth="xs" fullWidth>
        <DialogTitle>슬롯 {renameIndex !== null ? renameIndex + 1 : ''} 이름</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            value={renameText}
            onChange={(e) => setRenameText(e.target.value)}
            placeholder={renameIndex !== null ? `슬롯 ${renameIndex + 1}` : ''}
            helperText={`비워두면 '슬롯 ${renameIndex !== null ? renameIndex + 1 : ''}'로 표시됩니다 · ${renameText.length} / ${NAME_MAX}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitRename()
            }}
            sx={{ mt: 0.5 }}
            slotProps={{ htmlInput: { maxLength: NAME_MAX } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRename}>취소</Button>
          <Button variant="contained" onClick={submitRename}>
            확인
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
