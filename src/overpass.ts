/* OpenStreetMap(Overpass API)에서 실제 지하철·경전철 노선을 가져와요. 브라우저에서 직접 호출하므로 서버가 필요 없어요. */
import type { Line, LL } from './rail'

export type BBox = [number, number, number, number] // 남, 서, 북, 동
export const REGIONS: { id: string; label: string; bbox: BBox }[] = [
  { id: 'seoul', label: '수도권 (서울·인천·경기)', bbox: [36.95, 126.45, 37.95, 127.6] },
  { id: 'busan', label: '부산', bbox: [35.0, 128.8, 35.4, 129.3] },
  { id: 'daegu', label: '대구', bbox: [35.7, 128.4, 36.0, 128.8] },
  { id: 'daejeon', label: '대전', bbox: [36.2, 127.3, 36.5, 127.55] },
  { id: 'gwangju', label: '광주', bbox: [35.05, 126.75, 35.25, 126.95] },
]
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']

export interface Stop { id: number; name: string; ll: LL }
export interface Found { key: string; name: string; color?: string; stops: Stop[]; loop: boolean }
interface El {
  type: string; id: number; tags?: Record<string, string>; lat?: number; lon?: number
  members?: { type: string; ref: number; role: string }[]
}

export async function fetchRoutes(b: BBox): Promise<Found[]> {
  const q = `[out:json][timeout:90];rel["route"~"^(subway|light_rail)$"](${b.join(',')})->.r;.r out body;node(r.r);out body;`
  let data: { elements: El[] } | null = null
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(q),
      })
      if (res.ok) { data = await res.json(); break }
    } catch { /* 다음 서버 시도 */ }
  }
  if (!data) throw new Error('OpenStreetMap 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.')

  const nodes = new Map<number, El>()
  data.elements.forEach((e) => { if (e.type === 'node') nodes.set(e.id, e) })

  const out: Found[] = []
  for (const r of data.elements) {
    if (r.type !== 'relation' || !r.members) continue
    let stops: Stop[] = []
    for (const m of r.members) {
      if (m.type !== 'node' || !m.role.startsWith('stop')) continue
      const n = nodes.get(m.ref)
      if (!n || n.lat == null || n.lon == null) continue
      const name = n.tags?.name ?? n.tags?.['name:ko'] ?? `정류장 ${stops.length + 1}`
      if (stops.length && stops[stops.length - 1].name === name) continue // 같은 역의 승하차 중복 제거
      stops.push({ id: n.id, name, ll: [n.lat, n.lon] })
    }
    if (stops.length < 2) continue
    const loop = stops.length > 3 && stops[0].id === stops[stops.length - 1].id
    if (loop) stops = stops.slice(0, -1)
    const t = r.tags ?? {}
    const color = t.colour && /^#[0-9a-f]{6}$/i.test(t.colour) ? t.colour : undefined
    out.push({ key: String(r.id), name: t.name ?? t['name:ko'] ?? t.ref ?? `노선 ${r.id}`, color, stops, loop })
  }
  return out.sort((a, b2) => a.name.localeCompare(b2.name, 'ko'))
}

export function toLine(f: Found): Partial<Line> {
  return {
    name: f.name, color: f.color ?? '#555555', loop: f.loop, smooth: 0.5,
    points: f.stops.map((s) => s.ll),
    stations: f.stops.map((s) => ({ id: Math.random().toString(36).slice(2, 9), name: s.name, ll: s.ll })),
  }
}
