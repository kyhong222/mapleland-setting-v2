/** 공지 본문 블록 렌더러 */

import { Fragment } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { parseInline, type NoticeBlock } from '../../data/notices'
import { NoticeItemCard, NoticeItemChip, NoticeItemCompare, type NoticeItemMap } from './NoticeItem'

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
      return (
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, px: 1 }}>
          {block.items.map((r) => (
            <NoticeItemCompare key={r.id} refItem={r} items={items} />
          ))}
        </Box>
      )
  }
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
