import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { dirAt, hav, pathOf, polyArea, rectAround, stationsOn, VEHICLES, WALK_SPEED } from './rail'
import { useRailStore, type StRef } from './useRailStore'

const btn = 'rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm hover:border-[#0052a4] hover:text-[#0052a4]'
const btnOn = 'rounded-lg border border-[#0052a4] bg-[#0052a4] px-2.5 py-1.5 text-sm text-white'
const num = 'w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-black'
const min = (m: number) => (m / WALK_SPEED / 60).toFixed(1)

/** 선택한 역의 부지(Footprint)·출입구(Entrance)·도보 환승 편집 */
export default function StationDetail({ lineId, stationId }: StRef) {
  const lines = useRailStore((s) => s.lines)
  const mode = useRailStore((s) => s.mode)
  const draft = useRailStore((s) => s.draft)
  const st = useRailStore()
  const line = lines.find((l) => l.id === lineId)
  const ref: StRef = { lineId, stationId }
  const car = line ? VEHICLES[line.vehicle] : null
  const trainLen = car ? car.cars * car.len : 160
  const [len, setLen] = useState(Math.round(trainLen + 20))
  const [wid, setWid] = useState(30)

  const info = useMemo(() => {
    if (!line) return null
    const path = pathOf(line)
    const sts = stationsOn(line, path)
    const s = sts.find((x) => x.id === stationId)
    if (!s) return null
    return { path, s, dir: dirAt(path, s.s) }
  }, [line, stationId])
  if (!line || !info) return null
  const { s, dir } = info

  const area = s.footprint && s.footprint.length >= 3 ? polyArea(s.footprint) : 0
  const autoRect = () => st.patchStation(ref, (x) => ({ ...x, footprint: rectAround(s.ll, dir, len, wid) }))

  // 이 역과 연결된 도보 환승 (어느 쪽 역에 저장돼 있어도 모두 보여요)
  const links: { other: string; otherLine: string; m: number; owner: StRef; target: StRef }[] = []
  for (const l of lines) for (const x of l.stations) for (const w of x.walks ?? []) {
    const a = { lineId: l.id, stationId: x.id }
    const isA = a.lineId === lineId && a.stationId === stationId
    const isB = w.lineId === lineId && w.stationId === stationId
    if (!isA && !isB) continue
    const o = isA ? w : a
    const ol = lines.find((q) => q.id === o.lineId)
    const os = ol?.stations.find((q) => q.id === o.stationId)
    if (!ol || !os) continue
    links.push({ other: os.name, otherLine: ol.name, m: hav(x.ll, os.ll), owner: a, target: { lineId: w.lineId, stationId: w.stationId } })
  }

  return (
    <div className="mt-2 grid gap-3 rounded-lg border border-[#0052a4] p-2.5 text-sm">
      {/* ── 부지 ── */}
      <section className="grid gap-1.5">
        <div className="flex items-center justify-between font-semibold">
          <span>역 부지</span>
          <span className={area ? 'text-[#0052a4]' : 'text-neutral-500'}>{area ? `${Math.round(area).toLocaleString()} ㎡` : '없음'}</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <label className="text-xs text-neutral-600">길이(m)<input className={num} type="number" min={20} value={len} onChange={(e) => setLen(+e.target.value)} /></label>
          <label className="text-xs text-neutral-600">폭(m)<input className={num} type="number" min={10} value={wid} onChange={(e) => setWid(+e.target.value)} /></label>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button className={mode === 'footprint' ? btnOn : btn} onClick={() => st.setMode(mode === 'footprint' ? 'pan' : 'footprint')}>
            {mode === 'footprint' ? `그리는 중 (${draft.length}점)` : '부지 그리기'}
          </button>
          <button className={btn} onClick={autoRect}>자동 사각형</button>
          {s.footprint && <button className={btn} onClick={() => st.patchStation(ref, (x) => ({ ...x, footprint: undefined }))}>부지 삭제</button>}
        </div>
        {mode === 'footprint' && <p className="text-xs text-neutral-600">지도에서 부지 모서리를 차례로 누르고, 3점 이상이면 아래 지도 안내 막대의 [완료]를 누르세요.</p>}
        <p className="text-xs text-neutral-500">자동 사각형은 선로 방향에 맞춰 역 중심에 놓여요. 길이 기본값은 열차 길이(+20m)예요.</p>
      </section>

      {/* ── 출입구 ── */}
      <section className="grid gap-1.5">
        <div className="flex items-center justify-between font-semibold">
          <span>출입구 ({s.entrances?.length ?? 0})</span>
          <button className={mode === 'entrance' ? btnOn : `${btn} flex items-center gap-1`} onClick={() => st.setMode(mode === 'entrance' ? 'pan' : 'entrance')}>
            {mode === 'entrance' ? '추가 중…' : <><Plus size={14} />출입구 추가</>}
          </button>
        </div>
        {mode === 'entrance' && <p className="text-xs text-neutral-600">지도를 눌러 출입구를 찍으세요. 찍은 출입구는 끌어서 옮길 수 있어요. 끝나면 [완료]를 누르세요.</p>}
        {(s.entrances ?? []).map((e) => {
          const d = hav(e.ll, s.ll)
          return (
            <div key={e.id} className="flex items-center gap-1.5">
              <input className={`${num} !w-16`} value={e.name} onChange={(ev) => st.renameEntrance(ref, e.id, ev.target.value)} aria-label="출입구 이름" />
              <span className="min-w-0 flex-1 text-xs text-neutral-600">역 중심까지 {Math.round(d)}m · 도보 약 {min(d)}분</span>
              <button aria-label="출입구 삭제" className="p-1 text-neutral-500 hover:text-[#0052a4]" onClick={() => st.removeEntrance(ref, e.id)}><Trash2 size={15} /></button>
            </div>
          )
        })}
      </section>

      {/* ── 도보 환승 ── */}
      <section className="grid gap-1.5">
        <div className="flex items-center justify-between font-semibold">
          <span>도보 환승 ({links.length})</span>
          <button className={mode === 'walk' ? btnOn : `${btn} flex items-center gap-1`} onClick={() => { if (mode === 'walk') { st.setMode('pan'); return } st.setMode('walk'); useRailStore.setState({ walkFrom: ref }) }}>
            {mode === 'walk' ? '연결할 역 선택 중…' : <><Plus size={14} />도보 환승 추가</>}
          </button>
        </div>
        {mode === 'walk' && <p className="text-xs text-neutral-600">연결할 두 역을 차례로 누르세요. 1km 이내의 인접한 역만 연결돼요. (이 역이 첫 번째로 선택돼요)</p>}
        {links.map((k, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span className="min-w-0 flex-1 text-sm">{k.other} <span className="text-neutral-500">({k.otherLine})</span><br />
              <span className="text-xs text-neutral-600">{Math.round(k.m)}m · 도보 약 {min(k.m)}분</span></span>
            <button aria-label="도보 환승 삭제" className="p-1 text-neutral-500 hover:text-[#0052a4]" onClick={() => st.removeWalk(k.owner, k.target)}><Trash2 size={15} /></button>
          </div>
        ))}
      </section>
    </div>
  )
}
