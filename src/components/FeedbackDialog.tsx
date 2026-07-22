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
import Link from '@mui/material/Link'
import CircularProgress from '@mui/material/CircularProgress'

/** 문의가 등록될 공개 저장소 */
const OWNER = 'kyhong222'
const REPO = 'mapleland-setting-v2'
/** 서버리스 프록시 엔드포인트 (미설정 시 동일 출처 /api/feedback). 실패 시 GitHub 프리필로 폴백 */
const ENDPOINT = import.meta.env.VITE_FEEDBACK_ENDPOINT || '/api/feedback'

const TYPES = [
  { value: 'bug', label: '🐛 버그 제보' },
  { value: 'idea', label: '💡 기능 건의' },
  { value: 'etc', label: '💬 기타' },
] as const
type FeedbackType = (typeof TYPES)[number]['value']

const TITLE_MAX = 120
const BODY_MAX = 5000

/** [유형] 접두사가 붙은 이슈 제목 */
function issueTitle(type: FeedbackType, title: string): string {
  const tag = TYPES.find((t) => t.value === type)?.label ?? ''
  return `${tag} ${title}`.trim()
}

/** 이슈 본문 (내용 + 연락처) */
function issueBody(body: string, contact: string): string {
  const lines = [body.trim()]
  if (contact.trim()) lines.push('', '---', `연락처: ${contact.trim()}`)
  return lines.join('\n')
}

/** 백엔드 없이 GitHub 새 이슈 페이지를 채워서 여는 폴백 URL */
function prefillUrl(type: FeedbackType, title: string, body: string, contact: string): string {
  const q = new URLSearchParams({ title: issueTitle(type, title), body: issueBody(body, contact) })
  return `https://github.com/${OWNER}/${REPO}/issues/new?${q.toString()}`
}

type Status = 'idle' | 'submitting' | 'success' | 'error'

export default function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [type, setType] = useState<FeedbackType>('bug')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [contact, setContact] = useState('')
  const [hp, setHp] = useState('') // 허니팟(스팸봇 트랩) — 사람은 비워둠
  const [status, setStatus] = useState<Status>('idle')
  const [resultUrl, setResultUrl] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && status !== 'submitting'

  const reset = () => {
    setType('bug'); setTitle(''); setBody(''); setContact(''); setHp('')
    setStatus('idle'); setResultUrl(''); setErrorMsg('')
  }
  const handleClose = () => { if (status !== 'submitting') { onClose(); setTimeout(reset, 200) } }

  const submit = async () => {
    if (!canSubmit) return
    setStatus('submitting'); setErrorMsg('')
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title: title.trim(), body: body.trim(), contact: contact.trim(), hp }),
      })
      if (!res.ok) throw new Error(`서버 응답 오류 (${res.status})`)
      const data = await res.json().catch(() => ({}))
      setResultUrl(typeof data?.url === 'string' ? data.url : '')
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
            <Alert severity="success" sx={{ mb: 1 }}>문의가 정상적으로 접수되었습니다. 감사합니다!</Alert>
            {resultUrl && (
              <Typography variant="body2">
                등록된 문의: <Link href={resultUrl} target="_blank" rel="noopener">{resultUrl}</Link>
              </Typography>
            )}
          </Box>
        ) : (
          <>
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1.5 }}>
              버그 제보나 건의사항을 남겨주세요. 접수된 내용은 <b>공개 저장소의 이슈</b>로 등록되니 개인정보는 넣지 마세요.
            </Typography>

            <Select
              size="small" fullWidth value={type}
              onChange={(e) => setType(e.target.value as FeedbackType)}
              sx={{ mb: 1.5 }}
            >
              {TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </Select>

            <TextField
              size="small" fullWidth label="제목" required value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
              sx={{ mb: 1.5 }}
              slotProps={{ htmlInput: { maxLength: TITLE_MAX } }}
            />

            <TextField
              size="small" fullWidth label="내용" required multiline minRows={5} value={body}
              onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
              helperText={`${body.length} / ${BODY_MAX}`}
              sx={{ mb: 1.5 }}
              slotProps={{ htmlInput: { maxLength: BODY_MAX } }}
            />

            <TextField
              size="small" fullWidth label="연락처 (선택 · 공개됨)" value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="답변 받을 이메일/디스코드 등"
              sx={{ mb: 0.5 }}
            />

            {/* 허니팟: 화면에 보이지 않지만 봇이 채우면 서버에서 거른다 */}
            <Box aria-hidden sx={{ position: 'absolute', left: '-9999px', top: 0, height: 0, overflow: 'hidden' }}>
              <input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} name="website" />
            </Box>

            {status === 'error' && (
              <Alert severity="error" sx={{ mt: 1 }}>
                전송에 실패했습니다{errorMsg ? ` (${errorMsg})` : ''}. 아래 버튼으로 GitHub에서 직접 등록할 수 있어요.
              </Alert>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {status === 'success' ? (
          <Button onClick={handleClose} variant="contained">닫기</Button>
        ) : (
          <>
            {status === 'error' && (
              <Button
                component="a"
                href={prefillUrl(type, title, body, contact)}
                target="_blank" rel="noopener"
                sx={{ mr: 'auto' }}
              >
                GitHub에서 직접 등록
              </Button>
            )}
            <Button onClick={handleClose} color="inherit" disabled={status === 'submitting'}>취소</Button>
            <Button
              onClick={submit} variant="contained" disabled={!canSubmit}
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
