import { useMemo, useState } from 'react'
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
import ItemIcon from './common/ItemIcon'
import { JOBS } from '../domain/jobs'
import { SLOTS } from '../domain/equipSlots'
import { resolveBuiltItem } from '../domain/builtItem'
import type { GradeResult } from '../domain/grade'
import { useSlotsStore, SLOT_GROUP_SIZE } from '../store/slotsStore'
import type { SavedSlot } from '../store/slotsStore'
import type { EquipInstance } from '../store/equipInstance'
import { useInventoryStore, ownerOf } from '../store/inventoryStore'
import type { InventoryItem } from '../store/inventoryStore'
import { captureSnapshot, applySnapshot } from '../store/snapshot'
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
 * 카드에 미리 보여줄 장착 부위 — 무기·방패·상의·하의·장갑·신발 순.
 * 한벌옷은 별도 인스턴스 없이 top 칸에 들어가므로(equipInstance.ts) top 하나로 덮이고,
 * 한벌옷을 입으면 하의가 비어 자연히 '무기-방패-전신-장갑-신발'로 렌더된다.
 */
const EQUIP_PREVIEW: EquipInstance[] = ['weapon', 'secondary', 'top', 'bottom', 'gloves', 'shoes']

/**
 * 슬롯에 장착돼 있던 장비를 표시용으로 푼다.
 * equipped는 인벤토리 id만 들고 있어서, 슬롯을 따라다니는 개인 인벤토리(스냅샷)와
 * 공용 인벤토리(현재 스토어) 양쪽에서 찾아야 이름이 나온다. 못 찾으면 건너뛴다
 * (구버전 스냅샷엔 personalItems가 없어 개인 장비는 조회되지 않는다).
 * 부위 이름은 인스턴스가 아니라 실제 아이템의 도메인 슬롯에서 가져온다 —
 * secondary 칸이 방패인지 화살인지, top 칸이 상의인지 한벌옷인지가 그래야 구분된다.
 */
interface PreviewItem {
  inst: EquipInstance
  label: string
  name: string
  iconUrl?: string
  grade: GradeResult
}

function equippedPreview(slot: SavedSlot, sharedItems: InventoryItem[]): PreviewItem[] {
  const byId = new Map<string, InventoryItem>()
  for (const it of sharedItems) byId.set(it.id, it)
  for (const it of slot.snapshot.personalItems ?? []) byId.set(it.id, it)
  const out: PreviewItem[] = []
  for (const inst of EQUIP_PREVIEW) {
    const invId = slot.snapshot.equipped[inst]
    if (!invId) continue
    const item = byId.get(invId)
    if (!item) continue
    const base = item.built.base
    out.push({
      inst,
      label: SLOTS[base.slot].label,
      name: base.name,
      iconUrl: base.iconUrl,
      grade: resolveBuiltItem(item.built).grade,
    })
  }
  return out
}

export default function SlotManager({ open, onClose }: Props) {
  const slots = useSlotsStore((s) => s.slots)
  const save = useSlotsStore((s) => s.save)
  const clear = useSlotsStore((s) => s.clear)
  const rename = useSlotsStore((s) => s.rename)
  // 저장 가능 여부만 반응형으로 본다 (실제 캡처는 여러 스토어를 훑는 captureSnapshot이 담당)
  const canSave = useBuildStore((s) => s.jobId !== null)
  // 장착 미리보기용 — 공용 인벤토리는 스냅샷에 없어서 현재 것을 쓴다
  const invItems = useInventoryStore((s) => s.items)
  const sharedItems = useMemo(() => invItems.filter((it) => ownerOf(it) === 'shared'), [invItems])
  // 등급 산출까지 도는 계산이라 슬롯/인벤토리가 바뀔 때만 다시 푼다
  // (이름 편집 입력마다 24칸을 재계산하지 않도록)
  const previews = useMemo(
    () => slots.map((s) => (s ? equippedPreview(s, sharedItems) : [])),
    [slots, sharedItems],
  )

  const [confirm, setConfirm] = useState<Confirm>(null)
  const [renameIndex, setRenameIndex] = useState<number | null>(null)
  const [renameText, setRenameText] = useState('')

  // 덮어쓰기는 기존 이름을 그대로 물려준다 (name을 빼면 스토어가 이름을 지운다)
  const doSave = (i: number) => {
    const snap = captureSnapshot()
    if (snap) save(i, snap, slots[i]?.name)
  }
  const handleLoad = (i: number) => {
    const slot = slots[i]
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
        <DialogTitle>저장 슬롯</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
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
                    const slot = slots[i]
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
                              <IconButton
                                size="small"
                                onClick={() => openRename(i)}
                                title="이름 편집"
                                aria-label={`${slotLabel(slot, i)} 이름 편집`}
                                sx={{ p: 0.75, fontSize: '1.15rem', lineHeight: 1, flexShrink: 0 }}
                              >
                                ✎
                              </IconButton>
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
                            {/* 3등분해서 슬롯 하단을 꽉 채운다 */}
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
