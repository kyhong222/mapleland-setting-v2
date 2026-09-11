import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CollapsiblePanel from '../common/CollapsiblePanel'
import EditBadge from '../common/EditBadge'
import ActionHint from '../common/ActionHint'
import { useBuildStore } from '../../store/buildStore'
import { aggregateBuild } from '../../store/aggregate'
import { useActiveEquippedBuilts } from '../../store/activation'
import { useBuffEffects } from '../../store/useBuffEffects'
import InfoTip, { InfoTitle, Formula, InfoWarn } from '../common/InfoTip'
import { computeDetailStats, accStatCoef, evaStatCoef } from '../../domain/detailStats'
import { computeResources } from '../../domain/resource'
import type { ResourceKind, ResourceParts } from '../../domain/resource'
import { magicAccuracy } from '../../domain/combat'
import { JOBS } from '../../domain/jobs'
import BaseResourceDialog, { RESOURCE_LABEL } from './BaseResourceDialog'
import type { ReactNode } from 'react'

/** 정수면 그대로, 소수면 1자리로 표기 */
const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1))

const MACC_HELP = (
  <>
    <InfoTitle>마법명중률</InfoTitle>
    <Formula>⌊총 INT ÷ 10⌋ + ⌊총 LUK ÷ 10⌋</Formula>
  </>
)

const RESOURCE_HELP = (
  <>
    <InfoTitle>HP / MP</InfoTitle>
    <Formula>⌊(기본 + 고정) × (1 + 증가율%)⌋</Formula>
    <Box>고정분(장비·칭호 등)은 증가율 안쪽에서 더해지고, 증가율(정령의 축복·카오스 자쿰의 투구·하이퍼 바디)은 서로 곱하지 않고 더해집니다.</Box>
    <InfoWarn>기본(맨몸) 값은 레벨업 증가량이 랜덤이라 계산으로 알 수 없습니다. 편집 버튼으로 인게임 표시값을 넣으면 역산해 저장합니다.</InfoWarn>
  </>
)

/** 편집(연필) 배지 — 행 호버로 꺼낸다 (터치 기기는 항상 노출) */
function EditBadgeButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Box
      className="edit-badge"
      role="button"
      aria-label={`기본 ${label} 설정`}
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        ml: 0.5,
        cursor: 'pointer',
        transition: 'opacity 120ms',
        // 호버가 되는 기기에서만 숨겼다가 행 호버로 꺼낸다. 터치 기기는 꺼낼 방법이 없어 항상 보인다.
        '@media (hover: hover)': { opacity: 0, pointerEvents: 'none' },
      }}
    >
      <EditBadge size={16} />
    </Box>
  )
}

/**
 * 행 이름. 기본값을 넣기 전에는 최종 HP가 아니라 장비·버프가 얹어 주는 몫만 보여주므로,
 * 그 상태에서는 이름도 '추가HP'로 바꿔 표시값과 어긋나지 않게 한다.
 */
function resourceLabel(kind: ResourceKind, parts: ResourceParts): string {
  const label = RESOURCE_LABEL[kind]
  return parts.total === null ? `추가${label}` : label
}

/**
 * HP/MP 표시값.
 * 기본값을 넣기 전에는 최종값을 알 수 없으므로, 대신 지금 반영 중인 몫("+205 +20%")을
 * 흐리게 보여준다 — 뭘 더 해야 숫자가 나오는지가 그대로 드러나게. 얹히는 몫이 없으면 0.
 */
function ResourceValue({ parts }: { parts: ResourceParts }) {
  if (parts.total !== null) {
    return <Typography variant="body2" sx={{ fontWeight: 600 }}>{parts.total.toLocaleString()}</Typography>
  }
  const bits: string[] = []
  if (parts.flat) bits.push(`+${parts.flat}`)
  if (parts.percent) bits.push(`+${parts.percent}%`)
  return (
    <Typography variant="body2" color="text.disabled" sx={{ fontWeight: 600 }}>
      {bits.length > 0 ? bits.join(' ') : '0'}
    </Typography>
  )
}

export default function DetailStatPanel() {
  const jobId = useBuildStore((s) => s.jobId)
  const baseStats = useBuildStore((s) => s.baseStats)
  const baseHp = useBuildStore((s) => s.baseHp)
  const baseMp = useBuildStore((s) => s.baseMp)
  const { finalStats, effects } = aggregateBuild(baseStats, useActiveEquippedBuilts(), useBuffEffects())
  // HP/MP는 각각 따로 재서 넣는 값이라 편집 다이얼로그도 행별로 연다
  const [editKind, setEditKind] = useState<ResourceKind | null>(null)

  if (!jobId) {
    return <CollapsiblePanel id="detail" title="세부스탯" />
  }

  const detail = computeDetailStats(jobId, finalStats, effects)
  const resources = computeResources(effects, { hp: baseHp, mp: baseMp })
  const isMagician = JOBS[jobId].attackType === 'magical'
  const ac = accStatCoef(jobId)
  const ev = evaStatCoef(jobId)

  // 마법사는 명중률 자리를 마법명중률(floor(INT/10)+floor(LUK/10))로 대체.
  // 행 순서는 고정이므로 렌더 key는 인덱스로 잡는다 — 라벨은 상태에 따라 바뀌어(HP/추가HP)
  // key로 쓰면 두 행이 같은 값이 되는 순간 한 행이 통째로 사라진다.
  const rows: { label: string; value: ReactNode; help?: ReactNode; onEdit?: () => void }[] = [
    { label: resourceLabel('hp', resources.hp), value: <ResourceValue parts={resources.hp} />, help: RESOURCE_HELP, onEdit: () => setEditKind('hp') },
    { label: resourceLabel('mp', resources.mp), value: <ResourceValue parts={resources.mp} />, help: RESOURCE_HELP, onEdit: () => setEditKind('mp') },
    isMagician
      ? { label: '마법명중률', value: fmt(magicAccuracy(finalStats)), help: MACC_HELP }
      : {
          label: '명중률',
          value: fmt(detail.acc),
          help: (
            <>
              <InfoTitle>명중률</InfoTitle>
              <Formula>DEX × {ac.dex} + LUK × {ac.luk} + 장비·버프 명중</Formula>
              <Box>계수는 직업군별로 다릅니다.</Box>
            </>
          ),
        },
    {
      label: '회피율',
      value: fmt(detail.eva),
      help: (
        <>
          <InfoTitle>회피율</InfoTitle>
          <Formula>DEX × {ev.dex} + LUK × {ev.luk} + 장비·버프 회피</Formula>
          <Box>계수는 직업군별로 다릅니다.</Box>
        </>
      ),
    },
    { label: '물리방어력', value: fmt(detail.pdef) },
    {
      label: '마법방어력',
      value: fmt(detail.mdef),
      help: (
        <>
          <InfoTitle>마법방어력</InfoTitle>
          <Formula>장비·버프 마방 + 총 INT</Formula>
          <Box>INT 1당 마법방어력 +1.</Box>
        </>
      ),
    },
    { label: '이동속도', value: fmt(detail.speed) },
    { label: '점프력', value: fmt(detail.jump) },
  ]

  return (
    <CollapsiblePanel id="detail" title="세부스탯">
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
        {rows.map(({ label, value, help, onEdit }, i) => (
          <Box
            key={i}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              px: 1,
              '@media (hover: hover)': { '&:hover .edit-badge': { opacity: 1, pointerEvents: 'auto' } },
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
              {label}
              {help && <InfoTip title={help} />}
              {/* 편집 배지는 라벨 쪽에 둔다 — 값 뒤에 두면 숨어 있을 때도 자리를 차지해
                  HP/MP 숫자만 다른 행보다 왼쪽으로 밀린다. */}
              {onEdit && <EditBadgeButton label={label} onClick={onEdit} />}
            </Typography>
            {typeof value === 'string' ? <Typography variant="body2" sx={{ fontWeight: 600 }}>{value}</Typography> : value}
          </Box>
        ))}
      </Box>
      <ActionHint
        sx={{ mt: 1 }}
        actions={[{ key: <EditBadge size={15} sx={{ verticalAlign: 'text-bottom' }} />, desc: 'HP·MP 행의 이 버튼으로 기본(맨몸) 값을 각각 입력합니다', tone: 'secondary' }]}
      />
      {editKind && <BaseResourceDialog kind={editKind} onClose={() => setEditKind(null)} />}
    </CollapsiblePanel>
  )
}
