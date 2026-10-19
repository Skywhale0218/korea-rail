import { calc, VEHICLES, METHOD_LABEL, METHODS, type Line } from './rail'

export function download(name: string, text: string, type = 'application/json') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
}

/** QGIS에서 열 수 있는 GeoJSON (노선=LineString, 역=Point) */
export function toGeoJSON(lines: Line[], overhead: number) {
  const features = lines.flatMap((l) => {
    const c = calc(l, overhead), g = (ll: [number, number]) => [ll[1], ll[0]]
    const tw = METHODS.reduce((a, m) => a + l.mix[m], 0) || 1
    return [
      { type: 'Feature', properties: { name: l.name, color: l.color, vehicle: VEHICLES[l.vehicle].label, km: +c.km.toFixed(3),
          cost_eok: Math.round(c.total), method: METHODS.map((m) => `${METHOD_LABEL[m]} ${Math.round((l.mix[m] / tw) * 100)}%`).join(', ') },
        geometry: { type: 'LineString', coordinates: c.path.pts.map(g) } },
      ...c.sts.map((s) => ({ type: 'Feature', properties: { station: s.name, line: l.name }, geometry: { type: 'Point', coordinates: g(s.ll) } })),
    ]
  })
  return JSON.stringify({ type: 'FeatureCollection', features })
}

export function readLines(text: string): Partial<Line>[] {
  const d = JSON.parse(text)
  const arr = Array.isArray(d) ? d : d.lines
  if (!Array.isArray(arr)) throw new Error('노선 데이터를 찾을 수 없어요.')
  return arr
}
