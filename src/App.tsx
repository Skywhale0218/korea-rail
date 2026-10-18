import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Hand, MapPin, Pause, Pencil, Play, Trash2, Undo2, ArrowLeftRight, Plus, FolderDown, Upload } from 'lucide-react'
import MapCanvas from './MapCanvas'
import { useRailStore, type Mode } from './useRailStore'
import { BASE_FARE, METHODS, METHOD_LABEL, PRESET_LINES, VEHICLES, calc, fareOf, fmtKRW, route, type Method, type VehicleId } from './rail'
import { download, readLines, toGeoJSON } from './io'
import ImportTab from './ImportTab'
import HeaderBar from './CloudBar'
import { mapRef } from './mapRef'
import { SearchBar } from './SearchBar'
import { CustomLineModal } from './CustomLineModal'

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

function FareTab() {
  const lines = useRailStore((s) => s.lines)
  const names = useMemo(
    () => [...new Set(lines.flatMap((l) => l.stations.map((x) => x.name)))].sort((x, y) => x.localeCompare(y, 'ko')),
    [lines],
  )
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const ready = a !== '' && b !== '' && a !== b
  const r = useMemo(() => (ready ? route(lines, a, b) : undefined), [lines, a, b, ready])
  const opts = names.map((n) => <option key={n}>{n}</option>)
  return (
    <div className="mt-3 grid gap-2">
      <select className={inp} value={a} onChange={(e) => setA(e.target.value)}><option value="">출발역</option>{opts}</select>
      <select className={inp} value={b} onChange={(e) => setB(e.target.value)}><option value="">도착역</option>{opts}</select>
      {ready && r === null && <p className="text-sm text-[#0052a4]">두 역이 이어져 있지 않아요. 환승하려면 두 노선의 역 이름이 같아야 해요.</p>}
      {r && (
        <div className="rounded-xl bg-white p-3 border border-neutral-200">
          <div className="text-xs text-neutral-600">요금 (성인 교통카드 기준)</div>
          <div className="text-2xl font-bold">{fareOf(r.km).toLocaleString()}원</div>
          <Row k="거리" v={`${r.km.toFixed(1)}km`} />
          <Row k="환승" v={`${r.transfers}회`} />
          <Row k="소요시간(대략)" v={`${Math.round((r.km / 35) * 60 + r.transfers * 4)}분`} />
          <Row k="이용 노선" v={r.lineIds.map((id) => lines.find((l) => l.id === id)?.name ?? '').join(' → ')} />
        </div>
      )}
      <p className="text-xs text-neutral-500">
        기본 {BASE_FARE.toLocaleString()}원(10km), 이후 5km마다 100원, 50km 초과는 8km마다 100원으로 가정했어요. 거리는 선로를 따라 잰 값이고, 소요시간은 평균 35km/h·환승 4분 가정이에요.
      </p>
    </div>
  )
}

export default function App() {
  const s = useRailStore()
  const [tab, setTab] = useState<(typeof TABS)[number]>('노선')
  const fileRef = useRef<HTMLInputElement>(null)
  const [panel, setPanel] = useState(true)
  const [customModal, setCustomModal] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.invalidateSize(), 80)
    return () => clearTimeout(t)
  }, [panel])

  const active = s.lines.find((l) => l.id === s.activeId)
  const c = useMemo(() => (active ? calc(active, s.overhead) : null), [active, s.overhead])
  const grand = useMemo(() => s.lines.reduce((a, l) => a + calc(l, s.overhead).total, 0), [s.lines, s.overhead])
  const tw = active ? METHODS.reduce((a, m) => a + active.mix[m], 0) || 1 : 1

  const onFile = async (f?: File) => {
    if (!f) return
    try { s.importLines(readLines(await f.text())) } catch (e) { alert(`불러오지 못했어요. ${(e as Error).message}`) }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="flex h-dvh flex-col bg-white text-black">
      {/* 상단 글로벌 헤더 바 */}
      <header className="relative z-[1100] flex h-14 shrink-0 items-center justify-between gap-3 border-b border-neutral-300 bg-white px-4">
        <div className="flex items-center gap-3">
          <h1 className="title-font truncate text-xl text-black">대한민국 철도 노선 시뮬레이터</h1>
          {/* 조건 3: OpenStreetMap 장소/건물 검색창 */}
          <SearchBar />
        </div>

        <div className="flex items-center gap-2">
          {/* 조건 7: 초기 화면에서도 접근 가능한 JSON 불러오기/저장 버튼 */}
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs hover:border-[#0052a4] hover:text-[#0052a4]"
            title="JSON 파일 불러오기"
          >
            <Upload size={14} className="text-emerald-600" /> JSON 열기
          </button>
          <button
            onClick={() => download('korea-rail.json', JSON.stringify({ lines: s.lines }))}
            className="flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs hover:border-[#0052a4] hover:text-[#0052a4]"
            title="현재 노선 JSON 저장"
          >
            <FolderDown size={14} className="text-blue-600" /> JSON 저장
          </button>
          <HeaderBar />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="relative min-h-0 flex-1">
          <MapCanvas />

          <button onClick={() => setPanel(!panel)}
            className="absolute right-3 top-3 z-[1000] flex items-center gap-1 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm shadow hover:border-[#0052a4] hover:text-[#0052a4]"
            aria-label={panel ? '노선 패널 접기' : '노선 패널 열기'}>
            {panel ? <>접기 <ChevronRight size={16} /></> : <><ChevronLeft size={16} /> 노선 패널</>}
          </button>

          {/* 배속 및 재생 컨트롤 */}
          <div className="absolute left-3 top-3 z-[1000] flex items-center gap-1 rounded-xl bg-white/95 p-1.5 shadow">
            <button onClick={s.togglePlay} className="rounded-lg border border-neutral-300 bg-white p-1.5" aria-label={s.playing ? '일시정지' : '재생'}>
              {s.playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            {[1, 4, 10, 25].map((v) => (
              <button key={v} onClick={() => s.setSpeed(v)}
                className={`rounded-lg px-2 py-1 text-sm ${s.speed === v ? 'bg-[#0052a4] text-white' : 'border border-neutral-300 bg-white'}`}>{v}×</button>
            ))}
          </div>

          {/* 조건 5: 선 긋기 모드 시 지도 하단에 나타나는 연장 방향 전환 컨트롤 */}
          {s.mode === 'draw' && active && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 rounded-xl border border-neutral-300 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm">
              <span className="text-xs text-neutral-600">연장 기준:</span>
              <button
                onClick={s.toggleExtendDirection}
                className="flex items-center gap-1.5 rounded-lg border border-[#0052a4] bg-[#0052a4]/10 px-2.5 py-1 text-xs font-semibold text-[#0052a4] hover:bg-[#0052a4] hover:text-white transition"
              >
                <ArrowLeftRight size={13} />
                {s.extendDirection === 'start' ? '시점(출발역) 방면 연장' : '종점 방면 연장'}
              </button>
            </div>
          )}
        </div>

        {panel && <aside className="max-h-[52vh] w-full shrink-0 overflow-y-auto border-t border-neutral-300 bg-white p-4 md:max-h-none md:w-96 md:border-l md:border-t-0">
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {MODES.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => s.setMode(id)}
                className={`${btn} ${s.mode === id ? '!border-[#0052a4] !bg-[#0052a4] !text-white' : ''}`}><Icon size={15} />{label}</button>
            ))}
          </div>
          <p className="mt-2 text-xs text-neutral-600">{MODES.find((m) => m.id === s.mode)?.hint}</p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {s.lines.map((l) => (
              <button key={l.id} onClick={() => s.setActive(l.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${l.id === s.activeId ? 'border-[#0052a4] bg-white font-semibold' : 'border-neutral-300 bg-white'}`}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />{l.name}
              </button>
            ))}

            {/* 조건 6: 커스텀 노선 만들기 버튼 */}
            <button
              onClick={() => setCustomModal(true)}
              className="flex items-center gap-1 rounded-full border border-neutral-300 bg-white px-3 py-1 text-sm font-medium hover:border-[#0052a4] hover:text-[#0052a4]"
            >
              <Plus size={13} /> 직접 노선 생성
            </button>

            <select className="rounded-full border border-dashed border-neutral-300 bg-white px-3 py-1 text-sm" value=""
              onChange={(e) => { const p = PRESET_LINES[+e.target.value]; s.newLine(p) }}>
              <option value="" disabled>+ 프리셋 노선</option>
              {PRESET_LINES.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
            </select>
          </div>

          {active && c ? (
            <>
              <section className="mt-3 rounded-xl bg-white p-3 border border-neutral-200">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-neutral-600">예상 총 사업비 · {c.km.toFixed(2)}km · 역 {active.stations.length}개</span>
                </div>
                <div className="text-2xl font-bold">{fmtKRW(c.total)}</div>
                <div className="mt-1 space-y-0.5">
                  <Row k="토목(선로)" v={fmtKRW(c.civil)} />
                  <Row k="역사" v={fmtKRW(c.sta)} />
                  <Row k={`차량${c.ops ? ` (${c.ops.N}+${c.ops.res}편성)` : ''}`} v={fmtKRW(c.veh)} />
                  <Row k={`부대비·차량기지(${Math.round(s.overhead * 100)}%)`} v={fmtKRW(c.over)} />
                </div>
                {s.lines.length > 1 && <p className="mt-2 border-t pt-2 text-sm">전체 노선 합계 <b>{fmtKRW(grand)}</b></p>}
              </section>

              <div className="mt-3 grid grid-cols-6 border-b border-neutral-300 text-center">
                {TABS.map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`whitespace-nowrap px-0.5 py-2 text-[13px] ${tab === t ? 'border-b-2 border-[#0052a4] font-semibold' : 'text-neutral-600'}`}>{t}</button>
                ))}
              </div>

              {tab === '노선' && (
                <div className="mt-3 grid gap-3">
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <label className="text-xs text-neutral-600">노선 이름
                      <input value={active.name} onChange={(e) => s.update({ name: e.target.value })} className={inp} /></label>
                    <label className="text-xs text-neutral-600">색
                      <input type="color" value={active.color} onChange={(e) => s.update({ color: e.target.value })} className="mt-1 block h-[38px] w-12 rounded-lg border border-neutral-300 bg-white p-1" /></label>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-600">공법 비율 (합계 자동 100%)</div>
                    {METHODS.map((m) => (
                      <label key={m} className="mt-1 grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-2 text-sm">
                        {METHOD_LABEL[m]}
                        <input type="range" min={0} max={100} value={active.mix[m]} onChange={(e) => s.setMix(m, +e.target.value)} />
                        <span className="text-right text-xs">{Math.round((active.mix[m] / tw) * 100)}%</span>
                      </label>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={active.loop} onChange={(e) => s.update({ loop: e.target.checked })} />
                    순환선 (마지막 점과 첫 점을 이어요 · 점 3개 이상)
                  </label>
                  <label className="text-xs text-neutral-600">곡선 부드러움 {Math.round(active.smooth * 100)}%
                    <input type="range" min={0} max={1} step={0.05} value={active.smooth} onChange={(e) => s.update({ smooth: +e.target.value })} className="w-full" /></label>
                  <p className={`text-xs ${c.minR < c.vehicle.minR ? 'text-[#0052a4]' : 'text-neutral-600'}`}>
                    최소 곡선반경 {Number.isFinite(c.minR) ? `${Math.round(c.minR)}m` : '직선'} (권장 {c.vehicle.minR}m 이상)
                    {c.minR < c.vehicle.minR && ' — 급커브예요. 부드러움을 올리거나 점을 더 멀리 찍어 보세요.'}
                  </p>