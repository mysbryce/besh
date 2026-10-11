import { Select } from './ui/select'
import type { SavedFlow } from '../types/api'

export function FlowPicker({
  flows,
  selected,
  disabled,
  onSelect,
}: {
  flows: SavedFlow[]
  selected: string | null
  disabled: boolean
  onSelect: (id: string) => void
}) {
  return (
    <div className="mobile-api-picker">
      <label htmlFor="saved-api-picker">Your APIs</label>
      <Select
        id="saved-api-picker"
        label="Saved API"
        placeholder="Choose a saved API"
        value={selected ?? ''}
        disabled={disabled}
        options={flows.map((flow) => ({
          value: flow.id,
          label: flow.name,
        }))}
        onValueChange={onSelect}
      />
    </div>
  )
}
