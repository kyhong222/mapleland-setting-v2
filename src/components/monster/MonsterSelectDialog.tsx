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
import { REGION_CATEGORIES } from '../../data/mobs/regionCategory'
import { monsterLabel } from '../../domain/monster'

const ALL_REGION = '__all__'
/** 카테고리명 → 소속 지역 Set (빠른 필터) */
const CATEGORY_REGIONS: Record<string, Set<string>> = Object.fromEntries(
  REGION_CATEGORIES.map((c) => [c.name, new Set(c.regions)]),
)
const CATEGORY_ICON: Record<string, string> = Object.fromEntries(REGION_CATEGORIES.map((c) => [c.name, c.icon]))

/** 몬스터 검색/필터/선택 모달 */
export default function MonsterSelectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const selectedId = useMonsterStore((s) => s.selectedId)
  const select = useMonsterStore((s) => s.select)

  const [category, setCategory] = useState<string>(ALL_REGION)
  const [query, setQuery] = useState('')
  const [minLv, setMinLv] = useState('')
  const [maxLv, setMaxLv] = useState('')
  const [bossOnly, setBossOnly] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const lo = minLv.trim() === '' ? -Infinity : Number(minLv)
    const hi = maxLv.trim() === '' ? Infinity : Number(maxLv)
    const catRegions = category === ALL_REGION ? null : CATEGORY_REGIONS[category]
    return MONSTERS.filter((m) => {
      if (catRegions && !(m.foundAt ?? []).some((r) => catRegions.has(r))) return false
      if (bossOnly && !m.isBoss) return false
      if (m.level < lo || m.level > hi) return false
      if (q) {
        const hay = `${m.koreanName ?? ''} ${m.name}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    }).sort((a, b) => a.level - b.level)
  }, [category, query, minLv, maxLv, bossOnly])

  const pick = (id: number) => {
    select(id)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
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
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              renderValue={(v) =>
                v === ALL_REGION ? (
                  '전체 지역'
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box component="img" src={CATEGORY_ICON[v]} alt="" sx={{ width: 20, height: 20, imageRendering: 'pixelated' }} />
                    {v}
                  </Box>
                )
              }
              sx={{ flex: 1, '& .MuiSelect-select': { py: 0.75, fontSize: 13, display: 'flex', alignItems: 'center' } }}
            >
              <MenuItem value={ALL_REGION} sx={{ fontSize: 13 }}>전체 지역</MenuItem>
              {REGION_CATEGORIES.map((c) => (
                <MenuItem key={c.name} value={c.name} sx={{ fontSize: 13, gap: 0.75 }}>
                  <Box component="img" src={c.icon} alt="" sx={{ width: 20, height: 20, imageRendering: 'pixelated' }} />
                  {c.name}
                </MenuItem>
              ))}
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

        {/* 목록 */}
        <Box sx={{ maxHeight: 480, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {filtered.length === 0 ? (
            <Typography variant="caption" color="text.disabled" sx={{ py: 2, textAlign: 'center' }}>조건에 맞는 몬스터 없음</Typography>
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
                    gap: 1,
                    px: 0.75,
                    py: 0.75,
                    borderRadius: 1,
                    cursor: 'pointer',
                    border: 1,
                    borderColor: active ? 'primary.main' : 'transparent',
                    bgcolor: active ? 'action.selected' : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <MonsterIcon id={m.id} size={52} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body1" noWrap sx={{ fontWeight: 600 }}>{monsterLabel(m)}</Typography>
                    <Typography variant="body2" color="text.secondary">Lv.{m.level}</Typography>
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
