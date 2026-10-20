import PhotoLibrary from '../components/PhotoLibrary'

const FILTERS = { favorite: true }

export default function Favorites() {
  return (
    <PhotoLibrary
      page="favorites"
      title="Favorites"
      filters={FILTERS}
      emptyIcon="❤️"
      emptyTitle="No favourites yet"
      emptyText="Tap the heart on any photo to keep it here."
    />
  )
}
