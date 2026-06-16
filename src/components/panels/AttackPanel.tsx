import CollapsiblePanel from '../common/CollapsiblePanel'
import Placeholder from '../common/Placeholder'

export default function AttackPanel() {
  return (
    <CollapsiblePanel id="attack" title="공격력 계산">
      <Placeholder height={200} />
    </CollapsiblePanel>
  )
}
