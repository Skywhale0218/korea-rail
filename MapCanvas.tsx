import { Fragment, useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Polyline, Polygon, CircleMarker, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useRailStore } from './useRailStore'
import { mapRef } from './mapRef'
import { calc, hav, insertIndex, offsetPts, pathOf, pieces, posAt, project, rawS, stationsOn, WALK_SPEED, type LL } from './rail'
import WaypointPopup from './WaypointPopup'

/** 지도 확대 단계를 알려줘요 (역 이름은 확대했을 때만 보여요) */
function ZoomWatch({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMap()
  useEffect(() => { onZoom(map.getZoom()) }, [map, onZoom])
  useMapEvents({ zoomend: () => onZoom(map.getZoom()) })
  return null
}

/** 그리기: 기존 노선의 꼭짓점·역·선로 근처를 누르면 자동으로 맞춰요 */
function Clicks() {
  const map = useMap()
  useMapEvents({
    click(e) {
      const st = useRailStore.getState()
      const ll: LL = [e.latlng.lat, e.latlng.lng]
      if (st.mode === 'footprint') { st.addDraft(ll); return }
      if (st.mode === 'entrance') { if (st.sel) st.addEntrance(st.sel, ll); return }
      if (st.mode !== 'draw') return
      const px = (a: LL) => map.latLngToLayerPoint(a)
      const here = px(ll)
      let best = Infinity
      let snap: LL | null = null
      for (const l of st.lines) {
        if (l.id === st.activeId) continue
        for (const c of [...l.points, ...l.stations.map((s) => s.ll)]) {
          const d = here.distanceTo(px(c))
          if (d < 16 && d < best) { best = d; snap = c }
        }
        const path = pathOf(l)
        if (path.pts.length > 1) {
          const p = project(path.pts, path.cum, ll)
          const d = here.distanceTo(px(p.ll))
          if (d < 10 && d < best) { best = d; snap = p.ll }
        }
      }
      st.addPoint(snap ?? ll)
    },
  })
  return null
}


const iconCache = new Map<string, L.DivIcon>()
type WpKind = 'pt' | 'mid' | 'start' | 'end' | 'sel'
function wpIcon(kind: WpKind, color: string) {
  const key = kind + color
  let ic = iconCache.get(key)
  if (!ic) {
    const size = kind === 'mid' ? 10 : kind === 'start' || kind === 'end' ? 18 : 14
    ic = L.divIcon({ className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2], html: `<div class="wp wp-${kind}" style="--c:${color}"></div>` })
    iconCache.set(key, ic)
  }
  return ic
}
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
const entIcon = (name: string) => L.divIcon({ className: '', iconSize: [26, 18], iconAnchor: [13, 9], html: `<div class="ent">${esc(name)}</div>` })

/** 선로 위 점(웨이포인트) 마커 + 중간 핸들. 점을 누르면 팝업, 끌면 이동, 중간 핸들을 누르거나 끌면 점 추가 */
function WaypointLayer({ zoom }: { zoom: number }) {
  const mode = useRailStore((s) => s.mode)
  const l = useRailStore((s) => s.lines.find((x) => x.id === s.activeId))
  const selPt = useRailStore((s) => s.selPt)
  const path = useMemo(() => (l ? pathOf(l) : null), [l])
  const sj = useMemo(() => (l && path ? rawS(l, path) : []), [l, path])
  if (!l || !path || (mode !== 'draw' && mode !== 'edit') || zoom < 12) return null
  const { selectPoint, movePoint, insertPoint } = useRailStore.getState()
  const n = l.points.length
  const mids: { j: number; ll: LL }[] = []
  if (mode === 'edit' && zoom >= 14 && n >= 2 && n <= 800 && path.cum.length) {
    const total = path.cum[path.cum.length - 1]
    const segs = l.loop && n >= 3 ? n : n - 1
    for (let j = 0; j < segs; j++) {
      const a = sj[j], b = j + 1 < n ? sj[j + 1] : total
      if (b - a > 3) mids.push({ j, ll: posAt(path, (a + b) / 2) })
    }
  }
  return (
    <>
      {mids.map((m) => (
        <Marker key={`m${m.j}-${n}`} position={m.ll} icon={wpIcon('mid', l.color)} draggable
          eventHandlers={{
            click: () => insertPoint(m.j + 1, m.ll),
            dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); insertPoint(m.j + 1, [p.lat, p.lng]) },
          }} />
      ))}
      {l.points.map((p, i) => {
        const sel = selPt?.lineId === l.id && selPt.i === i
        const kind: WpKind = sel ? 'sel' : !l.loop && i === 0 && n > 1 ? 'start' : !l.loop && i === n - 1 && n > 1 ? 'end' : 'pt'
        return (
          <Marker key={`p${i}`} position={p} icon={wpIcon(kind, l.color)} draggable zIndexOffset={kind === 'pt' ? 0 : 500}
            eventHandlers={{
              click: () => selectPoint({ lineId: l.id, i }),
              dragend: (e) => { const q = (e.target as L.Marker).getLatLng(); movePoint(i, [q.lat, q.lng]) },
            }}>
            {(kind === 'start' || kind === 'end') && (
              <Tooltip permanent direction="top" offset={[0, -10]} className="station-label">{kind === 'start' ? '시점' : '종점'}</Tooltip>
            )}
          </Marker>
        )
      })}
    </>
  )
}

function RegisterMap() {
  const map = useMap()
  useEffect(() => { mapRef.current = map; return () => { mapRef.current = null } }, [map])
  return null
}

/** 열차 애니메이션: 역 정차 + 가감속, 등간격 배차 */
function TrainLayer() {
  const map = useMap()
  const lines = useRailStore((s) => s.lines)
  useEffect(() => {
    const group = L.layerGroup().addTo(map)
    const sims = lines.flatMap((l) => {
      const c = calc(l, 0)
      if (!c.ops) return []
      const ops = c.ops
      return Array.from({ length: ops.N }, (_, k) => ({
        path: c.path, ops, off: (k * ops.cyc) / ops.N,
        m: L.circleMarker(c.path.pts[0], { radius: 6, color: '#fff', weight: 2, fillColor: l.color, fillOpacity: 1, interactive: false }).addTo(group),
      }))
    })
    let T = 0, last = performance.now(), raf = 0
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.2)
      last = now
      const st = useRailStore.getState()
      if (st.playing) {
        T += dt * st.speed
        for (const a of sims) {
          const tau = (T + a.off) % a.ops.cyc
          let g = a.ops.legs[0]
          for (const x of a.ops.legs) { if (x.t0 <= tau) g = x; else break }
          const q = Math.min(1, (tau - g.t0) / g.t), e = q * q * (3 - 2 * q)
          a.m.setLatLng(posAt(a.path, g.s0 + (g.s1 - g.s0) * e))
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); group.remove() }
  }, [map, lines])
  return null
}

export default function MapCanvas() {
  const lines = useRailStore((s) => s.lines)
  const activeId = useRailStore((s) => s.activeId)
  const mode = useRailStore((s) => s.mode)
  const addStation = useRailStore((s) => s.addStation)
  const sel = useRailStore((s) => s.sel)
  const walkFrom = useRailStore((s) => s.walkFrom)
  const draft = useRailStore((s) => s.draft)

  const view = useMemo(() => {
    const names = new Map<string, number>()
    const pos = new Map<string, LL>() // 도보 환승선용: 역 위치
    const items = lines.map((l) => {
      const path = pathOf(l), sts = stationsOn(l, path)
      sts.forEach((s) => { names.set(s.name, (names.get(s.name) ?? 0) + 1); pos.set(`${l.id}:${s.id}`, s.ll) })
      return { l, path, sts, parts: pieces(path, sts) }
    })
    return { items, names, pos }
  }, [lines])

  const [zoom, setZoom] = useState(11)
  return (
    <MapContainer center={[37.5665, 126.978]} zoom={11} className={`h-full w-full ${mode}-mode`} zoomControl={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" maxZoom={19} />
      <ZoomWatch onZoom={setZoom} />
      <Clicks />
      <RegisterMap />
      <TrainLayer />
      {view.items.map(({ l, path, sts, parts }) => {
        const active = l.id === activeId
        return (
          <Fragment key={l.id}>
            {path.pts.length > 1 && parts.map((p, i) => {
              const base = {
                color: l.color, opacity: active ? 1 : 0.7,
                weight: p.m === 'elevated' ? (active ? 10 : 8) : p.m === 'surface' ? 4 : active ? 7 : 5, // 고가=굵게, 지상=가늘게
                dashArray: p.m === 'tbm' || p.m === 'natm' || p.m === 'cut' ? '10 8' : undefined,       // 지하=점선
              }
              const handlers = {
                click(e: L.LeafletMouseEvent) {
                  if (mode === 'station') {
                    L.DomEvent.stopPropagation(e)
                    addStation(l.id, project(path.pts, path.cum, [e.latlng.lat, e.latlng.lng]).ll)
                  } else if (mode === 'edit') {
                    L.DomEvent.stopPropagation(e)
                    const st = useRailStore.getState()
                    if (l.id !== st.activeId) { st.setActive(l.id); return }
                    // 선분을 누르면 그 자리에 정거장이 아닌 선형 보정 점을 끼워 넣어요
                    const q = project(path.pts, path.cum, [e.latlng.lat, e.latlng.lng]).ll
                    st.insertPoint(insertIndex(l, path, q), q)
                  }
                },
              }
              if (l.track?.double && zoom >= 16) {
                const half = (l.track.spacing || 8.5) / 2
                return [-1, 1].map((sg) => (
                  <Polyline key={`${i}:${sg}`} positions={offsetPts(p.pts, sg * half)} pathOptions={{ ...base, weight: 3 }} eventHandlers={handlers} />
                ))
              }
              return <Polyline key={i} positions={p.pts} pathOptions={base} eventHandlers={handlers} />
            })}
            {sts.map((s) => {
              const transfer = (view.names.get(s.name) ?? 0) > 1
              return (
                <CircleMarker key={s.id} center={s.ll} radius={transfer ? 9 : 6}
                  pathOptions={{ color: transfer ? '#1b2430' : l.color, weight: 3, fillColor: '#fff', fillOpacity: 1 }}
                  eventHandlers={{
                    click(e) {
                      const st = useRailStore.getState()
                      if (st.mode === 'walk') {
                        L.DomEvent.stopPropagation(e)
                        const msg = st.walkPick({ lineId: l.id, stationId: s.id })
                        if (msg) alert(msg)
                      } else if (st.mode !== 'draw' && st.mode !== 'footprint' && st.mode !== 'entrance') {
                        L.DomEvent.stopPropagation(e)
                        st.selectStation({ lineId: l.id, stationId: s.id })
                      }
                    },
                  }}>
                  {(zoom >= 14 || (transfer && zoom >= 12)) && (
                    <Tooltip permanent direction="right" offset={[8, 0]} className="station-label">{s.name}</Tooltip>
                  )}
                </CircleMarker>
              )
            })}
            {sts.map((s) => {
              const isSel = sel?.lineId === l.id && sel.stationId === s.id
              return (
                <Fragment key={`x${s.id}`}>
                  {s.footprint && s.footprint.length >= 3 && (
                    <Polygon positions={s.footprint} interactive={false}
                      pathOptions={{ color: isSel ? '#0052a4' : l.color, weight: isSel ? 3 : 2, fillColor: l.color, fillOpacity: 0.25 }} />
                  )}
                  {(zoom >= 16 || isSel) && s.entrances?.map((en) => (
                    <Fragment key={en.id}>
                      <Polyline positions={[en.ll, s.ll]} interactive={false} pathOptions={{ color: '#000', weight: 2, dashArray: '2 6', opacity: 0.8 }} />
                      <Marker position={en.ll} icon={entIcon(en.name)} draggable={mode === 'entrance' && isSel}
                        eventHandlers={{ dragend: (e) => { const q = (e.target as L.Marker).getLatLng(); useRailStore.getState().moveEntrance({ lineId: l.id, stationId: s.id }, en.id, [q.lat, q.lng]) } }} />
                    </Fragment>
                  ))}
                  {s.walks?.map((w) => {
                    const b = view.pos.get(`${w.lineId}:${w.stationId}`)
                    if (!b) return null
                    const d = hav(s.ll, b)
                    return (
                      <Polyline key={`w${s.id}:${w.stationId}`} positions={[s.ll, b]} pathOptions={{ color: '#0052a4', weight: 4, dashArray: '2 8', lineCap: 'round' }}>
                        <Tooltip sticky>도보 환승 {Math.round(d)}m · 약 {(d / WALK_SPEED / 60).toFixed(1)}분</Tooltip>
                      </Polyline>
                    )
                  })}
                  {(isSel || (walkFrom?.lineId === l.id && walkFrom.stationId === s.id)) && (
                    <CircleMarker center={s.ll} radius={15} interactive={false} pathOptions={{ color: '#0052a4', weight: 3, fill: false }} />
                  )}
                </Fragment>
              )
            })}
          </Fragment>
        )
      })}
      {mode === 'footprint' && draft.length > 0 && (
        <>
          {draft.length >= 3 ? <Polygon positions={draft} interactive={false} pathOptions={{ color: '#0052a4', weight: 2, dashArray: '6 4', fillColor: '#0052a4', fillOpacity: 0.2 }} />
            : <Polyline positions={draft} interactive={false} pathOptions={{ color: '#0052a4', weight: 2, dashArray: '6 4' }} />}
          {draft.map((p, i) => <CircleMarker key={i} center={p} radius={4} interactive={false} pathOptions={{ color: '#0052a4', fillColor: '#fff', fillOpacity: 1, weight: 2 }} />)}
        </>
      )}
      <WaypointLayer zoom={zoom} />
      <WaypointPopup />
    </MapContainer>
  )
}
