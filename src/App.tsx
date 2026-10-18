import { useEffect, useMemo, useRef, useState } from 'react'
import { 
  ChevronLeft, ChevronRight, Hand, MapPin, Pause, Pencil, Play, Trash2, Undo2, 
  ArrowLeftRight, Plus, FolderDown, Upload, Search, Loader2, X 
} from 'lucide-react'
import MapCanvas from './MapCanvas'
import { useRailStore, type Mode } from './useRailStore'
import { 
  BASE_FARE, METHODS, METHOD_LABEL, PRESET_LINES, VEHICLES, calc, fareOf, fmtKRW, route, 
  type Line, type Method, type VehicleId 
} from './rail'
import { download, readLines, toGeoJSON } from './io'
import ImportTab from './ImportTab'
import HeaderBar from './CloudBar'
import { mapRef } from './mapRef'

const MODES: { id: Mode; label: string; icon: typeof Hand; hint: string }[] = [
  { id: 'pan', label: '이동', icon: Hand, hint: '지도를 움직여 보세요.' },
  { id: 'draw', label: '선 긋기', icon: Pencil, hint: '지도를 눌러 선로를 이어가세요. 다른 노선 근처를 누르면 자동으로 맞춰져요.' },
  { id: 'station', label: '역 찍기', icon: MapPin, hint: '선로를 누르면 가장 가까운 지점에 역이 놓여요. 다른 노선 역 근처면 환승역이 돼요.' },
]
const TABS = ['노선', '차량·운행', '역', '요금', '실제 노선', '파일'] as const
const inp = 'mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-black'
const btn = 'flex items-center justify-center gap-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm'

function Num({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="text-xs text-neutral-600">
      {label}
      <input type="number" min={0} step={step} value={value} onChange={(e) => onChange(+e.target.value || 0)} className={inp} />
    </label>
  )
}
const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between text-xs text-neutral-600"><span>{k}</span><span>{v}</span></div>
)

// 1. 내장형 OSM 장소 검색창 컴포넌트
function InlinedSearchBar() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [isOpen, setIsOpen] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setIsOpen(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&countrycodes=kr&limit=5`
      )
      const data = await res.json()
      setResults(data)
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (lat: string, lon: string) => {
    const map = mapRef.current
    if (map) {
      map.flyTo([parseFloat(lat), parseFloat(lon)], 16, { duration: 1.2 })
    }
    setIsOpen(false)
    setQuery('')
  }

  return (
    <div className="relative w-64 md:w-72">
      <form onSubmit={handleSearch} className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="건물, 역 검색 (예: 대전한화생명볼파크)"
          className="w-full bg-white text-black text-xs pl-8 pr-7 py-1.5 rounded-lg border border-neutral-300 shadow-sm focus:outline-none focus:border-[#0052a4] placeholder-neutral-400"
        />
        <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 pointer-events-none" />
        {loading && (
          <Loader2 className="w-3.5 h-3.5 text-blue-600 absolute right-2.5 animate-spin" />
        )}
      </form>

      {isOpen && results.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-full bg-white border border-neutral-200 rounded-lg shadow-xl overflow-hidden z-[2000]">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(r.lat, r.lon)}
              className="w-full text-left px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-100 border-b border-neutral-100 last:border-b-0 flex flex-col gap-0.5 cursor-pointer"
            >
              <span className="font-semibold text-black truncate">{r.display_name.split(',')[0]}</span>
              <span className="text-[10px] text-neutral-500 truncate">{r.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// 2. 내장형 커스텀 노선 생성 모달 컴포넌트
function InlinedCustomLineModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const addCustomLine = useRailStore((s) => s.addCustomLine)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#0052a4')
  const [vehicle, setVehicle] = useState<VehicleId>('heavy10')

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const newLine
