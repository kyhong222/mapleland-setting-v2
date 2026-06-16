import CollapsiblePanel from '../common/CollapsiblePanel'
import Placeholder from '../common/Placeholder'

export default function MonsterPanel() {
  return (
    <CollapsiblePanel id="monster" title="몬스터 선택">
      <Placeholder height={240} />
    </CollapsiblePanel>
  )
}
