import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CollapsiblePanel from '../common/CollapsiblePanel'
import MonsterIcon from '../monster/MonsterIcon'
import MonsterSelectDialog from '../monster/MonsterSelectDialog'
import { useMonsterStore } from '../../store/monsterStore'
import { useBuildStore } from '../../store/buildStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { aggregateBuild, equippedBuilts } from '../../store/aggregate'
import { useBuffEffects } from '../../store/useBuffEffects'
import { getMonster } from '../../data/mobs'
import { monsterLabel, parseElemAttr } from '../../domain/monster'
import type { Monster } from '../../domain/monster'
import { computeVsMonster } from '../../domain/combat'
import type { VsMonsterResult } from '../../domain/combat'

/** 속성 효과별 칩 색상 (공격자 관점: 약점=이득, 무효=불리) */
const ELEM_COLOR: Record<'무효' | '반감' | '약점', 'error' | 'warning' | 'success'> = {
  무효: 'error',
  반감: 'warning',
  약점: 'success',
}

function StatLine({ label, value }: { label: string; value: number | string | undefined }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="caption" sx={{ fontWeight: 600 }}>{value ?? '—'}</Typography>
    </Box>
  )
}

/** 몬스터 기본 정보 카드 */
function MonsterInfo({ m }: { m: Monster }) {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
        <MonsterIcon id={m.id} size={48} />
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{monsterLabel(m)}</Typography>
            {m.isBoss && <Chip label="보스" size="small" color="error" sx={{ height: 16, fontSize: 10 }} />}
          </Box>
          <Typography variant="caption" color="text.secondary">Lv.{m.level}</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.75 }}>
        {parseElemAttr(m.elemAttr).length === 0 ? (
          <Chip label="무속성" size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
        ) : (
          parseElemAttr(m.elemAttr).map((e) => (
            <Chip key={e.code} label={`${e.element} ${e.effect}`} size="small" color={ELEM_COLOR[e.effect]} variant="outlined" sx={{ height: 18, fontSize: 10 }} />
          ))
        )}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.25 }}>
        <StatLine label="HP" value={m.maxHP?.toLocaleString()} />
        <StatLine label="EXP" value={m.exp?.toLocaleString()} />
        <StatLine label="물리방어" value={m.PDDamage} />
        <StatLine label="마법방어" value={m.MDDamage} />
        <StatLine label="몬스터 명중" value={m.acc} />
        <StatLine label="몬스터 회피" value={m.eva} />
        <StatLine label="물리공격" value={m.PADamage} />
        <StatLine label="마법공격" value={m.MADamage} />
      </Box>
    </Box>
  )
}

const pct = (n: number): string => `${n.toFixed(1)}%`

/** vs 몬스터 성능 — 필요 명중률 · 명중확률 · 물리/마법 회피확률 */
function VsPerformance({ result }: { result: VsMonsterResult | null }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>vs 몬스터 성능</Typography>
      {result ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', rowGap: 0.25 }}>
          <StatLine label="필요 명중률" value={result.requiredAcc === Infinity ? '불가' : result.requiredAcc} />
          <StatLine label={result.isMagician ? '마법 명중확률' : '명중확률'} value={pct(result.hitRate)} />
          <StatLine label="물리회피확률" value={pct(result.physEvade)} />
          <StatLine label="마법회피확률" value={pct(result.magicEvade)} />
        </Box>
      ) : (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
          직업을 선택하면 표시됩니다.
        </Typography>
      )}
    </Box>
  )
}

export default function MonsterPanel() {
  const selectedId = useMonsterStore((s) => s.selectedId)
  const jobId = useBuildStore((s) => s.jobId)
  const level = useBuildStore((s) => s.level)
  const baseStats = useBuildStore((s) => s.baseStats)
  const equipped = useBuildStore((s) => s.equipped)
  const invItems = useInventoryStore((s) => s.items)
  const buffEffects = useBuffEffects()
  const [open, setOpen] = useState(false)

  const selected = selectedId != null ? getMonster(selectedId) : undefined

  let vsResult: VsMonsterResult | null = null
  if (jobId && selected) {
    const { finalStats, effects } = aggregateBuild(baseStats, equippedBuilts(equipped, invItems), buffEffects)
    vsResult = computeVsMonster(jobId, level, finalStats, effects, selected)
  }

  return (
    <CollapsiblePanel
      id="monster"
      title="몬스터"
      headerAction={
        <Button size="small" variant="outlined" onClick={() => setOpen(true)} sx={{ py: 0, minWidth: 0, px: 1 }}>
          {selected ? '변경' : '선택'}
        </Button>
      }
    >
      {selected ? (
        <>
          <MonsterInfo m={selected} />
          <Divider sx={{ my: 1 }} />
          <VsPerformance result={vsResult} />
        </>
      ) : (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.disabled" sx={{ mb: 1 }}>대상 몬스터를 선택하세요</Typography>
          <Button variant="contained" size="small" onClick={() => setOpen(true)}>몬스터 선택</Button>
        </Box>
      )}

      <MonsterSelectDialog open={open} onClose={() => setOpen(false)} />
    </CollapsiblePanel>
  )
}
