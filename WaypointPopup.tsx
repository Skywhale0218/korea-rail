import { useState } from 'react'
import { Popup } from 'react-leaflet'
import { hav, shift, type LL } from './rail'
import { useRailStore } from './useRailStore'

const btn = 'rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-black hover:border-[#0052a4] hover:text-[#0052a4]'

function Body({ lineId, i }: { lineId: string; i: number }) {
  const l = useRailStore((s) => s.lines.find((x) => x.id === lineId))
  const { removePoint, movePoint, addStation, selectPoint } = useRailStore.getState()
  const [step, setStep] = useState(5)
  if (!l || !l.points[i]) return null
  const p = l.points[i]
  const n = l.points.length
  const role = l.loop ? '순환선의 점' : i === 0 ? '시점' : i === n - 1 ? '종점' : '중간 점'
  const nudge = (e: number, nn: number) => movePoint(i, shift(p, e * step, nn * step))
  const setCoord = (lat: string, lng: string) => {
    const a = parseFloat(lat), b = parseFloat(lng)
    if (!isFinite(a) || !isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return
    movePoint(i, [a, b])
  }
  const toStation = () => {
    if (l.stations.some((s) => hav(s.ll, p) < 20)) { alert('이 점 가까이에 이미 역이 있어요.'); return }
    addStation(l.id, p)
    selectPoint(null)
  }
  const arrow = 'h-9 w-9 rounded-lg border border-neutral-300 bg-white text-base text-black hover:border-[#0052a4] hover:text-[#0052a4]'
  return (
    <div className="grid gap-2 text-sm text-black" style={{ minWidth: 220 }}>
      <div className="font-bold">선형 점 {i + 1}/{n} <span className="font-normal text-neutral-500">· {role}</span></div>
      <div className="grid grid-cols-2 gap-1.5">
        <button className={`${btn} !border-[#0052a4] !bg-[#0052a4] !text-white`} onClick={() => removePoint(i)}>이 점 삭제</button>
        <button className={btn} onClick={toStation}>역으로 변환</button>
      </div>
      <div className="grid gap-1.5 rounded-lg border border-neutral-200 p-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold">좌표 미세 조정</span>
          <select value={step} onChange={(e) => setStep(+e.target.value)} className="rounded border border-neutral-300 bg-white px-1 py-0.5 text-xs">
            <option value={1}>1m</option><option value={5}>5m</option><option value={20}>20m</option><option value={100}>100m</option>
          </select>
        </div>
        <div className="mx-auto grid grid-cols-3 gap-1">
          <span /><button className={arrow} onClick={() => nudge(0, 1)} aria-label="북쪽">↑</button><span />
          <button className={arrow} onClick={() => nudge(-1, 0)} aria-label="서쪽">←</button>
          <span className="grid place-items-center text-xs text-neutral-500">{step}m</span>
          <button className={arrow} onClick={() => nudge(1, 0)} aria-label="동쪽">→</button>
          <span /><button className={arrow} onClick={() => nudge(0, -1)} aria-label="남쪽">↓</button><span />
        </div>
        <CoordInputs key={`${p[0]},${p[1]}`} p={p} onSet={setCoord} />
      </div>
    </div>
  )
}

function CoordInputs({ p, onSet }: { p: LL; onSet: (lat: string, lng: string) => void }) {
  const [lat, setLat] = useState(p[0].toFixed(6))
  const [lng, setLng] = useState(p[1].toFixed(6))
  const commit = () => onSet(lat, lng)
  const cls = 'w-full rounded border border-neutral-300 bg-white px-1.5 py-1 text-xs text-black'
  return (
    <div className="grid grid-cols-2 gap-1">
      <label className="text-xs text-neutral-600">위도<input className={cls} value={lat} onChange={(e) => setLat(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} /></label>
      <label className="text-xs text-neutral-600">경도<input className={cls} value={lng} onChange={(e) => setLng(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} /></label>
    </div>
  )
}

/** 선로의 점을 누르면 열리는 팝업 */
export default function WaypointPopup() {
  const selPt = useRailStore((s) => s.selPt)
  const p = useRailStore((s) => (s.selPt ? s.lines.find((x) => x.id === s.selPt!.lineId)?.points[s.selPt!.i] : undefined))
  if (!selPt || !p) return null
  return (
    <Popup
      key={`${selPt.lineId}-${selPt.i}`}
      position={p}
      offset={[0, -6]}
      eventHandlers={{
        remove: () => {
          const x = useRailStore.getState().selPt
          if (x && x.lineId === selPt.lineId && x.i === selPt.i) useRailStore.getState().selectPoint(null)
        },
      }}
    >
      <Body lineId={selPt.lineId} i={selPt.i} />
    </Popup>
  )
}
