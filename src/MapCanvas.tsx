import { Fragment, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useRailStore } from './useRailStore'
import { mapRef } from './mapRef'
import { calc, pathOf, pieces, posAt, project, stationsOn, type LL } from './rail'

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

  const view = useMemo(() => {
    const names = new Map<string, number>()
    const items = lines.map((l) => {
      const path = pathOf(l), sts = stationsOn(l, path)
      sts.forEach((s) => names.set(s.name, (names.get(s.name) ?? 0) + 1))
      return { l, path, sts, parts: pieces(path, sts) }
    })
    return { items, names }
  }, [lines])

  return (
    <MapContainer center={[37.5665, 126.978]} zoom={11} className={`h-full w-full ${mode}-mode`} zoomControl={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" maxZoom={19} />
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
                  weight: p.m === 'elevated' ? (active ? 10 : 8) : p.m === 'surface' ? 4 : active ? 7 : 5, // 고가=굵게, 지상=가늘게
                  dashArray: p.m === 'tbm' || p.m === 'natm' || p.m === 'cut' ? '10 8' : undefined,       // 지하=점선
                }}
                eventHandlers={{
                  click(e) {
                    if (mode !== 'station') return // 그리기 모드는 지도 클릭으로 전달
                    L.DomEvent.stopPropagation(e)
                    addStation(l.id, project(path.pts, path.cum, [e.latlng.lat, e.latlng.lng]).ll)
                  },
                }}
              />
            ))}
            {active && mode === 'draw' && l.points.map((p, i) => (
              <CircleMarker key={i} center={p} radius={3} pathOptions={{ color: l.color, fillColor: '#fff', fillOpacity: 1, weight: 2 }} />
            ))}
            {sts.map((s) => {
              const transfer = (view.names.get(s.name) ?? 0) > 1
              return (
                <CircleMarker key={s.id} center={s.ll} radius={transfer ? 9 : 6}
                  pathOptions={{ color: transfer ? '#1b2430' : l.color, weight: 3, fillColor: '#fff', fillOpacity: 1 }}>
                  <Tooltip permanent direction="right" offset={[8, 0]} className="station-label">{s.name}</Tooltip>
                </CircleMarker>
              )
            })}
          </Fragment>
        )
      })}
    </MapContainer>
  )
}
