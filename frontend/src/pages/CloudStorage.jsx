import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ErrorState, PageSkeleton } from '../components/ui/States'
import api, { errMsg } from '../services/api'
import { useStorage } from '../hooks/usePhotos'
import { toast } from '../store'
import { formatBytes } from '../utils/format'
import '../styles/pages.css'

// "Learning boxes": what each cloud is, how to connect it, what to watch out for.
const GUIDE = {
  local: {
    what: 'Saves files in backend/uploads on your computer. No account, no cost.',
    free: 'Free (limited by your disk).',
    steps: ['Nothing to set up - STORAGE_PROVIDER=local is the default.'],
    traps: 'Files exist only on this PC. If the disk dies, photos are gone. Not suitable for a public server.',
  },
  cloudinary: {
    what: 'A media CDN: it stores your images and creates resized versions from the URL.',
    free: 'Free plan includes a monthly credit allowance (storage + transformations + bandwidth).',
    steps: [
      'Sign up at cloudinary.com and open Dashboard → API Keys.',
      'Put the three values in backend/.env: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.',
      'Restart the backend, come back here and press "Use this".',
    ],
    traps: 'Transformations and bandwidth consume credits. Thumbnails here use one transformation per size.',
  },
  s3: {
    what: 'Object storage. AWS S3 is the industry standard; Cloudflare R2 is S3-compatible with no egress fees.',
    free: 'S3: 5 GB free for 12 months on new accounts. R2: 10 GB/month free.',
    steps: [
      'Create a PRIVATE bucket (S3 → Create bucket, block all public access).',
      'Create an IAM user with a policy limited to that bucket (below) and generate an access key.',
      'Add the bucket CORS rule (below) so the browser can upload directly with presigned URLs.',
      'Fill S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY in backend/.env. For R2 also set S3_ENDPOINT_URL.',
      'Optional: put CloudFront (or an R2 public domain) in front and set S3_PUBLIC_BASE_URL for fast cached URLs.',
    ],
    traps: 'S3 charges for data transfer out and per request. Never make the bucket public; never commit keys.',
    iam: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
    "Resource": ["arn:aws:s3:::YOUR_BUCKET", "arn:aws:s3:::YOUR_BUCKET/*"]
  }]
}`,
    cors: `[{
  "AllowedOrigins": ["http://localhost:5173", "null"],
  "AllowedMethods": ["PUT", "GET"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 3000
}]`,
  },
}

function Bar({ used, total, label }) {
  const pct = total ? Math.min(100, (used / total) * 100) : 0
  return (
    <div>
      <div className="bar big"><div className={pct > 90 ? 'danger' : ''} style={{ width: `${pct}%` }} /></div>
      <div className="bar-label"><span>{label}</span><span>{pct.toFixed(1)}%</span></div>
    </div>
  )
}

export default function CloudStorage() {
  const qc = useQueryClient()
  const { data, isLoading, error, refetch } = useStorage(true)
  const [busy, setBusy] = useState('')

  if (isLoading) return <section className="page"><PageSkeleton /></section>
  if (error) return <section className="page"><ErrorState message={errMsg(error)} onRetry={refetch} /></section>

  const use = async (id) => {
    setBusy(id)
    try {
      await api.post('/storage/provider', { provider: id })
      ;['storage', 'me'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
      toast.success('New uploads will go to this provider')
    } catch (e) { toast.error(errMsg(e)) }
    setBusy('')
  }

  const maxType = Math.max(1, ...data.by_type.map((t) => t.bytes))
  const pu = data.provider_usage

  return (
    <section className="page">
      <div className="page-head"><div><h2>Cloud Storage</h2><p className="muted">Where your photos live, and how much space you have left.</p></div></div>

      <div className="card">
        <h3>Your space</h3>
        <Bar used={data.used_bytes} total={data.quota_bytes} label={`${formatBytes(data.used_bytes)} used of ${formatBytes(data.quota_bytes, 0)} · ${formatBytes(data.free_bytes)} free`} />
        <div className="stat-row">
          <div><strong>{data.photo_count.toLocaleString()}</strong><span>files</span></div>
          <div><strong>{formatBytes(data.bin_bytes)}</strong><span>in the bin</span></div>
          <div><strong>{data.providers.find((p) => p.active)?.name ?? data.provider}</strong><span>active provider</span></div>
          {pu && !pu.error && <div><strong>{formatBytes(pu.used_bytes || 0)}</strong><span>reported by provider</span></div>}
        </div>
        {pu?.error && <p className="form-error">Could not read provider usage: {pu.error}</p>}
      </div>

      <div className="card">
        <h3>Files by type</h3>
        {data.by_type.length === 0 && <p className="muted">Nothing uploaded yet.</p>}
        {data.by_type.map((t) => (
          <div key={t.type} className="type-row">
            <span className="type-name">{t.type}</span>
            <div className="bar"><div style={{ width: `${(t.bytes / maxType) * 100}%` }} /></div>
            <span className="muted type-val">{formatBytes(t.bytes)} · {t.count}</span>
          </div>
        ))}
      </div>

      <h3 className="section-title">Storage providers</h3>
      <div className="provider-grid">
        {data.providers.map((p) => {
          const g = GUIDE[p.id]
          return (
            <div key={p.id} className={`card provider${p.active ? ' active' : ''}`}>
              <div className="provider-head">
                <h4>{p.name}</h4>
                {p.active ? <span className="pill good">Active</span> : p.configured ? <span className="pill">Ready</span> : <span className="pill bad">Not connected</span>}
              </div>
              <p className="muted">{p.description}</p>
              {p.env_vars.length > 0 && !p.configured && <p className="env-hint">Add to <code>backend/.env</code>: <code>{p.env_vars.join(', ')}</code></p>}
              <button className="btn primary block" disabled={!p.configured || p.active || busy === p.id} onClick={() => use(p.id)}>
                {p.active ? 'In use' : p.configured ? 'Use this' : 'Connect first'}
              </button>
              {g && (
                <details className="guide">
                  <summary>How to connect · free tier · cost traps</summary>
                  <p><b>What it is:</b> {g.what}</p>
                  <p><b>Free tier:</b> {g.free}</p>
                  <ol>{g.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                  {g.iam && (<><p><b>IAM policy</b> (replace YOUR_BUCKET):</p><pre>{g.iam}</pre></>)}
                  {g.cors && (<><p><b>Bucket CORS</b>:</p><pre>{g.cors}</pre></>)}
                  <p><b>Watch out:</b> {g.traps}</p>
                </details>
              )}
            </div>
          )
        })}
      </div>
      <p className="muted">Switching providers only affects new uploads. Existing photos stay where they were saved and keep working.</p>
    </section>
  )
}
