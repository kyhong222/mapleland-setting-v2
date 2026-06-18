import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import CollapsiblePanel from '../common/CollapsiblePanel'
import { useBuildStore } from '../../store/buildStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { aggregateBuild, equippedBuilts, equippedWeaponType } from '../../store/aggregate'
import { useBuffEffects } from '../../store/useBuffEffects'
import { totalAttack, totalMagic, masteryRatio, calcPhysical, calcLuckySeven } from '../../domain/attackPower'
import { WEAPON_CONSTANTS } from '../../domain/weapons'
import { JOBS } from '../../domain/jobs'

const fmtRange = (r: { min: number; max: number }) => `${r.min.toLocaleString()} ~ ${r.max.toLocaleString()}`

export default function AttackPanel() {
  const jobId = useBuildStore((s) => s.jobId)
  const baseStats = useBuildStore((s) => s.baseStats)
  const equipped = useBuildStore((s) => s.equipped)
  const invItems = useInventoryStore((s) => s.items)

  const { finalStats, effects } = aggregateBuild(baseStats, equippedBuilts(equipped, invItems), useBuffEffects())
  const job = jobId ? JOBS[jobId] : null
  const weaponType = equippedWeaponType(equipped, invItems)

  const primary = job ? finalStats[job.primaryStat] : 0
  const secondary = job ? job.secondaryStats.reduce((a, s) => a + finalStats[s], 0) : 0
  const watk = totalAttack(effects)
  const matk = totalMagic(effects, finalStats.INT)
  const mastery = masteryRatio(effects)

  const isMagic = job?.attackType === 'magical'
  const phys = !isMagic && weaponType ? calcPhysical(primary, secondary, weaponType, watk, mastery) : null
  const hasSwingStab = weaponType ? WEAPON_CONSTANTS[weaponType].constMin !== WEAPON_CONSTANTS[weaponType].constMax : false
  const lucky = weaponType === 'claw' ? calcLuckySeven(finalStats.LUK, watk) : null

  return (
    <CollapsiblePanel id="attack" title="공격력 계산">
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
        <Row label="주스탯" value={primary.toLocaleString()} />
        <Row label={isMagic ? '총 마력' : '총 공격력'} value={(isMagic ? matk : watk).toLocaleString()} />
        <Row label="숙련도" value={`${Math.round(mastery * 100)}%`} />
      </Box>

      {isMagic ? (
        <>
          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" color="text.disabled">
            ※ 마법 데미지는 스킬별 마법공격력 계수가 필요 — 공격스킬 데이터 추후.
          </Typography>
        </>
      ) : !weaponType ? (
        <>
          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" color="text.disabled">무기를 장착하세요.</Typography>
        </>
      ) : (
        phys && (
          <>
            <Divider sx={{ my: 1 }} />
            <DmgRow label="표기 데미지" range={phys.display} strong />
            {hasSwingStab && (
              <>
                <DmgRow label="베기" range={phys.swing} />
                <DmgRow label="찌르기" range={phys.stab} />
              </>
            )}
            {lucky && <DmgRow label="럭키세븐/트리플스로우" range={lucky} />}
          </>
        )
      )}
    </CollapsiblePanel>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{value}</Typography>
    </Box>
  )
}

function DmgRow({ label, range, strong = false }: { label: string; range: { min: number; max: number }; strong?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1, py: 0.25 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: strong ? 700 : 500, color: strong ? 'primary.main' : 'text.primary' }}>
        {fmtRange(range)}
      </Typography>
    </Box>
  )
}
