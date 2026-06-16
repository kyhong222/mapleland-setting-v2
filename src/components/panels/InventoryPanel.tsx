import CollapsiblePanel from '../common/CollapsiblePanel'
import Placeholder from '../common/Placeholder'

export default function InventoryPanel() {
  return (
    <CollapsiblePanel id="inventory" title="인벤토리">
      <Placeholder height={240} />
    </CollapsiblePanel>
  )
}
