import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import MonsterIcon from './MonsterIcon'
import { useMonsterStore } from '../../store/monsterStore'
import { MONSTERS, LEVEL_RANGE } from '../../data/mobs'
import { REGION_CATEGORIES, REGION_ICON } from '../../data/mobs/regionCategory'
import { monsterLabel, parseElemAttr } from '../../domain/monster'

/** 속성별 색상 (불=빨강·얼음=파랑·번개=노랑·독=초록·성=회색) */
const ELEM_HEX: Record<string, string> = { F: '#e53935', I: '#1e88e5', L: '#fbc02d', S: '#43a047', H: '#9e9e9e' }
/** 밝은 배경 → 어두운 글자(채움 칩) */
const ELEM_DARK_TEXT = new Set(['L'])

const ALL_REGION = '__all__'
/** 카테고리명 → 소속 지역명 Set (빠른 필터) */
const CATEGORY_REGIONS: Record<string, Set<string>> = Object.fromEntries(
  REGION_CATEGORIES.map((c) => [c.name, new Set(c.regions.map((r) => r.name))]),
)
/** 선택값 라벨(전체/카테고리/지역) */
function selLabel(sel: string): string {
  if (sel === ALL_REGION) return '전체 지역'
  return sel.slice(2) // 'c:' | 'r:' 접두 제거
}

/** 몬스터 검색/필터/선택 모달 */
export default function MonsterSelectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const selectedId = useMonsterStore((s) => s.selectedId)
  const select = useMonsterStore((s) => s.select)

  const [sel, setSel] = useState<string>(ALL_REGION)
  const [query, setQuery] = useState('')
  const [minLv, setMinLv] = useState('')
  const [maxLv, setMaxLv] = useState('')
  const [bossOnly, setBossOnly] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const lo = minLv.trim() === '' ? -Infinity : Number(minLv)
    const hi = maxLv.trim() === '' ? Infinity : Number(maxLv)
    // 'c:{카테고리}' → 카테고리 전체, 'r:{지역}' → 특정 지역
    const catRegions = sel.startsWith('c:') ? CATEGORY_REGIONS[sel.slice(2)] : null
    const region = sel.startsWith('r:') ? sel.slice(2) : null
    return MONSTERS.filter((m) => {
      const found = m.foundAt ?? []
      if (catRegions && !found.some((r) => catRegions.has(r))) return false
      if (region && !found.includes(region)) return false
      if (bossOnly && !m.isBoss) return false
      if (m.level < lo || m.level > hi) return false
      if (q) {
        const hay = `${m.koreanName ?? ''} ${m.name}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    }).sort((a, b) => a.id - b.id)
  }, [sel, query, minLv, maxLv, bossOnly])

  const pick = (id: number) => {
    select(id)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>몬스터 선택</DialogTitle>
      <DialogContent>
        {/* 필터 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, pt: 0.5 }}>
          <TextField
            size="small"
            fullWidth
            autoFocus
            placeholder="몬스터 이름 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Box component="span" sx={{ fontSize: 14 }}>🔍</Box></InputAdornment>,
            }}
          />
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            <Select
              size="small"
              value={sel}
              onChange={(e) => setSel(e.target.value)}
              renderValue={(v) =>
                v.startsWith('r:') ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box component="img" src={REGION_ICON[v.slice(2)]} alt="" sx={{ width: 28, height: 28, imageRendering: 'pixelated' }} />
                    {v.slice(2)}
                  </Box>
                ) : (
                  selLabel(v)
                )
              }
              MenuProps={{ PaperProps: { sx: { maxHeight: 500 } } }}
              sx={{ flex: 1, '& .MuiSelect-select': { py: 1, fontSize: 15, display: 'flex', alignItems: 'center' } }}
            >
              <MenuItem value={ALL_REGION} sx={{ fontSize: 16, fontWeight: 700, py: 1 }}>전체 지역</MenuItem>
              {REGION_CATEGORIES.flatMap((c) => [
                // 상위 카테고리(아이콘 없이, 살짝 크게) — 선택 시 카테고리 전체
                <MenuItem key={`c:${c.name}`} value={`c:${c.name}`} sx={{ fontSize: 16, fontWeight: 700, py: 1, mt: 0.25 }}>
                  {c.name}
                </MenuItem>,
                // 하위 지역(들여쓰기 + 맵 아이콘)
                ...c.regions.map((r) => (
                  <MenuItem key={`r:${r.name}`} value={`r:${r.name}`} sx={{ fontSize: 14, pl: 2.5, py: 0.75, gap: 1, color: 'text.secondary' }}>
                    <Box component="img" src={r.icon} alt="" sx={{ width: 30, height: 30, imageRendering: 'pixelated' }} />
                    {r.name}
                  </MenuItem>
                )),
              ])}
            </Select>
            <Chip
              label="보스"
              size="small"
              color={bossOnly ? 'error' : 'default'}
              variant={bossOnly ? 'filled' : 'outlined'}
              onClick={() => setBossOnly((v) => !v)}
              sx={{ alignSelf: 'center' }}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">레벨</Typography>
            <TextField size="small" type="number" placeholder={String(LEVEL_RANGE.min)} value={minLv} onChange={(e) => setMinLv(e.target.value)} sx={{ width: 80 }} />
            <Typography variant="caption" color="text.secondary">~</Typography>
            <TextField size="small" type="number" placeholder={String(LEVEL_RANGE.max)} value={maxLv} onChange={(e) => setMaxLv(e.target.value)} sx={{ width: 80 }} />
          </Box>
        </Box>

        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1, mb: 0.5 }}>
          {filtered.length}종
        </Typography>

        {/* 목록 (2열 그리드로 더 크게) */}
        <Box sx={{ maxHeight: 560, overflowY: 'auto', display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 0.5 }}>
          {filtered.length === 0 ? (
            <Typography variant="caption" color="text.disabled" sx={{ py: 2, textAlign: 'center', gridColumn: '1 / -1' }}>조건에 맞는 몬스터 없음</Typography>
          ) : (
            filtered.map((m) => {
              const active = m.id === selectedId
              return (
                <Box
                  key={m.id}
                  onClick={() => pick(m.id)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    px: 1,
                    py: 1,
                    borderRadius: 1,
                    cursor: 'pointer',
                    border: 1,
                    borderColor: active ? 'primary.main' : 'divider',
                    bgcolor: active ? 'action.selected' : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <MonsterIcon id={m.id} size={64} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body1" noWrap sx={{ fontWeight: 700 }}>{monsterLabel(m)}</Typography>
                    <Typography variant="body2" color="text.secondary">Lv.{m.level}</Typography>
                    {(() => {
                      const els = parseElemAttr(m.elemAttr)
                      if (els.length === 0) return null
                      return (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25, mt: 0.25 }}>
                          {els.map((e) => {
                            const c = ELEM_HEX[e.code] ?? '#9e9e9e'
                            const weak = e.effect === '약점'
                            return (
                              <Chip
                                key={e.code}
                                label={`${e.element} ${e.effect}`}
                                size="small"
                                variant={weak ? 'filled' : 'outlined'}
                                sx={{
                                  height: 18,
                                  fontSize: 10,
                                  borderColor: c,
                                  bgcolor: weak ? c : 'transparent',
                                  color: weak ? (ELEM_DARK_TEXT.has(e.code) ? '#212121' : '#fff') : c,
                                }}
                              />
                            )
                          })}
                        </Box>
                      )
                    })()}
                  </Box>
                  {m.isBoss && <Chip label="보스" size="small" color="error" variant="outlined" sx={{ height: 20, fontSize: 11 }} />}
                </Box>
              )
            })
          )}
        </Box>
      </DialogContent>
    </Dialog>
  )
}
