/** 공지 본문 블록 렌더러 */

import { Fragment } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import { parseInline, type NoticeBlock } from '../../data/notices'
import { findSkillById } from '../../data/skills'
import { NoticeCompareTable, NoticeItemCard, NoticeItemChip, NoticeItemIcon, type NoticeItemMap } from './NoticeItem'

/** 텍스트 + `[[item:id]]` 칩 */
function Inline({ text, items }: { text: string; items: NoticeItemMap }) {
  return (
    <>
      {parseInline(text).map((s, i) =>
        s.kind === 'text' ? <Fragment key={i}>{s.text}</Fragment> : <NoticeItemChip key={i} id={s.id} items={items} />,
      )}
    </>
  )
}

function Block({ block, items }: { block: NoticeBlock; items: NoticeItemMap }) {
  switch (block.type) {
    case 'heading':
      return (
        <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 1 }}>
          {block.text}
        </Typography>
      )
    case 'text':
      return (
        <Typography variant="body2" sx={{ whiteSpace: 'pre-line', lineHeight: 1.8 }}>
          <Inline text={block.text} items={items} />
        </Typography>
      )
    case 'list':
      return (
        <Box component="ul" sx={{ m: 0, pl: 2.5, typography: 'body2', lineHeight: 1.8 }}>
          {block.items.map((t, i) => (
            <li key={i}>
              <Inline text={t} items={items} />
            </li>
          ))}
        </Box>
      )
    case 'callout':
      return (
        <Alert severity={block.tone} sx={{ whiteSpace: 'pre-line' }}>
          <Inline text={block.text} items={items} />
        </Alert>
      )
    case 'items':
      if (block.view === 'icons') {
        return (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {block.items.map((r) => (
              <NoticeItemIcon key={r.id} id={r.id} items={items} />
            ))}
          </Box>
        )
      }
      return block.view === 'chips' ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {block.items.map((r) => (
            <NoticeItemChip key={r.id} id={r.id} items={items} />
          ))}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1.5 }}>
          {block.items.map((r) => (
            <NoticeItemCard key={r.id} refItem={r} items={items} />
          ))}
        </Box>
      )
    case 'compare':
      return <NoticeCompareTable refs={block.items} items={items} />
    case 'skills':
      return (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {block.ids.map((id) => (
            <NoticeSkillIcon key={id} id={id} />
          ))}
        </Box>
      )
    case 'image':
      return (
        <Box component="figure" sx={{ m: 0, textAlign: 'center' }}>
          <Box
            component="img"
            src={block.src}
            alt={block.alt}
            loading="lazy"
            sx={{ display: 'block', mx: 'auto', width: '100%', maxWidth: block.width ?? '100%', height: 'auto', borderRadius: 1 }}
          />
          {block.caption && (
            <Typography component="figcaption" variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {block.caption}
            </Typography>
          )}
        </Box>
      )
  }
}

/** 스킬 아이콘 타일 — 아이템 아이콘(NoticeItemIcon)과 같은 40px 틀, 호버 시 스킬 이름 */
function NoticeSkillIcon({ id }: { id: number }) {
  const name = findSkillById(id)?.description?.name ?? String(id)
  return (
    <Tooltip title={name} placement="top" arrow enterTouchDelay={0} leaveTouchDelay={3000} disableInteractive>
      <Box
        sx={{
          width: 40,
          height: 40,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'action.hover',
          flexShrink: 0,
        }}
      >
        <Box component="img" src={`/skill-icons/${id}.png`} alt={name} sx={{ width: 32, height: 32, imageRendering: 'pixelated' }} />
      </Box>
    </Tooltip>
  )
}

export default function NoticeBlocks({ blocks, items }: { blocks: NoticeBlock[]; items: NoticeItemMap }) {
  return (
    <Stack spacing={1.5}>
      {blocks.map((b, i) => (
        <Block key={i} block={b} items={items} />
      ))}
    </Stack>
  )
}
