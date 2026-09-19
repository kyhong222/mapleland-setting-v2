/**
 * 문의 작성. docs/feedback.md §1·§4
 *
 * 로그인해야 쓸 수 있다 — 디스코드 계정이 연락처를 대신하고, 답변은 '내 문의'에서 본다.
 * 폼(유형·제목·내용)은 예전 그대로다. 연락처 칸과 스팸 허니팟만 빠졌다.
 */

import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { createFeedback, type FeedbackType } from '../data/cloud/feedback'
import { useAuthStore } from '../store/authStore'

const TYPES = [
  { value: 'bug', label: '🐛 버그 제보' },
  { value: 'idea', label: '💡 기능 건의' },
  { value: 'etc', label: '💬 기타' },
] as const

const TITLE_MAX = 120
const BODY_MAX = 5000

type Status = 'idle' | 'submitting' | 'success' | 'error'

export default function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const authStatus = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const signIn = useAuthStore((s) => s.signIn)

  const [type, setType] = useState<FeedbackType>('bug')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const signedIn = authStatus === 'signedIn' && user !== null
  const canSubmit = signedIn && title.trim().length > 0 && body.trim().length > 0 && status !== 'submitting'

  const reset = () => {
    setType('bug')
    setTitle('')
    setBody('')
    setStatus('idle')
    setErrorMsg('')
  }
  const handleClose = () => {
    if (status !== 'submitting') {
      onClose()
      setTimeout(reset, 200)
    }
  }

  const submit = async () => {
    if (!canSubmit || !user) return
    setStatus('submitting')
    setErrorMsg('')
    try {
      await createFeedback(user.id, {
        type,
        title: title.trim(),
        body: body.trim(),
        // 지금 닉네임을 행에 박아 둔다 — 나중에 바뀌어도 당시 기록이 남는다(docs/feedback.md §2)
        authorName: user.name,
        authorAvatar: user.avatarUrl ?? null,
      })
      setStatus('success')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '전송에 실패했습니다.')
      setStatus('error')
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>문의하기</DialogTitle>
      <DialogContent>
        {status === 'success' ? (
          <Box sx={{ py: 1 }}>
            <Alert severity="success">문의가 접수되었습니다. 감사합니다!</Alert>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              답변이 달리면 계정 메뉴의 <b>내 문의</b>에서 확인할 수 있습니다.
            </Typography>
          </Box>
        ) : !signedIn ? (
          <Box sx={{ py: 1 }}>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              문의하려면 디스코드 로그인이 필요합니다.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              연락처를 따로 적지 않아도 되고, 남긴 문의와 답변을 계정에서 계속 확인할 수 있습니다.
            </Typography>
          </Box>
        ) : (
          <>
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1.5 }}>
              {/* </b> 뒤의 줄바꿈은 JSX가 공백 없이 삼킨다 — {' '}로 명시해야 붙지 않는다 */}
              버그 제보나 건의사항을 남겨주세요. 답변에 도움이 될 문의는 <b>공개 목록에 실릴 수 있으니</b>{' '}
              개인정보는 넣지 마세요.
            </Typography>

            <Select
              size="small"
              fullWidth
              value={type}
              onChange={(e) => setType(e.target.value as FeedbackType)}
              sx={{ mb: 1.5 }}
            >
              {TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </Select>

            <TextField
              size="small"
              fullWidth
              label="제목"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
              sx={{ mb: 1.5 }}
              slotProps={{ htmlInput: { maxLength: TITLE_MAX } }}
            />

            <TextField
              size="small"
              fullWidth
              label="내용"
              required
              multiline
              minRows={5}
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
              helperText={`${body.length} / ${BODY_MAX}`}
              sx={{ mb: 0.5 }}
              slotProps={{ htmlInput: { maxLength: BODY_MAX } }}
            />

            <Typography variant="caption" color="text.secondary">
              디스코드 아이디가 기록되며 답변에 사용됩니다.
            </Typography>

            {status === 'error' && (
              <Alert severity="error" sx={{ mt: 1 }}>
                전송에 실패했습니다{errorMsg ? ` (${errorMsg})` : ''}.
              </Alert>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {status === 'success' ? (
          <Button onClick={handleClose} variant="contained">
            닫기
          </Button>
        ) : !signedIn ? (
          <>
            <Button onClick={handleClose} color="inherit">
              취소
            </Button>
            <Button onClick={() => void signIn()} variant="contained" disabled={authStatus === 'loading'}>
              디스코드 로그인
            </Button>
          </>
        ) : (
          <>
            <Button onClick={handleClose} color="inherit" disabled={status === 'submitting'}>
              취소
            </Button>
            <Button
              onClick={() => void submit()}
              variant="contained"
              disabled={!canSubmit}
              startIcon={status === 'submitting' ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {status === 'submitting' ? '전송 중…' : '보내기'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
