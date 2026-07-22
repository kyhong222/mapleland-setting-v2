import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { ItemData } from '../../domain/item'
import type { EffectMap } from '../../domain/effects'
import { SLOTS } from '../../domain/equipSlots'
import { resolveBuiltItem } from '../../domain/builtItem'
import type { BuiltItem, AppliedScroll } from '../../domain/builtItem'
import type { GemSelection } from '../../domain/maker'
import ItemIcon from '../common/ItemIcon'
import ItemTooltip from '../common/ItemTooltip'
import CatalogSection from './CatalogSection'
import ScrollSection from './ScrollSection'
import GemSection from './GemSection'
import GrowthSection, { defaultGrowth } from './GrowthSection'

interface Props {
  open: boolean
  initial?: BuiltItem
  onClose: () => void
  onConfirm: (item: BuiltItem) => void
}

interface Draft {
  base: ItemData | null
  adjustments: EffectMap
  scrolls: AppliedScroll[]
  gems: GemSelection[]
  growth: EffectMap
}

const EMPTY: Draft = { base: null, adjustments: {}, scrolls: [], gems: [], growth: {} }

export default function ItemMakerDialog({ open, initial, onClose, onConfirm }: Props) {
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [hover, setHover] = useState<ItemData | null>(null)

  useEffect(() => {
    if (!open) return
    setDraft(
      initial
        ? {
            base: initial.base,
            adjustments: { ...(initial.adjustments ?? {}) },
            scrolls: [...initial.scrolls],
            gems: [...initial.gems],
            growth: { ...(initial.growth ?? {}) },
          }
        : EMPTY,
    )
  }, [open, initial])

  const base = draft.base
  const built: BuiltItem | null = base
    ? { base, adjustments: draft.adjustments, scrolls: draft.scrolls, gems: draft.gems, growth: draft.growth }
    : null
  const result = built ? resolveBuiltItem(built) : null

  const confirm = () => {
    if (!base) return
    onConfirm({
      base,
      adjustments: Object.keys(draft.adjustments).length ? draft.adjustments : undefined,
      scrolls: draft.scrolls,
      gems: draft.gems,
      growth: Object.keys(draft.growth).length ? draft.growth : undefined,
    })
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth={!base || !result ? 'md' : 'sm'}>
      <DialogTitle>아이템 제작</DialogTitle>
      <DialogContent dividers>
        {!base || !result ? (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <CatalogSection
                base={null}
                adjustments={draft.adjustments}
                onPickBase={(item) => setDraft({ base: item, adjustments: {}, scrolls: [], gems: [], growth: defaultGrowth(item) ?? {} })}
                onChangeAdjust={(adjustments) => setDraft((d) => ({ ...d, adjustments }))}
                onHoverItem={setHover}
              />
            </Box>
            {/* 우측 미리보기 (정옵) — 공간 고정 */}
            <Box sx={{ width: 264, flexShrink: 0, position: 'sticky', top: 0 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                미리보기 (정옵)
              </Typography>
              {hover ? (
                <ItemTooltip built={{ base: hover, adjustments: {}, scrolls: [], gems: [], growth: {} }} />
              ) : (
                <Box
                  sx={{
                    minHeight: 220,
                    border: '1px dashed',
                    borderColor: 'divider',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 2,
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="body2" color="text.disabled">
                    아이템에 마우스를 올리면
                    <br />
                    정보가 표시됩니다
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        ) : (
          <Stack spacing={2} divider={<Divider flexItem />}>
            {/* 아이콘 · 이름(등급색) · 변경 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ItemIcon src={base.iconUrl} alt={base.name} size={40} outlineColor={result.grade.info.color} />
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, color: result.grade.info.textColor }} noWrap>
                  {base.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {SLOTS[base.slot].label}
                  {base.reqLevel ? ` · Lv.${base.reqLevel}` : ''} · 업횟 {base.tuc ?? 0} ·{' '}
                  {result.grade.info.label} {result.grade.score}
                </Typography>
              </Box>
              <Button size="small" onClick={() => setDraft(EMPTY)}>
                변경
              </Button>
            </Box>

            {/* 미리보기 (아이템 툴팁 카드) */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                미리보기
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                {built && <ItemTooltip built={built} />}
              </Box>
            </Box>

            {/* 수치조정 */}
            <CatalogSection
              base={base}
              adjustments={draft.adjustments}
              onPickBase={(item) => setDraft({ base: item, adjustments: {}, scrolls: [], gems: [], growth: defaultGrowth(item) ?? {} })}
              onChangeAdjust={(adjustments) => setDraft((d) => ({ ...d, adjustments }))}
            />

            {/* 리버스/타임리스 레벨업 성장 (해당 아이템만 표시) */}
            <GrowthSection
              item={base}
              growth={draft.growth}
              onChange={(growth) => setDraft((d) => ({ ...d, growth }))}
            />

            <ScrollSection
              base={base}
              scrolls={draft.scrolls}
              onChange={(scrolls) => setDraft((d) => ({ ...d, scrolls }))}
            />
            <GemSection
              slot={base.slot}
              gems={draft.gems}
              onChange={(gems) => setDraft((d) => ({ ...d, gems }))}
              noGem={base.noGem}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button variant="contained" onClick={confirm} disabled={!base}>
          제작
        </Button>
      </DialogActions>
    </Dialog>
  )
}
