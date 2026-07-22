import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import { listScrollsForItem, getScroll } from '../../data/scrolls'
import type { ItemData } from '../../domain/item'
import type { AppliedScroll } from '../../domain/builtItem'
import type { ScrollDef, ScrollRate } from '../../domain/scrolls'
import { formatEffects } from '../../lib/effectFormat'
import ItemIcon from '../common/ItemIcon'

interface Props {
  base: ItemData
  scrolls: AppliedScroll[]
  onChange: (next: AppliedScroll[]) => void
}

/** 확률별 고정 주문서 아이콘 */
const RATE_ICON: Record<ScrollRate, string> = {
  100: 'https://maplestory.io/api/gms/62/item/2044500/icon',
  60: 'https://maplestory.io/api/gms/62/item/2044501/icon',
  10: 'https://maplestory.io/api/gms/62/item/2044502/icon',
}

/** 주문서 아이콘: 전용 주문서(option.itemId)는 자체 아이콘, 그 외 확률별 기본 아이콘 */
function scrollIconSrc(def: ScrollDef | undefined, rate: ScrollRate): string {
  const itemId = def?.options.find((o) => o.rate === rate)?.itemId
  return itemId ? `https://maplestory.io/api/gms/62/item/${itemId}/icon` : RATE_ICON[rate]
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

export default function ScrollSection({ base, scrolls, onChange }: Props) {
  const available = useMemo(() => listScrollsForItem(base), [base])
  const tuc = base.tuc ?? 0
  const full = scrolls.length >= tuc

  if (tuc === 0) {
    return (
      <Typography variant="body2" color="text.disabled">
        주문서를 바를 수 없는 아이템입니다 (업횟 0).
      </Typography>
    )
  }

  const add = (key: string, rate: ScrollRate, effects: AppliedScroll['effects']) =>
    onChange([...scrolls, { key, rate, effects }])
  const removeAt = (i: number) => onChange(scrolls.filter((_, idx) => idx !== i))

  const nameOf = (key: string) => available.find((d) => d.key === key)?.name ?? key

  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        주문서 (사용 {scrolls.length}/{tuc})
      </Typography>

      {/* 적용됨 — 아이콘 리스트 (클릭 제거) */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5, mb: 1, minHeight: 34 }}>
        {scrolls.length === 0 ? (
          <Typography variant="body2" color="text.disabled">
            적용된 주문서 없음
          </Typography>
        ) : (
          scrolls.map((s, i) => (
            <IconBtn
              key={i}
              src={scrollIconSrc(getScroll(s.key), s.rate)}
              title={`${nameOf(s.key)} ${s.rate}% · ${formatEffects(s.effects)} (클릭 제거)`}
              onClick={() => removeAt(i)}
            />
          ))
        )}
      </Box>

      {/* 선택 가능 — 주문서별 100/60/10 아이콘 */}
      {available.length === 0 ? (
        <Typography variant="body2" color="text.disabled">
          적용 가능한 주문서가 없습니다.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {available.map((def) => (
            <Box key={def.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
                {def.name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {def.options.map((o) => (
                  <IconBtn
                    key={o.rate}
                    src={scrollIconSrc(def, o.rate)}
                    title={`${o.rate}% · ${formatEffects(o.effects)}`}
                    disabled={full}
                    onClick={() => add(def.key, o.rate, o.effects)}
                  />
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      )}
      {full && (
        <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
          업횟을 모두 사용했습니다
        </Typography>
      )}
    </Box>
  )
}
