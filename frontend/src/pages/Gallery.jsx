import PhotoLibrary from '../components/PhotoLibrary'

export default function Gallery() {
  return (
    <PhotoLibrary
      page="gallery"
      title="Photos"
      emptyTitle="Your gallery is empty"
      emptyText="Click Upload, or drag photos from your computer onto this window."
    />
  )
}
