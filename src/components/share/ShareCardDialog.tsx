/**
 * 캡처·공유용 세팅 요약 카드.
 *
 * 레벨 · 총 스탯 · 스공(버프 반영) · 명중/회피 · 장비 목록 · 적용 버프 아이콘을 한 장에 모은다.
 * 캡처했을 때 라이트/다크 모드와 상관없이 같은 모양이 나오도록 카드 자체는 고정 배색(아이템 툴팁과 같은
 * 남색 계열)을 쓴다 — 등급색도 그 배경 기준으로 맞춰져 있다.
 */
import { useEffect, useRef, useState } from 'react'
import type { Ref } from 'react'
import { toBlob } from 'html-to-image'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useBuildStore, DEFAULT_CHARGE } from '../../store/buildStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { aggregateBuild, activeBuffEffects, activeBuffEntries, equippedBuiltMap, equippedWeaponType, missingRequiredSecondary } from '../../store/aggregate'
import { useActivation, useActiveEquippedBuilts } from '../../store/activation'
import { useBuffContext } from '../../store/useBuffEffects'
import { EQUIP_INSTANCES } from '../../store/equipInstance'
import type { EquipInstance } from '../../store/equipInstance'
import { resolveBuiltItem } from '../../domain/builtItem'
import type { BuiltItem } from '../../domain/builtItem'
import { totalAttack, totalMagic, masteryRatio, calcPhysical } from '../../domain/attackPower'
import { computeDetailStats } from '../../domain/detailStats'
import { magicAccuracy } from '../../domain/combat'
import { JOBS } from '../../domain/jobs'
import type { JobDef } from '../../domain/jobs'
import { STAT_IDS } from '../../domain/stats'
import type { StatId } from '../../domain/stats'
import { CHARGE_LABEL } from '../../domain/paladinCharge'
import { buffIconUrl, CHARGE_ICON } from '../../lib/buffIcon'

const STAT_SHORT: Record<StatId, string> = { STR: '힘', DEX: '덱', INT: '인', LUK: '럭' }
/** 카드의 장비 표시 순서 — 무기·보조무기를 맨 위에, 나머지는 기본 순서 */
const SHARE_ORDER: EquipInstance[] = ['weapon', 'secondary', ...EQUIP_INSTANCES.filter((i) => i !== 'weapon' && i !== 'secondary')]

/** 카드 고정 배색 (ItemTooltip과 같은 계열) */
const C = {
  bg: 'linear-gradient(180deg, #151a37 0%, #0a0c1c 100%)',
  border: '#39406e',
  line: 'rgba(255,255,255,0.12)',
  cell: 'rgba(255,255,255,0.05)',
  text: '#e8ebf5',
  sub: '#9aa1c4',
  dim: '#6a7098',
  accent: '#ffc53d',
  stat: '#a5f3b0',
}

/** 장비 한 줄 요약: 공격력(마법사는 마력만) · 주/부스탯 (예: "107공 7힘") */
function itemSummary(built: BuiltItem, job: JobDef): string {
  const eff = resolveBuiltItem(built).finalEffects
  const parts: string[] = []
  const push = (v: number | undefined, unit: string) => {
    if (v) parts.push(`${v}${unit}`)
  }
  if (job.attackType === 'magical') push(eff.mad, '마력')
  else push(eff.pad, '공')
  for (const s of [job.primaryStat, ...job.secondaryStats]) push(eff[s], STAT_SHORT[s])
  return parts.join(' ')
}

interface IconEntry {
  key: string
  icon?: string
  name: string
  /** 우상단 레벨 배지 (레벨 없는 버프는 생략) */
  level?: number
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ fontSize: 12, fontWeight: 700, color: C.sub, mb: 0.75, letterSpacing: 0.5 }}>
      {children}
    </Box>
  )
}

function StatCell({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <Box sx={{ bgcolor: C.cell, borderRadius: 1, py: 0.75, px: 1, textAlign: 'center', minWidth: 0 }}>
      <Box sx={{ fontSize: 11, color: color ?? C.sub, fontWeight: bold ? 700 : 400 }}>{label}</Box>
      <Box sx={{ fontSize: 16, fontWeight: 700, color: C.text, whiteSpace: 'nowrap' }}>{value}</Box>
    </Box>
  )
}

function ShareCard({ cardRef }: { cardRef: Ref<HTMLDivElement> }) {
  const jobId = useBuildStore((s) => s.jobId)
  const level = useBuildStore((s) => s.level)
  const baseStats = useBuildStore((s) => s.baseStats)
  const equipped = useBuildStore((s) => s.equipped)
  const charge = useBuildStore((s) => s.charge) ?? DEFAULT_CHARGE
  const invItems = useInventoryStore((s) => s.items)
  const activation = useActivation()
  const ctx = useBuffContext()
  const builts = useActiveEquippedBuilts()

  if (!jobId) return null
  const job = JOBS[jobId]
  const { finalStats, effects } = aggregateBuild(baseStats, builts, activeBuffEffects(ctx))
  const isMagic = job.attackType === 'magical'
  const detail = computeDetailStats(jobId, finalStats, effects)
  const secondarySet = new Set(job.secondaryStats)

  // 스공 — 공격력 패널의 '스탯 공격력'과 같은 계산 (몬스터 실질 제외). 마법사는 총 마력.
  const weaponType = equippedWeaponType(equipped, invItems)
  const atkWeapon = missingRequiredSecondary(weaponType, equipped, invItems) ? undefined : weaponType
  const primary = finalStats[job.primaryStat]
  const secondary = job.secondaryStats.reduce((a, s) => a + finalStats[s], 0)
  const phys = !isMagic && atkWeapon
    ? calcPhysical(primary, secondary, atkWeapon, totalAttack(effects), masteryRatio(effects))
    : null
  const attackLabel = isMagic ? '총 마력' : '스공'
  const attackValue = isMagic
    ? totalMagic(effects, finalStats.INT).toLocaleString()
    : phys
      ? `${phys.display.min.toLocaleString()} ~ ${phys.display.max.toLocaleString()}`
      : '—'

  // 장비 목록 (표시 순서 고정)
  const builtMap = equippedBuiltMap(equipped, invItems)
  const items = SHARE_ORDER.filter((inst) => builtMap[inst]).map((inst: EquipInstance) => ({
    inst,
    built: builtMap[inst]!,
    inactive: activation[inst] === false,
  }))

  // 적용 버프 — 실제 합산에 들어가는 항목만(무기 게이팅·선행 조건·대체 반영). 팔라딘 차지는 따로.
  const seen = new Set<string>()
  const buffIcons: IconEntry[] = []
  for (const e of activeBuffEntries(ctx)) {
    if (seen.has(e.buff.id)) continue
    seen.add(e.buff.id)
    const leveled = e.buff.type === 'skill' && e.buff.masterLevel > 1 && !e.buff.variants
    buffIcons.push({ key: e.buff.id, icon: buffIconUrl(e.buff, jobId), name: e.buff.name, level: leveled ? e.level : undefined })
  }
  if (jobId === 'paladin') {
    if (charge.mainOn) {
      buffIcons.push({ key: 'charge-main', icon: CHARGE_ICON[charge.mainElement], name: `${CHARGE_LABEL[charge.mainElement]} 차지`, level: charge.mainLevel })
    }
    if (charge.subOn && charge.mainElement !== 'lightning') {
      buffIcons.push({ key: 'charge-sub', icon: CHARGE_ICON.lightning, name: '썬더 차지', level: charge.subLevel })
    }
  }

  return (
    <Box
      ref={cardRef}
      sx={{
        width: '100%',
        maxWidth: 560,
        mx: 'auto',
        p: 2,
        color: C.text,
        background: C.bg,
        border: `2px solid ${C.border}`,
        borderRadius: 2,
        boxSizing: 'border-box',
      }}
    >
      {/* 헤더 */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, pb: 1, mb: 1.5, borderBottom: `1px solid ${C.line}` }}>
        <Box sx={{ fontSize: 20, fontWeight: 800 }}>Lv. {level}</Box>
        <Box sx={{ fontSize: 16, fontWeight: 700, color: C.accent }}>{job.label}</Box>
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ fontSize: 11, color: C.dim }}>item.mapleland.st</Box>
      </Box>

      {/* 장비 */}
      <SectionTitle>장비</SectionTitle>
      {items.length === 0 ? (
        <Box sx={{ fontSize: 12, color: C.dim, mb: 1.5 }}>착용한 장비가 없습니다.</Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, columnGap: 1.5, rowGap: 0.5, mb: 1.5 }}>
          {items.map(({ inst, built, inactive }) => {
            const { grade } = resolveBuiltItem(built)
            const upgrades = built.scrolls.length
            const summary = itemSummary(built, job)
            return (
              <Box key={inst} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, opacity: inactive ? 0.45 : 1 }}>
                <Box sx={{ width: 32, height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: C.cell, borderRadius: 0.5 }}>
                  {built.base.iconUrl && (
                    <Box component="img" src={built.base.iconUrl} alt="" sx={{ maxWidth: 30, maxHeight: 30, imageRendering: 'pixelated' }} />
                  )}
                </Box>
                <Box sx={{ minWidth: 0, lineHeight: 1.25 }}>
                  <Box sx={{ fontSize: 12.5, fontWeight: 700, color: grade.info.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {built.base.name}
                    {upgrades > 0 ? ` (+${upgrades})` : ''}
                    {inactive && <Box component="span" sx={{ color: '#ff8a80', fontWeight: 400 }}> (비활성)</Box>}
                  </Box>
                  {summary && <Box sx={{ fontSize: 11.5, color: C.stat, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary}</Box>}
                </Box>
              </Box>
            )
          })}
        </Box>
      )}

      {/* 적용 버프 */}
      <SectionTitle>적용 버프</SectionTitle>
      {buffIcons.length === 0 ? (
        <Box sx={{ fontSize: 12, color: C.dim, mb: 1.5 }}>적용된 버프가 없습니다.</Box>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
          {buffIcons.map((b) => (
            <Box
              key={b.key}
              title={b.level ? `${b.name} Lv.${b.level}` : b.name}
              sx={{ position: 'relative', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: C.cell, borderRadius: 0.5 }}
            >
              {b.icon && <Box component="img" src={b.icon} alt={b.name} sx={{ width: 32, height: 32, imageRendering: 'pixelated' }} />}
              {b.level !== undefined && (
                <Box
                  sx={{
                    position: 'absolute', top: -4, right: -4,
                    minWidth: 16, height: 16, px: '3px', boxSizing: 'border-box',
                    borderRadius: '8px', bgcolor: '#0a0c1c', border: `1px solid ${C.accent}`,
                    color: C.accent, fontSize: 10, fontWeight: 700, lineHeight: '14px', textAlign: 'center',
                  }}
                >
                  {b.level}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* 스공 · 명중 · 회피 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 0.75, mb: 0.75 }}>
        <StatCell label={attackLabel} value={attackValue} />
        <StatCell label={isMagic ? '마법명중' : '명중'} value={String(Math.floor(isMagic ? magicAccuracy(finalStats) : detail.acc))} />
        <StatCell label="회피" value={String(Math.floor(detail.eva))} />
      </Box>

      {/* 총 스탯 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.75 }}>
        {STAT_IDS.map((s) => {
          const role = s === job.primaryStat ? 'primary' : secondarySet.has(s) ? 'secondary' : null
          return (
            <StatCell
              key={s}
              label={STAT_SHORT[s]}
              value={finalStats[s].toLocaleString()}
              color={role ? C.stat : undefined}
              bold={role === 'primary'}
            />
          )
        })}
      </Box>

    </Box>
  )
}

/**
 * 카드 노드 → PNG Blob (선명도를 위해 2배 해상도).
 * 카드는 시스템 글꼴만 쓰므로 웹폰트 임베드(스타일시트 전체 순회라 느리다)는 건너뛴다.
 * 아이콘이 다 그려진 뒤에 찍어야 빈칸이 안 생겨서 이미지 디코드를 먼저 기다린다.
 */
async function renderCard(node: HTMLElement): Promise<Blob> {
  await Promise.all([...node.querySelectorAll('img')].map((img) => img.decode().catch(() => undefined)))
  const blob = await toBlob(node, { pixelRatio: 2, skipFonts: true })
  if (!blob) throw new Error('이미지 생성 실패')
  return blob
}

function downloadBlob(blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'mapleland-setting.png'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

type CopyState = 'idle' | 'busy' | 'copied' | 'saved' | 'timeout' | 'error'

const COPY_LABEL: Record<CopyState, string> = {
  idle: '캡처 복사',
  busy: '복사 중…',
  copied: '복사됨!',
  saved: '복사 미지원 — 파일로 저장됨',
  timeout: '복사 지연 — 다시 시도',
  error: '복사 실패',
}

/** 클립보드 쓰기가 이 시간 안에 안 끝나면 멈춘 것으로 보고 버튼을 풀어준다 */
const COPY_TIMEOUT_MS = 5000

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

export default function ShareCardDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null)
  /** 미리 그리는 중인 이미지 / 다 그려진 이미지 */
  const pendingRef = useRef<Promise<Blob> | null>(null)
  const readyRef = useRef<Blob | null>(null)
  const [state, setState] = useState<CopyState>('idle')

  // 클릭 시점에 그리기 시작하면 수백 ms가 걸리고, 그사이 다른 탭으로 넘어가면 크롬이
  // 포커스 없는 문서의 클립보드 쓰기를 막아 돌아올 때까지 복사가 안 된다.
  // 그래서 열리자마자 미리 그려두고, 클릭 때는 완성된 Blob을 바로 쓴다.
  // (다이얼로그가 모달이라 열려 있는 동안 카드 내용은 바뀌지 않는다)
  useEffect(() => {
    if (!open) {
      pendingRef.current = null
      readyRef.current = null
      setState('idle')
      return
    }
    const id = requestAnimationFrame(() => {
      const node = cardRef.current
      if (!node) return
      const p = renderCard(node)
      pendingRef.current = p
      p.then((b) => { if (pendingRef.current === p) readyRef.current = b }, (e) => console.error('[공유 카드] 미리 그리기 실패', e))
    })
    return () => cancelAnimationFrame(id)
  }, [open])

  const flash = (s: CopyState) => {
    setState(s)
    setTimeout(() => setState((cur) => (cur === s ? 'idle' : cur)), 2500)
  }

  /** 다 그려진 Blob이 있으면 그것, 아니면 진행 중인 렌더(실패했으면 새로 그림) */
  const getBlob = (node: HTMLElement): Promise<Blob> => {
    if (readyRef.current) return Promise.resolve(readyRef.current)
    const p = (pendingRef.current ?? Promise.reject(new Error('none'))).catch(() => renderCard(node))
    pendingRef.current = p
    p.then((b) => { readyRef.current = b }, () => undefined)
    return p
  }

  const handleSave = async () => {
    const node = cardRef.current
    if (!node) return
    try {
      downloadBlob(await getBlob(node))
    } catch (e) {
      console.error('[공유 카드] 저장 실패', e)
      flash('error')
    }
  }

  const handleCopy = async () => {
    const node = cardRef.current
    if (!node || state === 'busy') return
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
      // 클립보드 이미지 쓰기가 안 되는 환경(구형 브라우저·일부 모바일)은 파일 저장으로 대신한다
      await handleSave()
      flash('saved')
      return
    }
    setState('busy')
    // 다 그려져 있으면 Blob을 그대로 넘긴다(가장 빠르고 확실). 아직이면 Promise를 넘긴다 —
    // Safari는 클릭 직후 동기적으로 clipboard.write를 불러야 해서 기다렸다가 부를 수 없다.
    const data = readyRef.current ?? getBlob(node)
    try {
      await withTimeout(navigator.clipboard.write([new ClipboardItem({ 'image/png': data })]), COPY_TIMEOUT_MS)
      flash('copied')
    } catch (e) {
      console.error('[공유 카드] 클립보드 복사 실패', e)
      flash(e instanceof Error && e.message === 'timeout' ? 'timeout' : 'error')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogContent sx={{ p: { xs: 1, sm: 2 } }}>
        {open && <ShareCard cardRef={cardRef} />}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
          [캡처 복사]를 누르면 카드 이미지가 클립보드에 복사됩니다. 복사가 안 되면 [이미지 저장]을 이용하세요.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          onClick={handleCopy}
          disabled={state === 'busy'}
          color={state === 'error' || state === 'timeout' ? 'error' : state === 'copied' ? 'success' : 'primary'}
        >
          {COPY_LABEL[state]}
        </Button>
        <Button variant="outlined" onClick={handleSave}>이미지 저장</Button>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  )
}
