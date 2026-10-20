import api, { errMsg } from './api'
import { MAX_UPLOAD_MB } from './config'
import { toast, useUploads } from '../store'
import { useAuth } from '../store/auth'
import { pluralPhotos } from '../utils/format'

const CONCURRENCY = 3

function validate(file) {
  if (!file.type.startsWith('image/')) return 'Not an image'
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `Larger than ${MAX_UPLOAD_MB} MB`
  return null
}

/** Direct-to-bucket upload: browser -> S3/R2 with a presigned URL, then tell our API to register it. */
function putWithProgress(url, file, headers, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v))
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Bucket rejected the upload (${xhr.status}). Check the bucket CORS rules.`)))
    xhr.onerror = () => reject(new Error('Network error while uploading to the bucket (check bucket CORS).'))
    xhr.send(file)
  })
}

async function uploadOne(file, trayId, { direct }) {
  const { update } = useUploads.getState()
  update(trayId, { status: 'uploading', progress: 0 })
  if (direct) {
    const { data: ps } = await api.post('/storage/presign', { filename: file.name, content_type: file.type })
    await putWithProgress(ps.upload_url, file, ps.headers, (p) => update(trayId, { progress: Math.min(p, 95) }))
    await api.post('/photos/register', { key: ps.key, name: file.name })
  } else {
    const form = new FormData()
    form.append('files', file)
    await api.post('/photos/upload', form, {
      onUploadProgress: (e) => e.total && update(trayId, { progress: Math.round((e.loaded / e.total) * 95) }),
    })
  }
  update(trayId, { status: 'done', progress: 100 })
}

/**
 * Upload many files with 3 running at a time. Progress is shown in the UploadTray.
 * queryClient is passed in so we can refresh the lists afterwards.
 */
export async function uploadFiles(fileList, queryClient) {
  const files = Array.from(fileList || [])
  if (!files.length) return
  const { add, update } = useUploads.getState()

  let direct = false
  try {
    const summary = await queryClient.fetchQuery({
      queryKey: ['storage'],
      queryFn: () => api.get('/storage/summary').then((r) => r.data),
      staleTime: 60_000,
    })
    direct = !!summary.direct_upload
  } catch { /* fall back to normal upload */ }

  const queue = files.map((file) => {
    const id = add(file.name)
    const problem = validate(file)
    if (problem) update(id, { status: 'error', error: problem })
    return { file, id, skip: !!problem }
  })

  let ok = 0
  let failed = queue.filter((q) => q.skip).length
  let cursor = 0
  const worker = async () => {
    while (cursor < queue.length) {
      const job = queue[cursor++]
      if (job.skip) continue
      try {
        await uploadOne(job.file, job.id, { direct })
        ok++
      } catch (e) {
        failed++
        update(job.id, { status: 'error', error: e?.response ? errMsg(e) : e.message })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))

  ;['photos', 'albums', 'storage', 'analytics'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }))
  if (ok) {
    toast.success(`Uploaded ${pluralPhotos(ok)}${failed ? ` (${failed} failed)` : ''}`)
    if (useAuth.getState().token) {
      api.post('/notifications', { kind: 'upload', title: 'Upload finished', body: `${pluralPhotos(ok)} added to your gallery.` })
        .then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }))
        .catch(() => {})
    }
  } else if (failed) {
    toast.error('Upload failed. See the upload panel for details.')
  }
}

/** Electron gives us {name, type, data(Uint8Array)} objects instead of File objects. */
export function filesFromNative(list) {
  return list.map((f) => new File([f.data], f.name, { type: f.type || 'image/jpeg' }))
}
