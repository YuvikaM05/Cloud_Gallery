import { useSelection } from '../store'
import { ACTIONS, PAGE_ACTIONS } from '../utils/actions'
import { pluralPhotos } from '../utils/format'

/**
 * Sticky bar shown while anything is selected (or while an action from the ⋮ menu is waiting for Done).
 */
export default function SelectionToolbar({ page, total, actions, onSelectAll, selectingAll }) {
  const selected = useSelection((s) => s.selected)
  const mode = useSelection((s) => s.mode)
  const action = useSelection((s) => s.action)
  const clear = useSelection((s) => s.clear)
  if (!mode && selected.size === 0) return null

  const ids = [...selected]
  const pending = mode && action ? ACTIONS[action] : null
  const bulkKeys = (PAGE_ACTIONS[page] || []).filter((k) => k !== '|')

  return (
    <div className="selection-toolbar" role="toolbar" aria-label="Selection actions">
      <button className="icon-btn" aria-label="Clear selection" onClick={clear}>✕</button>
      <strong className="sel-count">
        {selected.size ? `${selected.size.toLocaleString()} selected` : 'Select photos'}
      </strong>
      {pending && <span className="sel-hint">Choose photos to: <b>{pending.label}</b></span>}

      <div className="sel-spacer" />

      {total > 0 && selected.size < total && (
        <button className="btn small" onClick={onSelectAll} disabled={selectingAll}>
          {selectingAll ? 'Selecting...' : `Select all ${total.toLocaleString()}`}
        </button>
      )}

      {pending ? (
        <>
          <button className="btn ghost small" onClick={clear}>Cancel</button>
          <button className={`btn small ${pending.danger ? 'danger' : 'primary'}`} onClick={() => actions.run(action, ids)}>
            Done · {pending.short}{ids.length ? ` (${pluralPhotos(ids.length)})` : ''}
          </button>
        </>
      ) : (
        <div className="sel-actions">
          {bulkKeys.map((key) => {
            const a = ACTIONS[key]
            return (
              <button key={key} className={`btn small${a.danger ? ' danger-text' : ''}`} onClick={() => actions.run(key, ids)} title={a.label}>
                <span aria-hidden="true">{a.icon}</span> {a.short}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
