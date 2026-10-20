import Modal from '../ui/Modal'

export default function ConfirmModal({ title, message, confirmText = 'Confirm', danger = false, onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="modal-text">{message}</p>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button
          autoFocus
          className={`btn ${danger ? 'danger' : 'primary'}`}
          onClick={() => {
            onClose()
            onConfirm()
          }}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  )
}
