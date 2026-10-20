import { useQuery } from '@tanstack/react-query'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { EmptyState, ErrorState, PageSkeleton } from '../components/ui/States'
import api, { errMsg } from '../services/api'
import { useBulk } from '../hooks/usePhotos'
import { toast } from '../store'
import { absUrl, formatBytes, monthLabel, pluralPhotos } from '../utils/format'
import '../styles/pages.css'

const COLORS = ['#4f8cff', '#34c28b', '#f5a524', '#e5484d', '#9b6bff', '#2bb3c0']
const tick = { fill: 'var(--muted)', fontSize: 12 }
const get = (path) => () => api.get(path).then((r) => r.data)

function Stat({ label, value, hint }) {
  return <div className="stat-card"><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>
}

const ChartCard = ({ title, children }) => (
  <div className="card chart-card"><h3>{title}</h3><div className="chart-box">{children}</div></div>
)

export default function StorageAnalytics() {
  const overview = useQuery({ queryKey: ['analytics', 'overview'], queryFn: get('/analytics/overview') })
  const monthly = useQuery({ queryKey: ['analytics', 'monthly'], queryFn: get('/analytics/uploads-by-month') })
  const over = useQuery({ queryKey: ['analytics', 'over'], queryFn: get('/analytics/storage-over-time') })
  const types = useQuery({ queryKey: ['analytics', 'types'], queryFn: get('/analytics/by-type') })
  const albums = useQuery({ queryKey: ['analytics', 'albums'], queryFn: get('/analytics/albums') })
  const tips = useQuery({ queryKey: ['analytics', 'tips'], queryFn: get('/analytics/suggestions') })
  const bulk = useBulk()

  const err = [overview, monthly, over, types, albums, tips].find((q) => q.error)?.error
  if (err) return <section className="page"><ErrorState message={errMsg(err)} onRetry={() => window.location.reload()} /></section>
  if (!overview.data || !monthly.data || !over.data || !types.data || !albums.data || !tips.data) return <section className="page"><PageSkeleton /></section>

  const o = overview.data
  const binIt = async (ids, msg) => {
    await bulk.mutateAsync({ ids, action: 'delete' }).catch(() => {})
    toast.success(msg)
  }

  return (
    <section className="page">
      <div className="page-head"><div><h2>Storage Analytics</h2><p className="muted">Where your space goes, and how to get some back.</p></div></div>

      <div className="stat-grid">
        <Stat label="Photos" value={o.photos.toLocaleString()} />
        <Stat label="Space used" value={formatBytes(o.live_bytes)} hint={`avg ${formatBytes(o.avg_size)} each`} />
        <Stat label="Favourites" value={o.favorites.toLocaleString()} />
        <Stat label="Albums" value={o.albums} />
        <Stat label="Active share links" value={o.active_shares} />
        <Stat label="In the bin" value={formatBytes(o.bin_bytes)} hint={pluralPhotos(o.bin_photos)} />
      </div>

      <div className="chart-grid">
        <ChartCard title="Storage used over time">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={over.data.map((d) => ({ ...d, label: monthLabel(d.month) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={tick} /><YAxis tickFormatter={(v) => formatBytes(v, 0)} tick={tick} width={70} />
              <Tooltip formatter={(v) => formatBytes(v)} />
              <Area type="monotone" dataKey="bytes" name="Used" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.25} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Uploads per month">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly.data.map((d) => ({ ...d, label: monthLabel(d.month) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={tick} /><YAxis allowDecimals={false} tick={tick} width={40} />
              <Tooltip /><Bar dataKey="count" name="Photos" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Breakdown by file type">
          {types.data.length === 0 ? <p className="muted">No data yet.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={types.data} dataKey="bytes" nameKey="type" innerRadius="50%" outerRadius="80%" paddingAngle={2}>
                  {types.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatBytes(v)} /><Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Size by album">
          {albums.data.length === 0 ? <p className="muted">No data yet.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={albums.data.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tickFormatter={(v) => formatBytes(v, 0)} tick={tick} />
                <YAxis type="category" dataKey="album" tick={tick} width={100} />
                <Tooltip formatter={(v) => formatBytes(v)} />
                <Bar dataKey="bytes" name="Size" fill={COLORS[2]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <h3 className="section-title">Free up space</h3>
      {o.duplicate_groups === 0 && tips.data.largest.length === 0 && <EmptyState icon="✨" title="Nothing to clean up" text="Upload some photos and suggestions will show up here." />}

      {tips.data.duplicates.length > 0 && (
        <div className="card">
          <h4>Duplicates · {formatBytes(o.duplicate_bytes)} could be saved</h4>
          {tips.data.duplicates.map((g) => (
            <div key={g.hash} className="dup-row">
              <div className="dup-thumbs">{g.photos.slice(0, 6).map((p) => <img key={p.id} src={absUrl(p.thumb_url)} alt={p.name} title={p.name} />)}</div>
              <div className="dup-info"><strong>{g.photos.length} identical copies</strong><span className="muted">{g.photos[0].name} · saves {formatBytes(g.wasted_bytes)}</span></div>
              <button className="btn small" disabled={bulk.isPending}
                onClick={() => binIt(g.photos.slice(1).map((p) => p.id), `Moved ${g.photos.length - 1} duplicate(s) to the bin`)}>
                Bin extra copies
              </button>
            </div>
          ))}
        </div>
      )}

      {tips.data.largest.length > 0 && (
        <div className="card">
          <h4>Biggest files</h4>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {tips.data.largest.map((p) => (
                  <tr key={p.id}>
                    <td className="thumb-cell"><img src={absUrl(p.thumb_url)} alt="" /></td>
                    <td><strong>{p.name}</strong><div className="muted">{p.width ? `${p.width}×${p.height}` : ''}</div></td>
                    <td>{formatBytes(p.size)}</td>
                    <td className="row-actions"><button className="btn small danger-text" disabled={bulk.isPending} onClick={() => binIt([p.id], 'Moved to the bin')}>Move to bin</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
