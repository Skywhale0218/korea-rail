import { useMemo, useState } from 'react'
import { mapRef } from './mapRef'
import { useRailStore } from './useRailStore'
import { REGIONS, fetchRoutes, toLine, type BBox, type Found } from './overpass'

const inp = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900'

export default function ImportTab() {
  const addLines = useRailStore((s) => s.addLines)
  const [region, setRegion] = useState('seoul')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [found, setFound] = useState<Found[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const shown = useMemo(() => (found ?? []).filter((f) => f.name.includes(q)).slice(0, 150), [found, q])

  const bboxOf = (): BBox | null => {
    const m = mapRef.current
    if (region === 'view') {
      if (!m) return null
      const b = m.getBounds()
      return [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()]
    }
    const r = REGIONS.find((x) => x.id === region)
    if (!r) return null
    m?.fitBounds([[r.bbox[0], r.bbox[1]], [r.bbox[2], r.bbox[3]]])
    return r.bbox
  }

  const load = async () => {
    const bbox = bboxOf()
    if (!bbox) return
    setBusy(true); setErr(''); setFound(null); setPicked(new Set())
    try { setFound(await fetchRoutes(bbox)) } catch (e) { setErr((e as Error).message) }
    setBusy(false)
  }
  const toggle = (k: string) => setPicked((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n })

  return (
    <div className="mt-3 grid gap-2">
      <div className="text-sm font-semibold">실제 노선 불러오기</div>
      <select className={inp} value={region} onChange={(e) => setRegion(e.target.value)}>
        {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        <option value="view">현재 지도 화면</option>
      </select>
      <button onClick={load} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50">
        {busy ? '불러오는 중… (최대 1분)' : '노선 찾기'}
      </button>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {found && found.length === 0 && <p className="text-sm text-slate-500">이 영역에서 노선을 찾지 못했어요. 지도를 옮기거나 다른 지역을 골라 보세요.</p>}
      {found && found.length > 0 && (
        <>
          <input className={inp} placeholder="이름으로 거르기 (예: 2호선)" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1">
            {shown.map((f) => (
              <label key={f.key} className="flex items-center gap-2 px-2 py-1 text-sm">
                <input type="checkbox" checked={picked.has(f.key)} onChange={() => toggle(f.key)} />
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.color ?? '#555' }} />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="shrink-0 text-xs text-slate-400">{f.stops.length}역{f.loop ? ' · 순환' : ''}</span>
              </label>
            ))}
          </div>
          <button
            disabled={picked.size === 0}
            onClick={() => { addLines((found ?? []).filter((f) => picked.has(f.key)).map(toLine)); setPicked(new Set()) }}
            className="rounded-lg border border-[#0052a4] bg-[#0052a4] px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            선택한 {picked.size}개 노선 추가
          </button>
          <p className="text-xs text-slate-400">같은 노선이 방향별로 따로 나올 수 있어요. 하나만 고르세요.</p>
        </>
      )}
      <p className="text-xs text-slate-400">데이터: © OpenStreetMap contributors (ODbL). 역 위치와 이름은 OSM 기준이라 실제와 다르거나 빠진 역이 있을 수 있어요.</p>
    </div>
  )
}
