import { Fragment, useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useRailStore } from './useRailStore'
import { mapRef } from './mapRef'
import { calc, pathOf, pieces, posAt, project, stationsOn, type LL } from './rail'

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
      if (st.mode !== 'draw') return
      const ll: LL = [e.latlng.lat, e.latlng.lng]
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
  const removePoint = useRailStore((s) => s.removePoint)
  const insertPoint = useRailStore((s) => s.insertPoint)

  const view = useMemo(() => {
    const names = new Map<string, number>()
    const items = lines.map((l) => {
      const path = pathOf(l), sts = stationsOn(l, path)
      sts.forEach((s) => names.set(s.name, (names.get(s.name) ?? 0) + 1))
      return { l, path, sts, parts: pieces(path, sts) }
    })
    return { items, names }
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
            {path.pts.length > 1 && parts.map((p, i) => (
              <Polyline
                key={i}
                positions={p.pts}
                pathOptions={{
                  color: l.color, opacity: active ? 1 : 0.7,
                  weight: p.m === 'elevated' ? (active ? 10 : 8) : p.m === 'surface' ? 4 : active ? 7 : 5,
                  dashArray: p.m === 'tbm' || p.m === 'natm' || p.m === 'cut' ? '10 8' : undefined,
                }}
                eventHandlers={{
                  click(e) {
                    if (mode === 'station') {
                      L.DomEvent.stopPropagation(e)
                      addStation(l.id, project(path.pts, path.cum, [e.latlng.lat, e.latlng.lng]).ll)
                    } else if (mode === 'draw' && active) {
                      // 조건 4: 지어진 노선 선분 클릭 시 중간 선형 추가 점(points) 삽입
                      L.DomEvent.stopPropagation(e)
                      const clickLL: LL = [e.latlng.lat, e.latlng.lng]
                      if (l.points.length >= 2) {
                        let bestIdx = 1
                        let minDist = Infinity
                        const map = (e as any).target._map as L.Map
                        const clickPt = map.latLngToLayerPoint(clickLL)
                        for (let j = 0; j < l.points.length - 1; j++) {
                          const p1 = map.latLngToLayerPoint(l.points[j])
                          const p2 = map.latLngToLayerPoint(l.points[j + 1])
                          const dist = L.LineUtil.pointToSegmentDistance(clickPt, p1, p2)
                          if (dist < minDist) {
                            minDist = dist
                            bestIdx = j + 1
                          }
                        }
                        insertPoint(bestIdx, clickLL)
                      }
                    }
                  },
                }}
              />
            ))}
            {/* 조건 2: 점 클릭 시 팝업 열리고 개별 삭제 가능 */}
            {active && mode === 'draw' && l.points.map((p, i) => (
              <CircleMarker 
                key={i} 
                center={p} 
                radius={5} 
                pathOptions={{ color: l.color, fillColor: '#fff', fillOpacity: 1, weight: 2 }}
              >
                <Popup closeButton={false}>
                  <div className="p-1 text-center font-sans">
                    <div className="text-[11px] font-bold text-slate-800 mb-1">지점 #{i + 1}</div>
                    <button
                      onClick={() => removePoint(i)}
                      className="px-2 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded text-[10px] font-medium transition cursor-pointer"
                    >
                      이 점 삭제
                    </button>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
            {sts.map((s) => {
              const transfer = (view.names.get(s.name) ?? 0) > 1
              return (
                <CircleMarker key={s.id} center={s.ll} radius={transfer ? 9 : 6}
                  pathOptions={{ color: transfer ? '#1b2430' : l.color, weight: 3, fillColor: '#fff', fillOpacity: 1 }}>
                  {(zoom >= 14 || (transfer && zoom >= 12)) && (
                    <Tooltip permanent direction="right" offset={[8, 0]} className="station-label">{s.name}</Tooltip>
                  )}
                </CircleMarker>
              )
            })}
          </Fragment>
        )
      })}
    </MapContainer>
  )
}