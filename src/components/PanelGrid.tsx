import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import EquipmentPanel from './panels/EquipmentPanel'
import InventoryPanel from './panels/InventoryPanel'
import MonsterPanel from './panels/MonsterPanel'
import StatPanel from './panels/StatPanel'
import SkillPanel from './panels/SkillPanel'
import AttackPanel from './panels/AttackPanel'
import DetailStatPanel from './panels/DetailStatPanel'
import IncomingDamagePanel from './panels/IncomingDamagePanel'

/**
 * 3열 세로 스택. 같은 열에서 위 패널을 접으면 아래 패널이 올라온다.
 * 1열: 장비·스탯·세부스탯 / 2열: 인벤토리·스킬 / 3열: 몬스터·공격력·피격데미지
 */
export default function PanelGrid() {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
        gap: 2,
        alignItems: 'start',
      }}
    >
      <Stack spacing={2}>
        <EquipmentPanel />
        <StatPanel />
        <DetailStatPanel />
      </Stack>
      <Stack spacing={2}>
        <InventoryPanel />
        <SkillPanel />
      </Stack>
      <Stack spacing={2}>
        <MonsterPanel />
        <AttackPanel />
        <IncomingDamagePanel />
      </Stack>
    </Box>
  )
}
