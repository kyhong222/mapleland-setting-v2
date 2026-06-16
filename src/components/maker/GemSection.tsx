import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import type { SlotId } from '../../domain/equipSlots'
import {
  GEM_GRADES,
  GEM_GRADE_LABELS,
  gemCapacity,
  gemsForSlot,
  gemEffect,
  gemIconUrl,
} from '../../domain/maker'
import type { GemSelection } from '../../domain/maker'
import { formatEffects } from '../../lib/effectFormat'
import ItemIcon from '../common/ItemIcon'

interface Props {
  slot: SlotId
  gems: GemSelection[]
  onChange: (next: GemSelection[]) => void
}

function IconBtn({
  src,
  title,
  onClick,
  disabled,
}: {
  src: string
  title: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <Tooltip title={title} placement="top" arrow disableInteractive>
      <Box
        component="button"
        type="button"
        onClick={onClick}
        disabled={disabled}
        sx={{
          p: 0.25,
          m: 0,
          lineHeight: 0,
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'transparent',
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.35 : 1,
          '&:hover': disabled ? undefined : { borderColor: 'primary.main', bgcolor: 'action.hover' },
        }}
      >
        <ItemIcon src={src} size={28} />
      </Box>
    </Tooltip>
  )
}

export default function GemSection({ slot, gems, onChange }: Props) {
  const capacity = gemCapacity(slot)

  if (capacity === 0) {
    return (
      <Typography variant="body2" color="text.disabled">
        보석을 적용할 수 없는 부위입니다.
      </Typography>
    )
  }

  const usedTypes = new Set(gems.map((g) => g.type))
  const full = gems.length >= capacity
  const add = (sel: GemSelection) => onChange([...gems, sel])
  const removeAt = (i: number) => onChange(gems.filter((_, idx) => idx !== i))

  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        보석 (장착 {gems.length}/{capacity})
      </Typography>

      {/* 적용됨 — 아이콘 리스트 (클릭 제거) */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5, mb: 1, minHeight: 34 }}>
        {gems.length === 0 ? (
          <Typography variant="body2" color="text.disabled">
            적용된 보석 없음
          </Typography>
        ) : (
          gems.map((g, i) => (
            <IconBtn
              key={i}
              src={gemIconUrl(g.type, g.grade)}
              title={`${GEM_GRADE_LABELS[g.grade]} ${formatEffects(gemEffect(g.type, g.grade))} (클릭 제거)`}
              onClick={() => removeAt(i)}
            />
          ))
        )}
      </Box>

      {/* 선택 가능 — 보석별 하급/중급/상급 아이콘 */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {gemsForSlot(slot).map((def) => {
          const usedAlready = usedTypes.has(def.type)
          return (
            <Box key={def.type} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
                {def.label}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {GEM_GRADES.map((grade) => (
                  <IconBtn
                    key={grade}
                    src={gemIconUrl(def.type, grade)}
                    title={`${GEM_GRADE_LABELS[grade]} · ${formatEffects(gemEffect(def.type, grade))}`}
                    disabled={full || usedAlready}
                    onClick={() => add({ type: def.type, grade })}
                  />
                ))}
              </Box>
            </Box>
          )
        })}
      </Box>
      {full && (
        <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
          보석 칸을 모두 사용했습니다
        </Typography>
      )}
    </Box>
  )
}
