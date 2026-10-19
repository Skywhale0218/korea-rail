import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin, Search, X } from 'lucide-react'
import L from 'leaflet'
import { mapRef } from './mapRef'

interface Hit { place_id: number; display_name: string; name?: string; lat: string; lon: string; boundingbox?: string[]; type?: string; addresstype?: string }

/** OpenStreetMap Nominatim 장소·건물 검색. 입력창에서 Enter(또는 돋보기)를 눌러 검색해요. */
export default function SearchBox() {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [krOnly, setKrOnly] = useState(true)
  const marker = useRef<L.Marker | null>(null)
  const last = useRef(0)

  useEffect(() => () => { marker.current?.remove() }, [])

  const search = async () => {
    const text = q.trim()
    if (!text || busy) return
    const wait = 1100 - (Date.now() - last.current) // Nominatim 이용 정책: 초당 1회 이하
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    last.current = Date.now()
    setBusy(true); setMsg(''); setHits(null)
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search')
      url.searchParams.set('format', 'jsonv2')
      url.searchParams.set('q', text)
      url.searchParams.set('limit', '8')
      url.searchParams.set('accept-language', 'ko')
      if (krOnly) url.searchParams.set('countrycodes', 'kr')
      const r = await fetch(url.toString())
      if (!r.ok) throw new Error(String(r.status))
      const data = (await r.json()) as Hit[]
      setHits(data)
      if (!data.length) setMsg('검색 결과가 없어요. 다른 이름으로 검색해 보세요.')
    } catch {
      setMsg(navigator.onLine ? '검색 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.' : '인터넷에 연결되어 있지 않아 검색할 수 없어요.')
    }
    setBusy(false)
  }

  const clearMarker = () => { marker.current?.remove(); marker.current = null }
  const pick = (h: Hit) => {
    const map = mapRef.current
    if (!map) return
    const ll: L.LatLngTuple = [parseFloat(h.lat), parseFloat(h.lon)]
    clearMarker()
    const title = h.name || h.display_name.split(',')[0]
    marker.current = L.marker(ll, {
      icon: L.divIcon({ className: '', iconSize: [28, 36], iconAnchor: [14, 34],
        html: '<svg width="28" height="36" viewBox="0 0 28 36"><path d="M14 1C7 1 2 6 2 13c0 9 12 22 12 22s12-13 12-22C26 6 21 1 14 1z" fill="#0052a4" stroke="#fff" stroke-width="2"/><circle cx="14" cy="13" r="5" fill="#fff"/></svg>' }),
    }).addTo(map).bindPopup(`<b>${title.replace(/[<>&]/g, '')}</b>`).openPopup()
    const bb = h.boundingbox?.map(parseFloat)
    if (bb && bb.length === 4) map.flyToBounds([[bb[0], bb[2]], [bb[1], bb[3]]], { maxZoom: 17, duration: 1.2 })
    else map.flyTo(ll, 16, { duration: 1.2 })
    setHits(null)
  }

  return (
    <div className="absolute left-3 right-3 top-[60px] z-[1000] lg:left-1/2 lg:right-auto lg:top-3 lg:w-[min(24rem,calc(100%-21rem))] lg:-translate-x-1/2">
      <div className="flex items-center gap-1 rounded-xl border border-neutral-300 bg-white px-2 shadow">
        <button onClick={search} aria-label="검색" className="p-1.5 text-neutral-600 hover:text-[#0052a4]">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
        </button>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="장소·역·건물 검색 (예: 서울역, 광화문)"
          className="min-w-0 flex-1 bg-transparent py-2 text-sm text-black outline-none" />
        {(q || hits) && (
          <button aria-label="지우기" className="p-1.5 text-neutral-500 hover:text-black" onClick={() => { setQ(''); setHits(null); setMsg(''); clearMarker() }}><X size={16} /></button>
        )}
      </div>
      {(hits || msg) && (
        <div className="mt-1 max-h-72 overflow-y-auto rounded-xl border border-neutral-300 bg-white shadow-lg">
          {msg && <p className="p-3 text-sm text-neutral-600">{msg}</p>}
          {hits?.map((h) => (
            <button key={h.place_id} onClick={() => pick(h)} className="flex w-full items-start gap-2 border-b border-neutral-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-neutral-50">
              <MapPin size={15} className="mt-0.5 shrink-0 text-[#0052a4]" />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-black">{h.name || h.display_name.split(',')[0]}</span>
                <span className="block truncate text-xs text-neutral-500">{h.display_name}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <label className="mt-1 flex w-fit items-center gap-1.5 rounded-lg bg-white/90 px-2 py-1 text-xs text-neutral-600">
        <input type="checkbox" checked={krOnly} onChange={(e) => setKrOnly(e.target.checked)} />대한민국 안에서만 검색
      </label>
    </div>
  )
}
