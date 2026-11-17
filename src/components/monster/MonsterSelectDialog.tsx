import { memo, useCallback, useMemo, useRef, useState } from 'react'
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
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Tooltip from '@mui/material/Tooltip'
import ListSubheader from '@mui/material/ListSubheader'
import Divider from '@mui/material/Divider'
import { inkOnDark } from '../../theme'
import MonsterIcon from './MonsterIcon'
import { useMonsterStore } from '../../store/monsterStore'
import { useBuildStore } from '../../store/buildStore'
import { useUiStore } from '../../store/uiStore'
import { MONSTERS, LEVEL_RANGE } from '../../data/mobs'
import { REGION_CATEGORIES, REGION_ICON } from '../../data/mobs/regionCategory'
import { monsterLabel, parseElemAttr, monsterPatterns } from '../../domain/monster'

/** 속성별 색상 (불=빨강·얼음=파랑·번개=노랑·독=초록·성=주황) */
const ELEM_HEX: Record<string, string> = { F: '#e53935', I: '#1e88e5', L: '#fbc02d', S: '#43a047', H: '#fb8c00' }
/** 언데드 칩 색상 (회색) */
const UNDEAD_HEX = '#757575'
/** 특수 패턴 종류별 배지 색 */
const PATTERN_COLOR: Record<string, string> = {
  oneone: '#d32f2f', status: '#7b1fa2', immune: '#455a64', reflect: '#c2185b', summon: '#1565c0', heal: '#2e7d32',
}
/** 필터용 속성/반응 목록 */
const ELEMS: { code: string; name: string }[] = [
  { code: 'F', name: '불' }, { code: 'I', name: '얼음' }, { code: 'L', name: '번개' }, { code: 'S', name: '독' }, { code: 'H', name: '성' },
]
const REACTIONS: { label: string; effect: '약점' | '반감' | '무효' }[] = [
  { label: '약점', effect: '약점' }, { label: '반감', effect: '반감' }, { label: '면역', effect: '무효' },
]
/** 패턴 필터 그룹 (라벨은 monsterPatterns 라벨과 일치) */
const PATTERN_GROUPS: { title: string; items: { label: string; color: string }[] }[] = [
  { title: '특수', items: [
    { label: '1/1', color: '#d32f2f' }, { label: '물리무효', color: '#455a64' }, { label: '마법무효', color: '#455a64' },
    { label: '물리반사', color: '#c2185b' }, { label: '마법반사', color: '#c2185b' }, { label: '소환', color: '#1565c0' },
  ] },
  { title: '디버프', items: ['봉인', '암흑', '허약', '저주', '중독', '스턴', '슬로우', '유혹', '키반전', '버프해제', '언데드화'].map((label) => ({ label, color: '#7b1fa2' })) },
]
const LEVEL_RANGE_HELP = '레범몬: 현재 레벨 ±10 이내 (캐릭터 80레벨 이상이면 70레벨 이상 전부)'
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

/** 지역 드롭다운 값이 아직 유효한지 (지역 개편으로 사라진 즐겨찾기는 조용히 숨긴다) */
function validRegionKey(key: string): boolean {
  if (key.startsWith('c:')) return key.slice(2) in CATEGORY_REGIONS
  if (key.startsWith('r:')) return REGION_CATEGORIES.some((c) => c.regions.some((r) => r.name === key.slice(2)))
  return false
}

/**
 * 즐겨찾기 별 버튼. 카드/메뉴 항목 안에 들어가므로 클릭이 바깥 선택으로 번지지 않게 막는다.
 * (Select의 MenuItem은 click으로 선택되므로 mousedown·click 둘 다 멈춘다)
 * 안내는 MUI Tooltip이 아니라 title 속성 — 카드마다 하나씩(수백 개) 붙어 렌더가 무거워져서 바꿨다.
 */
function FavStar({ on, onToggle, size = 18 }: { on: boolean; onToggle: () => void; size?: number }) {
  const label = on ? '즐겨찾기 해제' : '즐겨찾기'
  return (
    <Box
      component="button"
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={on}
      onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        onToggle()
      }}
      sx={{
        border: 0,
        bgcolor: 'transparent',
        cursor: 'pointer',
        p: 0.25,
        lineHeight: 1,
        fontSize: size,
        color: on ? '#f9a825' : 'text.disabled',
        flexShrink: 0,
        '&:hover': { color: '#f9a825' },
      }}
    >
      {on ? '★' : '☆'}
    </Box>
  )
}

/**
 * 몬스터 카드 — memo로 감싸 즐겨찾기·선택이 바뀐 카드만 다시 그린다.
 * 목록이 수백 장이라 카드를 인라인으로 두면 ☆ 한 번에 전부 다시 그려 눈에 띄게 느려졌다.
 * onPick·onToggleFav는 부모에서 안정된 참조로 넘겨야 memo가 듣는다.
 */
const MonsterCard = memo(function MonsterCard({ m, active, fav, onPick, onToggleFav }: {
  m: (typeof MONSTERS)[number]
  active: boolean
  fav: boolean
  onPick: (id: number) => void
  onToggleFav: (id: number) => void
}) {
  return (
    <Box
      onClick={() => onPick(m.id)}
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
          if (els.length === 0 && !m.undead) return null
          return (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25, mt: 0.25 }}>
              {m.undead && (
                <Chip label="언데드" size="small" sx={{ height: 18, fontSize: 10, bgcolor: UNDEAD_HEX, color: '#fff' }} />
              )}
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
        {monsterPatterns(m).length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25, mt: 0.25 }}>
            {monsterPatterns(m).map((p) => {
              const c = PATTERN_COLOR[p.kind]
              const outlined = p.kind === 'status' && !p.cure // 만병통치약 불가 = outlined
              return (
                <Chip key={p.label} label={p.label} size="small" variant={outlined ? 'outlined' : 'filled'}
                  sx={[{ height: 18, fontSize: 10, borderColor: c, bgcolor: outlined ? 'transparent' : c, color: outlined ? c : '#fff' }, outlined && inkOnDark(c)]} />
              )
            })}
          </Box>
        )}
      </Box>
      {m.isBoss && <Chip label="보스" size="small" color="error" variant="outlined" sx={{ height: 20, fontSize: 11 }} />}
      <FavStar on={fav} onToggle={() => onToggleFav(m.id)} size={22} />
    </Box>
  )
})

/** 몬스터 검색/필터/선택 모달 */
export default function MonsterSelectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const selectedId = useMonsterStore((s) => s.selectedId)
  const select = useMonsterStore((s) => s.select)

  const [sel, setSel] = useState<string>(ALL_REGION)
  const [query, setQuery] = useState('')
  const [minLv, setMinLv] = useState('')
  const [maxLv, setMaxLv] = useState('')
  const [bossOnly, setBossOnly] = useState(false)
  const [reactFilters, setReactFilters] = useState<Set<string>>(new Set()) // 'F:약점' 등
  const [patternFilters, setPatternFilters] = useState<Set<string>>(new Set()) // '봉인' 등 패턴 라벨
  const [undeadOnly, setUndeadOnly] = useState(false)
  const [levelRangeOnly, setLevelRangeOnly] = useState(false)
  const charLevel = useBuildStore((s) => s.level)
  const favMonsters = useUiStore((s) => s.favoriteMonsters)
  const favRegions = useUiStore((s) => s.favoriteRegions)
  const toggleFavMonster = useUiStore((s) => s.toggleFavoriteMonster)
  const toggleFavRegion = useUiStore((s) => s.toggleFavoriteRegion)
  const favMonsterSet = useMemo(() => new Set(favMonsters), [favMonsters])
  const favRegionSet = useMemo(() => new Set(favRegions), [favRegions])
  const shownFavRegions = useMemo(() => favRegions.filter(validRegionKey), [favRegions])

  const toggleSet = (set: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
    set((p) => {
      const n = new Set(p)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  const toggleReact = (key: string) => toggleSet(setReactFilters, key)
  const togglePattern = (key: string) => toggleSet(setPatternFilters, key)

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
      if (undeadOnly && !m.undead) return false
      // 레범몬: 80레벨 이상이면 70레벨↑ 전부, 아니면 현재±10
      if (levelRangeOnly && !(charLevel >= 80 ? m.level >= 70 : Math.abs(m.level - charLevel) <= 10)) return false
      // 속성 반응 필터 (AND)
      if (reactFilters.size > 0) {
        const els = parseElemAttr(m.elemAttr)
        for (const key of reactFilters) {
          const [code, effect] = key.split(':')
          if (!els.some((e) => e.code === code && e.effect === effect)) return false
        }
      }
      // 특수 패턴/상태이상 필터 (AND)
      if (patternFilters.size > 0) {
        const labels = new Set(monsterPatterns(m).map((p) => p.label))
        for (const pl of patternFilters) if (!labels.has(pl)) return false
      }
      if (m.level < lo || m.level > hi) return false
      if (q) {
        const hay = `${m.koreanName ?? ''} ${m.name}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    }).sort((a, b) => a.id - b.id)
  }, [sel, query, minLv, maxLv, bossOnly, reactFilters, patternFilters, undeadOnly, levelRangeOnly, charLevel])

  /**
   * 목록 줄 — 조건에 맞는 즐겨찾기 몬스터를 맨 위에 모으고, 그 아래에 나머지.
   * 즐겨찾기가 하나라도 걸리면 두 묶음 사이에 머리글('★ 즐겨찾기' / '전체')을 넣는다.
   */
  type ListRow = { kind: 'header'; label: string } | { kind: 'mob'; m: (typeof filtered)[number] }
  const rows = useMemo<ListRow[]>(() => {
    const favs = filtered.filter((m) => favMonsterSet.has(m.id))
    if (favs.length === 0) return filtered.map((m) => ({ kind: 'mob' as const, m }))
    const rest = filtered.filter((m) => !favMonsterSet.has(m.id))
    return [
      { kind: 'header' as const, label: `★ 즐겨찾기 ${favs.length}` },
      ...favs.map((m) => ({ kind: 'mob' as const, m })),
      ...(rest.length > 0 ? [{ kind: 'header' as const, label: `전체 ${rest.length}` }] : []),
      ...rest.map((m) => ({ kind: 'mob' as const, m })),
    ]
  }, [filtered, favMonsterSet])

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const pick = useCallback(
    (id: number) => {
      select(id)
      onCloseRef.current()
    },
    [select],
  )

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
              {/* 즐겨찾기 지역 — 최상단에 모은다(아래 원래 자리에서는 빠진다). 즐겨찾기한 순서대로 */}
              {shownFavRegions.length > 0 && (
                <ListSubheader sx={{ lineHeight: '32px', fontSize: 12 }}>★ 즐겨찾기</ListSubheader>
              )}
              {shownFavRegions.map((key) => {
                const icon = key.startsWith('r:') ? REGION_ICON[key.slice(2)] : undefined
                return (
                  <MenuItem key={`fav-${key}`} value={key} sx={{ fontSize: icon ? 14 : 16, fontWeight: icon ? 400 : 700, py: icon ? 0.75 : 1, gap: 1 }}>
                    {icon && <Box component="img" src={icon} alt="" sx={{ width: 30, height: 30, imageRendering: 'pixelated' }} />}
                    <Box sx={{ flex: 1 }}>{key.slice(2)}</Box>
                    <FavStar on onToggle={() => toggleFavRegion(key)} />
                  </MenuItem>
                )
              })}
              {shownFavRegions.length > 0 && <Divider />}
              <MenuItem value={ALL_REGION} sx={{ fontSize: 16, fontWeight: 700, py: 1 }}>전체 지역</MenuItem>
              {REGION_CATEGORIES.flatMap((c) => [
                // 상위 카테고리(아이콘 없이, 살짝 크게) — 선택 시 카테고리 전체
                ...(favRegionSet.has(`c:${c.name}`)
                  ? []
                  : [
                      <MenuItem key={`c:${c.name}`} value={`c:${c.name}`} sx={{ fontSize: 16, fontWeight: 700, py: 1, mt: 0.25, gap: 1 }}>
                        <Box sx={{ flex: 1 }}>{c.name}</Box>
                        <FavStar on={false} onToggle={() => toggleFavRegion(`c:${c.name}`)} />
                      </MenuItem>,
                    ]),
                // 하위 지역(들여쓰기 + 맵 아이콘)
                ...c.regions
                  .filter((r) => !favRegionSet.has(`r:${r.name}`))
                  .map((r) => (
                    <MenuItem key={`r:${r.name}`} value={`r:${r.name}`} sx={{ fontSize: 14, pl: 2.5, py: 0.75, gap: 1, color: 'text.secondary' }}>
                      <Box component="img" src={r.icon} alt="" sx={{ width: 30, height: 30, imageRendering: 'pixelated' }} />
                      <Box sx={{ flex: 1 }}>{r.name}</Box>
                      <FavStar on={false} onToggle={() => toggleFavRegion(`r:${r.name}`)} />
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
          {/* 속성 약점/반감/면역 · 언데드 · 레범몬 필터 (AND) */}
          <Box sx={{ pt: 0.5, pl: 0.5, display: 'flex', flexDirection: 'column', rowGap: 1 }}>
                {REACTIONS.map(({ label, effect }) => (
                  <Box key={effect} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ width: 40, flexShrink: 0, fontWeight: 600 }}>{label}</Typography>
                    {ELEMS.map(({ code, name }) => (
                      <FormControlLabel
                        key={code}
                        sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontSize: 13 } }}
                        control={<Checkbox size="small" sx={{ p: 0.5, color: ELEM_HEX[code], '&.Mui-checked': { color: ELEM_HEX[code] } }} checked={reactFilters.has(`${code}:${effect}`)} onChange={() => toggleReact(`${code}:${effect}`)} />}
                        label={name}
                      />
                    ))}
                  </Box>
                ))}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5, flexWrap: 'wrap' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ width: 40, flexShrink: 0, fontWeight: 600 }}>기타</Typography>
                  <FormControlLabel
                    sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontSize: 13 } }}
                    control={<Checkbox size="small" sx={{ p: 0.5 }} checked={undeadOnly} onChange={() => setUndeadOnly((v) => !v)} />}
                    label="언데드"
                  />
                  <Tooltip title={LEVEL_RANGE_HELP} placement="top" arrow>
                    <FormControlLabel
                      sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontSize: 13 } }}
                      control={<Checkbox size="small" sx={{ p: 0.5 }} checked={levelRangeOnly} onChange={() => setLevelRangeOnly((v) => !v)} />}
                      label="레범몬"
                    />
                  </Tooltip>
                </Box>
                {PATTERN_GROUPS.map((g) => (
                  <Box key={g.title} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ width: 40, flexShrink: 0, fontWeight: 600 }}>{g.title}</Typography>
                    {g.items.map(({ label, color }) => (
                      <FormControlLabel
                        key={label}
                        sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontSize: 13 } }}
                        control={<Checkbox size="small" sx={[{ p: 0.5, color, '&.Mui-checked': { color } }, inkOnDark(color, '&.Mui-checked')]} checked={patternFilters.has(label)} onChange={() => togglePattern(label)} />}
                        label={label}
                      />
                    ))}
                  </Box>
                ))}
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
            rows.map((row) => {
              if (row.kind === 'header') {
                return (
                  <Typography
                    key={`hdr-${row.label}`}
                    variant="caption"
                    sx={{ gridColumn: '1 / -1', fontWeight: 700, color: row.label.startsWith('★') ? '#f9a825' : 'text.secondary', pt: 0.5 }}
                  >
                    {row.label}
                  </Typography>
                )
              }
              const m = row.m
              return (
                <MonsterCard
                  key={m.id}
                  m={m}
                  active={m.id === selectedId}
                  fav={favMonsterSet.has(m.id)}
                  onPick={pick}
                  onToggleFav={toggleFavMonster}
                />
              )
            })
          )}
        </Box>
      </DialogContent>
    </Dialog>
  )
}
