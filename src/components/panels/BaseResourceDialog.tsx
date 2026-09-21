import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Button from '@mui/material/Button'
import ItemIcon from '../common/ItemIcon'
import { useBuildStore } from '../../store/buildStore'
import { useBuffContext, useBuffEffects } from '../../store/useBuffEffects'
import { useActiveEquippedBuilts } from '../../store/activation'
import { aggregateBuild, resourceSources } from '../../store/aggregate'
import type { ResourceSource } from '../../store/aggregate'
import { resourceParts, resourceEffectIds, baseFromShown, resourceTotal } from '../../domain/resource'
import type { ResourceKind } from '../../domain/resource'
import { EFFECTS } from '../../domain/effects'
import type { EffectId } from '../../domain/effects'
import { buffIconUrl } from '../../lib/buffIcon'

export const RESOURCE_LABEL: Record<ResourceKind, string> = { hp: 'HP', mp: 'MP' }

/** "+60" / "+10%" — percent 단위만 뒤에 % */
function contribText(id: EffectId, value: number): string {
  return `+${value}${EFFECTS[id].unit === 'percent' ? '%' : ''}`
}

/** 기여 요소 아이콘 하나 (아래에 기여분, 툴팁에 이름) */
function SourceIcon({ source, ids }: { source: ResourceSource; ids: EffectId[] }) {
  const jobId = useBuildStore((s) => s.jobId)
  const text = ids
    .filter((id) => source.effects[id])
    .map((id) => contribText(id, source.effects[id] as number))
    .join(' ')
  const url = source.buff ? buffIconUrl(source.buff, jobId) : source.iconUrl
  return (
    <Tooltip title={`${source.name} ${text}`} arrow enterDelay={200}>
      <Box sx={{ width: 46, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
        <Box sx={{ bgcolor: 'action.hover', borderRadius: 0.5, p: 0.25, display: 'flex' }}>
          <ItemIcon src={url} alt={source.name} size={32} />
        </Box>
        <Typography variant="caption" sx={{ fontSize: 11, lineHeight: 1.1, color: 'success.main', whiteSpace: 'nowrap' }}>
          {text}
        </Typography>
      </Box>
    </Tooltip>
  )
}

/**
 * 기본(맨몸) HP 또는 MP 입력 다이얼로그. HP/MP는 서로 다른 값을 재서 넣는 일이라
 * 한 화면에 묶지 않고 각 행의 편집 버튼이 자기 것만 연다.
 *
 * 맨몸 값은 레벨업 증가량이 랜덤 + AP 투자 + HP증가 패시브라 레벨/직업만으로 유도할 수
 * 없다. 그렇다고 "다 벗고 재서 넣어라"는 번거로우므로, **지금 착용·적용한 그대로**의
 * 인게임 표시값을 받아 현재 반영분(고정·증가율)을 걷어내고 기본값만 남긴다
 * (domain/resource.baseFromShown).
 *
 * 그래서 "지금 무엇이 반영된 상태인지"가 눈에 보여야 한다 — 장착 장비(보석·주문서 포함)와
 * 활성 버프 중 이 값에 기여하는 것을 전부 아이콘으로 나열하고, **기준이 되는 현재 레벨**도
 * 함께 보여준다. 저장값은 이 레벨과 짝이라 레벨이 바뀌면 다시 받아야 하기 때문이다
 * (domain/resource.ts 참고). 다시 넣으면 레벨까지 통째로 덮어쓴다.
 */
export default function BaseResourceDialog({ kind, onClose }: { kind: ResourceKind; onClose: () => void }) {
  const baseStats = useBuildStore((s) => s.baseStats)
  const level = useBuildStore((s) => s.level)
  const stored = useBuildStore((s) => (kind === 'hp' ? s.baseHp : s.baseMp))
  const storedLevel = useBuildStore((s) => (kind === 'hp' ? s.baseHpLevel : s.baseMpLevel))
  const setBaseResources = useBuildStore((s) => s.setBaseResources)
  const builts = useActiveEquippedBuilts()
  const ctx = useBuffContext()
  const { effects } = aggregateBuild(baseStats, builts, useBuffEffects())

  const label = RESOURCE_LABEL[kind]
  const parts = resourceParts(kind, effects, { value: stored, level: storedLevel }, level)
  const ids = resourceEffectIds(kind)
  const related = resourceSources(builts, ctx).filter((s) => ids.some((id) => s.effects[id]))

  // 이미 입력돼 있으면 현재 최종값을 채워 둔다 — 인게임 값과 바로 대조할 수 있게.
  // 레벨이 어긋난 보관값(staleLevel)은 지금 레벨에서 틀린 값이라 채우지 않는다.
  const [draft, setDraft] = useState(parts.total === null ? '' : String(parts.total))

  const n = Number(draft)
  const valid = draft.trim() !== '' && Number.isFinite(n) && n > 0
  const base = valid ? baseFromShown(n, parts.flat, parts.percent) : null
  // 역산값을 다시 씌워도 입력값이 안 나오면 도달할 수 없는 표시값이다(오타 등)
  const roundTrip = base === null ? null : resourceTotal(base, parts.flat, parts.percent)

  const save = (value: number | null) => {
    setBaseResources(kind === 'hp' ? { hp: value } : { mp: value })
    onClose()
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>기본 {label} 설정</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          맨몸 {label}는 레벨업 증가량이 랜덤이라 계산으로 알아낼 수 없습니다.
          <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}> 지금 착용·적용한 그대로</Box>의
          인게임 스탯창 값을 넣으면, 아래 요소들을 걷어내고 기본값을 역산해
          <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}> 현재 레벨과 함께</Box> 저장합니다.
        </Typography>

        {parts.staleLevel !== null && (
          <Typography variant="body2" color="warning.main" sx={{ mb: 1.5 }}>
            기록된 {label}정보와 레벨이 달라 재입력이 필요합니다. 레벨이 기록 시점으로 돌아가면 복원됩니다.
            <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
              기록된 정보: Lv. {parts.staleLevel} {label} {stored}
            </Box>
          </Typography>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          기준 레벨 <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>Lv.{level}</Box>
          {' · '}현재 반영분 — 고정 +{parts.flat} · 증가 +{parts.percent}%
        </Typography>

        {related.length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
            {related.map((s) => (
              <SourceIcon key={s.key} source={s} ids={ids} />
            ))}
          </Box>
        ) : (
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1.5 }}>
            {label}에 영향을 주는 장비·버프가 없습니다 — 인게임 값이 곧 기본값입니다.
          </Typography>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            size="small"
            type="number"
            autoFocus
            label={`인게임 ${label}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            sx={{ width: 150 }}
          />
          <Typography variant="body2" color={base === null ? 'text.disabled' : 'text.secondary'}>
            {base === null ? `기본 ${label} —` : `기본 ${label} ${base.toLocaleString()}`}
          </Typography>
        </Box>
        {roundTrip !== null && roundTrip !== n && (
          <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
            이 세팅에서는 {n.toLocaleString()}이 나올 수 없습니다 (가장 가까운 값 {roundTrip.toLocaleString()}). 입력값을 확인해 주세요.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => save(null)} color="inherit">지우기</Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} color="inherit">취소</Button>
        {/* 빈 칸으로 적용하면 보관값이 조용히 날아간다 — 지우는 건 '지우기'의 몫이다.
            레벨이 어긋나 칸이 비어 있는 상태에서 특히 중요하다(되돌아가면 살아날 값이므로). */}
        <Button onClick={() => save(base)} variant="contained" disabled={base === null}>적용</Button>
      </DialogActions>
    </Dialog>
  )
}
