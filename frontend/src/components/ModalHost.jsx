import { useModal } from '../store'
import AddPhotosModal from './modals/AddPhotosModal'
import AlbumPickerModal from './modals/AlbumPickerModal'
import CameraModal from './modals/CameraModal'
import ConfirmModal from './modals/ConfirmModal'
import DetailsModal from './modals/DetailsModal'
import EditorModal from './modals/EditorModal'
import PromptModal from './modals/PromptModal'
import ShareModal from './modals/ShareModal'

const MODALS = {
  prompt: PromptModal,
  confirm: ConfirmModal,
  albumPicker: AlbumPickerModal,
  details: DetailsModal,
  share: ShareModal,
  editor: EditorModal,
  camera: CameraModal,
  addPhotos: AddPhotosModal,
}

export default function ModalHost() {
  const modal = useModal((s) => s.modal)
  const close = useModal((s) => s.close)
  if (!modal) return null
  const Comp = MODALS[modal.type]
  return Comp ? <Comp key={modal.type + JSON.stringify(Object.keys(modal.props))} {...modal.props} onClose={close} /> : null
}
