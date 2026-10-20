import PhotoLibrary from '../components/PhotoLibrary'
import { useAuth } from '../store/auth'

const FILTERS = { deleted: true }

export default function Bin() {
  const days = useAuth((s) => s.user?.settings?.bin_days ?? 30)
  return (
    <PhotoLibrary
      page="bin"
      title="Bin"
      subtitle={`Photos in the bin are deleted forever after ${days} days.`}
      filters={FILTERS}
      isBin
      emptyIcon="🗑"
      emptyTitle="The bin is empty"
      emptyText="Deleted photos stay here until they are restored or auto-deleted."
    />
  )
}
