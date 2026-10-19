import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, FolderOpen, Hand, MapPin, Move, Pause, Pencil, Play, Plus, Save, Trash2, Undo2 } from 'lucide-react'
import MapCanvas from './MapCanvas'
import { useRailStore, type Mode } from './useRailStore'
import { BASE_FARE, METHODS, METHOD_LABEL, PRESET_LINES, SYSTEMS, VEHICLES, calc, fareOf, fmtKRW, route, type Method, type SystemType, type VehicleId } from './rail'
import { download, readLines, toGeoJSON } from './io'
import ImportTab from './ImportTab'
import HeaderBar from './CloudBar'
import { mapRef } from './mapRef'
import SearchBox from './SearchBox'
import NewLineModal from './NewLineModal'
import StationDetail from './StationDetail'

const MODES: { id: Mode; label: string; icon: typeof Hand; hint: string }[] = [
  { id: 'pan', label: '이동', icon: Hand, hint: '지도를 움직여 보세요.' },
  { id: 'draw', label: '선 긋기', icon: Pencil, hint: '지도를 눌러 선로를 이어가세요. 다른 노선 근처를 누르면 자동으로 맞춰져요.' },
  { id: 'station', label: '역 찍기', icon: MapPin, hint: '선로를 누르면 가장 가까운 지점에 역이 놓여요. 다른 노선 역 근처면 환승역이 돼요.' },
  { id: 'edit', label: '선형 편집', icon: Move, hint: '점을 끌면 이동, 점을 누르면 삭제·역 변환 메뉴가 열려요. 선로를 누르거나 점선 핸들을 누르면 그 자리에 점이 추가돼요.' },
]
const EXTRA_HINT: Partial<Record<Mode, string>> = {
  footprint: '역 부지: 지도에서 모서리를 차례로 눌러 3점 이상 찍고 [완료]를 누르세요.',
  entrance: '출입구: 지도를 눌러 출입구를 찍으세요. 끌어서 옮길 수 있어요.',
  walk: '도보 환승: 연결할 다른 역을 눌러 주세요. (1km 이내)',
}
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
  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.invalidateSize(), 80)
    return () => clearTimeout(t)
  }, [panel])
  const active = s.lines.find((l) => l.id === s.activeId)
  const c = useMemo(() => (active ? calc(active, s.overhead) : null), [active, s.overhead])
  const grand = useMemo(() => s.lines.reduce((a, l) => a + calc(l, s.overhead).total, 0), [s.lines, s.overhead])
  const tw = active ? METHODS.reduce((a, m) => a + active.mix[m], 0) || 1 : 1

  const [newOpen, setNewOpen] = useState(false)
  const [drag, setDrag] = useState(false)
  const dragDepth = useRef(0)

  /** 저장된 전체 노선이 한눈에 보이도록 지도를 맞춰요 */
  const fitAll = () => {
    setTimeout(() => {
      const pts = useRailStore.getState().lines.flatMap((l) => [...l.points, ...l.stations.map((x) => x.ll)])
      if (pts.length) mapRef.current?.fitBounds(pts as [number, number][], { padding: [40, 40], maxZoom: 15 })
    }, 60)
  }
  const onFile = async (f?: File) => {
    if (!f) return
    try {
      const ls = readLines(await f.text())
      if (useRailStore.getState().lines.length && !confirm('지금 작업을 불러온 파일 내용으로 바꿀까요?')) return
      s.importLines(ls)
      fitAll()
    } catch (e) { alert(`불러오지 못했어요. ${(e as Error).message}`) }
    finally { if (fileRef.current) fileRef.current.value = '' }
  }
  const isFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
  const saveJson = () => download('korea-rail.json', JSON.stringify({ lines: s.lines }))

  // 역을 지도에서 누르면 '역' 탭으로 이동
  useEffect(() => {
    if (s.sel) { setTab('역'); setPanel(true) }
  }, [s.sel])

  return (
    <div className="flex h-dvh flex-col bg-white text-black"
      onDragEnter={(e) => { if (isFiles(e)) { dragDepth.current++; setDrag(true) } }}
      onDragOver={(e) => { if (isFiles(e)) e.preventDefault() }}
      onDragLeave={(e) => { if (isFiles(e) && --dragDepth.current <= 0) { dragDepth.current = 0; setDrag(false) } }}
      onDrop={(e) => { if (!isFiles(e)) return; e.preventDefault(); dragDepth.current = 0; setDrag(false); onFile(e.dataTransfer.files[0]) }}>
      <header className="relative z-[1100] flex h-14 shrink-0 items-center justify-between gap-2 border-b border-neutral-300 bg-white px-3 sm:px-4">
        <h1 className="title-font min-w-0 truncate text-base text-black sm:text-xl">대한민국 철도 노선 시뮬레이터</h1>
        <div className="flex shrink-0 items-center gap-1.5">
          <button onClick={() => fileRef.current?.click()} title="JSON 파일을 불러오거나 여기로 끌어다 놓으세요"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm hover:border-[#0052a4] hover:text-[#0052a4]">
            <FolderOpen size={15} /><span className="hidden lg:inline">JSON 불러오기</span>
          </button>
          <button onClick={saveJson} disabled={!s.lines.length} title="작업을 JSON 파일로 저장"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm hover:border-[#0052a4] hover:text-[#0052a4] disabled:opacity-40">
            <Save size={15} /><span className="hidden lg:inline">저장</span>
          </button>
          <HeaderBar />
        </div>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </header>
      {drag && (
        <div className="pointer-events-none fixed inset-0 z-[1500] grid place-items-center bg-[#0052a4]/20">
          <div className="rounded-2xl border-2 border-dashed border-[#0052a4] bg-white px-8 py-6 text-lg font-semibold text-[#0052a4] shadow-xl">JSON 파일을 여기에 놓으면 불러와요</div>
        </div>
      )}
      {newOpen && <NewLineModal onClose={() => setNewOpen(false)} />}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <div className="relative min-h-0 flex-1">
        <MapCanvas />
        <SearchBox />
        {(s.mode === 'footprint' || s.mode === 'entrance' || s.mode === 'walk') && (
          <div className="absolute bottom-6 left-1/2 z-[1000] flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-xl border border-[#0052a4] bg-white px-3 py-2 text-sm shadow-lg">
            <span className="text-black">{EXTRA_HINT[s.mode]}{s.mode === 'footprint' ? ` (${s.draft.length}점)` : ''}</span>
            {s.mode === 'footprint' && <button onClick={s.undoDraft} disabled={!s.draft.length} className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 disabled:opacity-40">되돌리기</button>}
            {s.mode === 'footprint'
              ? <button onClick={s.finishFootprint} disabled={s.draft.length < 3} className="rounded-lg border border-[#0052a4] bg-[#0052a4] px-3 py-1 text-white disabled:opacity-40">완료</button>
              : s.mode === 'entrance' && <button onClick={() => s.setMode('pan')} className="rounded-lg border border-[#0052a4] bg-[#0052a4] px-3 py-1 text-white">완료</button>}
            <button onClick={() => (s.mode === 'footprint' ? s.cancelDraft() : s.setMode('pan'))} className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1">취소</button>
          </div>
        )}
        <button onClick={() => setPanel(!panel)}
          className="absolute right-3 top-3 z-[1000] flex items-center gap-1 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm shadow hover:border-[#0052a4] hover:text-[#0052a4]"
          aria-label={panel ? '노선 패널 접기' : '노선 패널 열기'}>
          {panel ? <>접기 <ChevronRight size={16} /></> : <><ChevronLeft size={16} /> 노선 패널</>}
        </button>
        <div className="absolute left-3 top-3 z-[1000] flex items-center gap-1 rounded-xl bg-white/95 p-1.5 shadow">
          <button onClick={s.togglePlay} className="rounded-lg border border-neutral-300 bg-white p-1.5" aria-label={s.playing ? '일시정지' : '재생'}>
            {s.playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          {[1, 4, 10, 25].map((v) => (
            <button key={v} onClick={() => s.setSpeed(v)}
              className={`rounded-lg px-2 py-1 text-sm ${s.speed === v ? 'bg-[#0052a4] text-white' : 'border border-neutral-300 bg-white'}`}>{v}×</button>
          ))}
        </div>
      </div>

      {panel && <aside className="max-h-[52vh] w-full shrink-0 overflow-y-auto border-t border-neutral-300 bg-white p-4 md:max-h-none md:w-96 md:border-l md:border-t-0">
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => s.setMode(id)}
              className={`${btn} !flex-col !gap-0.5 !px-1 !py-2 !text-[13px] ${s.mode === id ? '!border-[#0052a4] !bg-[#0052a4] !text-white' : ''}`}><Icon size={16} />{label}</button>
          ))}
        </div>
        {s.mode === 'draw' && (
          <div className="mt-2 grid grid-cols-2 overflow-hidden rounded-lg border border-neutral-300 text-sm" role="group" aria-label="연장 방향">
            {(['start', 'end'] as const).map((d) => (
              <button key={d} disabled={!!active?.loop} onClick={() => s.setExtend(d)}
                className={`px-2 py-2 disabled:opacity-40 ${s.extend === d ? 'bg-[#0052a4] text-white' : 'bg-white text-black'}`}>
                {d === 'start' ? '◀ 시점 연장' : '종점 연장 ▶'}
              </button>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-neutral-600">
          {EXTRA_HINT[s.mode] ?? MODES.find((m) => m.id === s.mode)?.hint}
          {s.mode === 'draw' && !active?.loop && (s.extend === 'start' ? ' 지금은 첫 점 앞쪽으로 선로가 늘어나요.' : ' 지금은 마지막 점 뒤쪽으로 선로가 늘어나요.')}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {s.lines.map((l) => (
            <button key={l.id} onClick={() => s.setActive(l.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${l.id === s.activeId ? 'border-[#0052a4] bg-white font-semibold' : 'border-neutral-300 bg-white'}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />{l.name}
            </button>
          ))}
          <button onClick={() => setNewOpen(true)}
            className="flex items-center gap-1 rounded-full border border-[#0052a4] bg-[#0052a4] px-3 py-1 text-sm text-white hover:bg-[#003f80]"><Plus size={14} />새 노선 만들기</button>
          <select className="rounded-full border border-dashed border-neutral-300 bg-white px-3 py-1 text-sm" value=""
            onChange={(e) => { const p = PRESET_LINES[+e.target.value]; s.newLine(p) }}>
            <option value="" disabled>빠른 추가</option>
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
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-neutral-600">시스템 유형
                    <select className={inp} value={active.system ?? ''}
                      onChange={(e) => { const k = e.target.value as SystemType; if (k) s.update({ system: k, vehicle: SYSTEMS[k].vehicle, vmax: SYSTEMS[k].vmax }) }}>
                      <option value="" disabled>선택 안 함</option>
                      {Object.entries(SYSTEMS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select></label>
                  <label className="text-xs text-neutral-600">설계 최고속도 (km/h)
                    <input type="number" min={10} max={400} className={inp} value={active.vmax ?? VEHICLES[active.vehicle].vmax}
                      onChange={(e) => s.update({ vmax: +e.target.value || undefined })} /></label>
                </div>
                <p className="-mt-1 text-[11px] text-neutral-500">시스템 유형을 바꾸면 차량과 최고속도도 그 유형의 기본값으로 바뀌어요.</p>
                <div className="rounded-lg border border-neutral-200 p-2">
                  <div className="text-xs text-neutral-600">선로 궤도</div>
                  <div className="mt-1 grid grid-cols-2 overflow-hidden rounded-lg border border-neutral-300 text-sm">
                    {([false, true] as const).map((dbl) => (
                      <button key={String(dbl)} onClick={() => s.update({ track: { double: dbl, spacing: active.track?.spacing ?? 8.5 } })}
                        className={`py-1.5 ${!!active.track?.double === dbl ? 'bg-[#0052a4] text-white' : 'bg-white text-black'}`}>{dbl ? '복선 (Via Dupla)' : '단선'}</button>
                    ))}
                  </div>
                  {active.track?.double && (
                    <label className="mt-1.5 block text-xs text-neutral-600">궤도 간격 (m) · 16단계 이상 확대하면 두 줄로 보여요
                      <input type="number" min={3} max={30} step={0.5} className={inp} value={active.track.spacing}
                        onChange={(e) => s.update({ track: { double: true, spacing: +e.target.value || 8.5 } })} /></label>
                  )}
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
                <label className="text-xs text-neutral-600">부대비·차량기지 가산율 {Math.round(s.overhead * 100)}%
                  <input type="range" min={0} max={0.5} step={0.01} value={s.overhead} onChange={(e) => s.setOverhead(+e.target.value)} className="w-full" /></label>
                <div className="flex gap-2">
                  <button onClick={s.undoPoint} className={`${btn} flex-1`}><Undo2 size={14} /> {s.extend === 'start' ? '첫 점 취소' : '마지막 점 취소'}</button>
                  <button onClick={() => s.removeLine(active.id)} className={`${btn} border-neutral-300 text-[#0052a4]`}><Trash2 size={14} /> 삭제</button>
                </div>
              </div>
            )}

            {tab === '차량·운행' && (
              <div className="mt-3 grid gap-3">
                <label className="text-xs text-neutral-600">차량 시스템
                  <select className={inp} value={active.vehicle} onChange={(e) => s.update({ vehicle: e.target.value as VehicleId })}>
                    <optgroup label="기본 규격">
                      {Object.entries(VEHICLES).filter(([, v]) => !v.real).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </optgroup>
                    <optgroup label="수도권 전철 실제 전동차">
                      {Object.entries(VEHICLES).filter(([, v]) => v.real).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </optgroup>
                  </select></label>
                <div className="grid grid-cols-3 gap-2">
                  <Num label="정차(초)" value={active.dwell} onChange={(v) => s.update({ dwell: v })} />
                  <Num label="배차 목표(초)" value={active.head} onChange={(v) => s.update({ head: v })} />
                  <Num label="편성 수" value={active.fleet} onChange={(v) => s.update({ fleet: v })} />
                </div>
                {VEHICLES[active.vehicle].est && <p className="text-xs text-[#0052a4]">※ 일부 값은 확인하지 못해 추정했어요: {VEHICLES[active.vehicle].est}</p>}
                <p className="text-xs text-neutral-500">배차 목표·편성 수는 0이면 자동이에요. 차량 규격은 대략값이라 실제와 다를 수 있어요.</p>
                {c.ops ? (
                  <div className="rounded-xl bg-white p-3 border border-neutral-200">
                    <Row k="편성 길이 / 정원" v={`${c.ops.trainLen}m / ${c.ops.trainCap.toLocaleString()}명`} />
                    <Row k="1회 왕복" v={`${Math.round(c.ops.cyc / 60)}분 (표정 ${c.ops.avg.toFixed(0)}km/h)`} />
                    <Row k="배차간격" v={`${Math.floor(c.ops.head / 60)}분 ${Math.round(c.ops.head % 60)}초`} />
                    <div className="mt-2 text-xs text-neutral-600">첨두시 최대 수송력 (PPHPD)</div>
                    <div className="text-xl font-bold">{Math.round(c.ops.perH).toLocaleString()}명/h/방향</div>
                  </div>
                ) : <p className="text-sm text-neutral-600">역을 2개 이상 찍으면 운행 지표와 열차가 나타나요.</p>}
              </div>
            )}

            {tab === '역' && (
              <div className="mt-3 grid gap-2">
                {c.sts.length === 0 && <p className="text-sm text-neutral-600">‘역 찍기’ 모드에서 선로를 눌러 역을 추가하세요.</p>}
                {c.sts.map((st, i) => (
                  <div key={st.id} className={`rounded-lg bg-white p-2 border ${s.sel?.stationId === st.id ? 'border-[#0052a4]' : 'border-neutral-200'}`}>
                    <div className="flex items-center gap-2">
                      <input value={st.name} onChange={(e) => s.updateStation(st.id, { name: e.target.value })} className={`${inp} !mt-0`} />
                      <span className="w-16 shrink-0 text-right text-xs text-neutral-600">{i ? `${((st.s - c.sts[i - 1].s) / 1000).toFixed(2)}km` : '시점'}</span>
                      <button onClick={() => s.removeStation(st.id)} className="rounded-lg border border-neutral-300 bg-white p-2" aria-label="역 삭제"><Trash2 size={14} /></button>
                    </div>
                    <button onClick={() => { if (s.sel?.stationId === st.id) { s.selectStation(null); s.setMode('pan') } else { s.setMode('pan'); s.selectStation({ lineId: active.id, stationId: st.id }); const m = mapRef.current; if (m) m.flyTo(st.ll, Math.max(m.getZoom(), 16), { duration: 0.8 }) } }}
                      className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs hover:border-[#0052a4] hover:text-[#0052a4]">
                      {s.sel?.stationId === st.id ? '부지·출입구·환승 닫기' : '부지·출입구·도보 환승 편집'}{st.footprint ? ' · 부지 있음' : ''}{st.entrances?.length ? ` · 출입구 ${st.entrances.length}` : ''}
                    </button>
                    {s.sel?.lineId === active.id && s.sel.stationId === st.id && <StationDetail lineId={active.id} stationId={st.id} />}
                    {(i < c.sts.length - 1 || active.loop) && (
                      <div className="mt-1.5 flex gap-2">
                        <select
                          className={`${inp} !mt-0 !py-1.5 text-xs`}
                          value={st.method ?? ''}
                          onChange={(e) => s.updateStation(st.id, { method: (e.target.value || undefined) as Method | undefined })}
                        >
                          <option value="">다음 역까지: 기본(공법 비율)</option>
                          {METHODS.map((m) => <option key={m} value={m}>다음 역까지: {METHOD_LABEL[m]}</option>)}
                        </select>
                        <input
                          type="number" min={0} step={5} placeholder="제한 km/h" title="이 구간 속도 제한 (km/h, 비우면 제한 없음)"
                          value={st.vlimit ?? ''}
                          onChange={(e) => s.updateStation(st.id, { vlimit: +e.target.value || undefined })}
                          className={`${inp} !mt-0 !w-24 shrink-0 !py-1.5 text-xs`}
                        />
                      </div>
                    )}
                  </div>
                ))}
                <p className="text-xs text-neutral-500">다른 노선 역과 이름이 같으면 환승역(검은 테두리)으로 표시돼요. 구간 속도 제한은 곡선·시설 한계 구간에 쓰세요.</p>
              </div>
            )}

            {tab === '요금' && <FareTab />}

            {tab === '실제 노선' && <ImportTab />}

            {tab === '파일' && (
              <div className="mt-3 grid gap-2">
                <button className={btn} onClick={saveJson}>JSON 저장</button>
                <button className={btn} onClick={() => fileRef.current?.click()}>JSON 불러오기</button>
                <button className={btn} onClick={() => download('korea-rail.geojson', toGeoJSON(s.lines, s.overhead), 'application/geo+json')}>GeoJSON 내보내기 (QGIS)</button>
                <p className="text-xs text-neutral-500">작업 내용은 이 브라우저에 자동 저장돼요. 다른 기기로 옮기려면 JSON으로 저장하세요.</p>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="mt-6 text-sm text-neutral-600">지도를 눌러 첫 번째 노선을 그리거나, 아래에서 실제 노선을 불러오세요.</p>
            <ImportTab />
          </>
        )}
        <p className="mt-4 text-[11px] leading-snug text-neutral-500">사업비·차량 단가는 임의 가정값이에요. src/rail.ts 위쪽에서 수정할 수 있어요.</p>
      </aside>}
      </div>
    </div>
  )
}
