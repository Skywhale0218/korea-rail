/* 타입 · 상수 · 지오메트리 · 비용/운행 계산 (React 의존 없음) */
export type LL = [number, number] // [lat, lng]
export type Method = 'tbm' | 'natm' | 'cut' | 'elevated' | 'surface'
export type VehicleId = 'heavy10' | 'heavy8' | 'heavy6' | 'light_ui' | 'light_sillim' | 'tram' | 'gtx'
  | 'hsr' | 'sm1000' | 'sm4000' | 'sm5000' | 'sm7000' | 'kr311000' | 'kr361000'

export interface Entrance { id: string; name: string; ll: LL }
export interface WalkLink { lineId: string; stationId: string } // 도보 환승 상대 역
export type SystemType = 'heavy' | 'light' | 'tram' | 'gtx' | 'hsr'
export interface Station {
  id: string; name: string; ll: LL; method?: Method; vlimit?: number
  footprint?: LL[]        // 역사 부지 폴리곤
  entrances?: Entrance[]  // 출입구 E1, E2, …
  walks?: WalkLink[]      // 이 역에서 시작하는 도보 환승 (양쪽 역에 모두 표시돼요)
} // method: 이 역에서 다음 역까지의 구간 방식 (없으면 노선 공법 비율)
export interface Line {
  id: string; name: string; color: string
  mix: Record<Method, number>   // 공법 비율(가중치, 합계 자동 정규화)
  smooth: number                // 0(직선) ~ 1(최대 곡선)
  vehicle: VehicleId
  dwell: number                 // 정차시간(초)
  head: number                  // 배차 목표(초, 0=자동)
  fleet: number                 // 편성 수(0=자동)
  loop: boolean                 // 순환선
  points: LL[]; stations: Station[]
  system?: SystemType           // 시스템 유형 (중전철·경전철·트램·GTX·고속철도)
  vmax?: number                 // 설계 최고속도(km/h). 없으면 차량 기본값
  track?: { double: boolean; spacing: number } // 선로 궤도 (복선 간격 m)
}
export interface Vehicle { label: string; cars: number; len: number; cap: number; vmax: number; carCost: number; minR: number; real?: boolean; est?: string }

export const METHODS: Method[] = ['tbm', 'natm', 'cut', 'elevated', 'surface']
export const METHOD_LABEL: Record<Method, string> = {
  tbm: '지하 · TBM(쉴드)', natm: '지하 · NATM(발파)', cut: '지하 · 개착식', elevated: '고가', surface: '지상',
}
/* ★ 아래 숫자는 모두 임의 가정값입니다. 실제 사업 사례에 맞게 수정하세요. */
export const UNIT: Record<Method, number> = { tbm: 1800, natm: 1400, cut: 1000, elevated: 600, surface: 300 } // 억원/km
export const ST_UG = 500, ST_GR = 150 // 역사 억원 (지하/지상·고가)
export const TURN = 120               // 종점 회차 시간(초)
export const VEHICLES: Record<VehicleId, Vehicle> = {
  heavy10: { label: '중전철 10량', cars: 10, len: 20, cap: 160, vmax: 90, carCost: 18, minR: 250 },
  heavy8: { label: '중전철 8량', cars: 8, len: 20, cap: 160, vmax: 90, carCost: 18, minR: 250 },
  heavy6: { label: '중전철 6량', cars: 6, len: 20, cap: 160, vmax: 90, carCost: 18, minR: 250 },
  light_ui: { label: '경전철 (우이신설 규격·대략)', cars: 2, len: 18, cap: 115, vmax: 70, carCost: 12, minR: 100 },
  light_sillim: { label: '경전철 (신림선 규격·대략)', cars: 2, len: 15, cap: 100, vmax: 80, carCost: 12, minR: 100 },
  // ── 수도권 전철 실제 전동차 (위키백과 제원 기준. est 항목은 확인하지 못해 추정한 값이 있어요) ──
  sm1000: { label: '서울교통공사 1000호대 VVVF (10량)', cars: 10, len: 19.5, cap: 158, vmax: 110, carCost: 18, minR: 250, real: true },
  sm4000: { label: '서울교통공사 4000호대 VVVF (10량)', cars: 10, len: 19.5, cap: 160, vmax: 80, carCost: 18, minR: 250, real: true, est: '정원·전장 추정, 속도는 ATC 구간 80km/h 기준' },
  sm5000: { label: '서울교통공사 5000호대 (8량)', cars: 8, len: 19.5, cap: 160, vmax: 80, carCost: 18, minR: 250, real: true, est: '정원 추정' },
  sm7000: { label: '서울교통공사 7000호대 (8량)', cars: 8, len: 19.5, cap: 160, vmax: 80, carCost: 18, minR: 250, real: true, est: '편성 량수·정원 추정' },
  kr311000: { label: '한국철도공사 311000·312000호대 (10량)', cars: 10, len: 19.5, cap: 160, vmax: 110, carCost: 18, minR: 250, real: true, est: '정원·전장 추정' },
  kr361000: { label: '한국철도공사 361000호대 (8량)', cars: 8, len: 19.5, cap: 157, vmax: 110, carCost: 18, minR: 250, real: true },
  hsr: { label: '고속철도 (KTX급 10량·대략)', cars: 10, len: 20, cap: 60, vmax: 300, carCost: 40, minR: 7000, est: '임의 가정값이에요. 실제 차량 제원과 다를 수 있어요.' },
  tram: { label: '트램 / 노면전차', cars: 3, len: 10, cap: 60, vmax: 60, carCost: 8, minR: 25 },
  gtx: { label: '광역급행철도 (GTX급 8량)', cars: 8, len: 20, cap: 135, vmax: 150, carCost: 25, minR: 1000 },
}
export const SYSTEMS: Record<SystemType, { label: string; vehicle: VehicleId; vmax: number }> = {
  heavy: { label: '중전철', vehicle: 'heavy8', vmax: 90 },
  light: { label: '경전철', vehicle: 'light_ui', vmax: 70 },
  tram: { label: '트램', vehicle: 'tram', vmax: 60 },
  gtx: { label: 'GTX (광역급행)', vehicle: 'gtx', vmax: 150 },
  hsr: { label: '고속철도', vehicle: 'hsr', vmax: 300 },
}
export const WALK_SPEED = 1.2 // 도보 속도(m/s)
export const PRESET_LINES = [
  { name: '1호선', color: '#0052a4' }, { name: '2호선', color: '#00a84d' }, { name: '3호선', color: '#ef7c1c' },
  { name: '4호선', color: '#00a5de' }, { name: '5호선', color: '#996cac' }, { name: '6호선', color: '#cd7c2f' },
  { name: '7호선', color: '#747f00' }, { name: '8호선', color: '#e6186c' }, { name: '9호선', color: '#bdb092' },
  { name: '신분당선', color: '#d4003b' }, { name: '수인분당선', color: '#fabe00' }, { name: '경춘선', color: '#0c8e72' },
  { name: '경의중앙선', color: '#77c4a3' }, { name: '공항철도', color: '#0090d2' }, { name: 'GTX-A', color: '#9a6292' },
]

/* ---------- 지오메트리 ---------- */
const R = 6371000, rad = Math.PI / 180
export const hav = (a: LL, b: LL) => {
  const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Catmull-Rom 곡선 보간. t=0 직선, t=1 완전 곡선. loop면 끝점이 시작점으로 이어져요 */
export function smooth(p: LL[], t: number, loop = false): LL[] {
  const n = p.length
  if (n < 3 || t <= 0) return loop && n > 1 ? [...p, p[0]] : p
  const at = (i: number) => (loop ? p[(i + n) % n] : p[Math.max(0, Math.min(n - 1, i))])
  const out: LL[] = [p[0]]
  const m = loop ? n : n - 1
  for (let i = 0; i < m; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2)
    const k0 = Math.min(40, Math.max(2, Math.ceil(hav(p1, p2) / 100)))
    for (let k = 1; k <= k0; k++) {
      const u = k / k0, u2 = u * u, u3 = u2 * u
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3)
      const cr = [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]
      const li = [p1[0] + (p2[0] - p1[0]) * u, p1[1] + (p2[1] - p1[1]) * u]
      out.push([li[0] + (cr[0] - li[0]) * t, li[1] + (cr[1] - li[1]) * t])
    }
  }
  return out
}

export interface Path { pts: LL[]; cum: number[]; len: number; loop: boolean }
export function pathOf(l: Line): Path {
  const loop = !!l.loop && l.points.length >= 3
  const pts = smooth(l.points, l.smooth, loop), cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + hav(pts[i - 1], pts[i]))
  return { pts, cum, len: cum[cum.length - 1] || 0, loop }
}

/** 선로 위 가장 가까운 점 (ll, 시점부터의 거리 s[m], 떨어진 거리 d[m]) */
export function project(pts: LL[], cum: number[], q: LL) {
  let best = { ll: pts[0], s: 0, d: Infinity }
  const k = Math.cos(q[0] * rad)
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    const ax = (a[1] - q[1]) * k, ay = a[0] - q[0], dx = (b[1] - a[1]) * k, dy = b[0] - a[0]
    const L2 = dx * dx + dy * dy
    const t = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0
    const ll: LL = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
    const d = hav(q, ll)
    if (d < best.d) best = { ll, s: cum[i] + (cum[i + 1] - cum[i]) * t, d }
  }
  return best
}

export function posAt(path: Path, s: number): LL {
  const { pts, cum } = path
  if (pts.length < 2) return pts[0]
  if (path.loop && path.len) s = ((s % path.len) + path.len) % path.len
  let i = 1
  while (i < cum.length - 1 && cum[i] < s) i++
  const u = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), a = pts[i - 1], b = pts[i]
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]
}

export type StationOn = Station & { s: number }
export function stationsOn(l: Line, path: Path): StationOn[] {
  if (path.pts.length < 2) return []
  return l.stations
    .map((st) => { const p = project(path.pts, path.cum, st.ll); return { ...st, ll: p.ll, s: p.s } })
    .sort((a, b) => a.s - b.s)
}

/** 최소 곡선반경(m): 약 80m 간격 세 점의 외접원 반지름 */
export function minRadius(pts: LL[]): number {
  const q: LL[] = []
  pts.forEach((p) => { if (!q.length || hav(q[q.length - 1], p) >= 80) q.push(p) })
  let m = Infinity
  for (let i = 1; i < q.length - 1; i++) {
    const ab = hav(q[i - 1], q[i]), bc = hav(q[i], q[i + 1]), ac = hav(q[i - 1], q[i + 1]), s = (ab + bc + ac) / 2
    const A = Math.sqrt(Math.max(0, s * (s - ab) * (s - bc) * (s - ac)))
    if (A > 1) m = Math.min(m, (ab * bc * ac) / (4 * A))
  }
  return m
}

/* ---------- 비용 · 운행 계산 ---------- */
export interface Leg { t: number; t0: number; s0: number; s1: number }
export interface Ops { legs: Leg[]; cyc: number; N: number; res: number; head: number; perH: number; avg: number; trainCap: number; trainLen: number }

export function calc(l: Line, overhead: number) {
  const path = pathOf(l), sts = stationsOn(l, path), v = VEHICLES[l.vehicle], km = path.len / 1000
  const tw = METHODS.reduce((a, m) => a + l.mix[m], 0) || 1
  const w = (m: Method) => l.mix[m] / tw
  const defUnit = METHODS.reduce((a, m) => a + w(m) * UNIT[m], 0)
  const defUg = w('tbm') + w('natm') + w('cut')
  const isUg = (m: Method) => (m === 'tbm' || m === 'natm' || m === 'cut' ? 1 : 0)
  const n = sts.length

  // 역~역 구간별 길이·공법 (구간에 공법을 지정하지 않으면 노선의 공법 비율을 사용)
  const spans: { d: number; m?: Method }[] = []
  for (let i = 0; i < n - 1; i++) spans.push({ d: sts[i + 1].s - sts[i].s, m: sts[i].method })
  if (path.loop && n >= 2) spans.push({ d: path.len - (sts[n - 1].s - sts[0].s), m: sts[n - 1].method })
  const covered = spans.reduce((a, x) => a + x.d, 0)
  const civil =
    spans.reduce((a, x) => a + (x.d / 1000) * (x.m ? UNIT[x.m] : defUnit), 0) + Math.max(0, km - covered / 1000) * defUnit
  const sta = sts.reduce((a, st, i) => {
    const m = i > 0 ? sts[i - 1].method : path.loop ? sts[n - 1].method : st.method
    const ug = m ? isUg(m) : defUg
    return a + ug * ST_UG + (1 - ug) * ST_GR
  }, 0)

  let ops: Ops | null = null
  if (n >= 2) {
    const dw = Math.max(1, l.dwell)
    const tt = (d: number, kmh: number) => { const vm = kmh / 3.6; return d > vm * vm ? d / vm + vm : 2 * Math.sqrt(d) } // 가감속 1m/s²
    const vmax = l.vmax || v.vmax
    const cap = (i: number) => Math.min(vmax, sts[i].vlimit || vmax) // 역 i → i+1 구간 속도 제한(km/h)
    const legs: Leg[] = [], add = (t: number, s0: number, s1: number) => legs.push({ t, t0: 0, s0, s1 })
    if (path.loop) {
      for (let i = 0; i < n; i++) {
        const s0 = sts[i].s, s1 = i < n - 1 ? sts[i + 1].s : sts[0].s + path.len
        add(tt(s1 - s0, cap(i)), s0, s1); add(dw, s1, s1)
      }
    } else {
      for (let i = 0; i < n - 1; i++) { add(tt(sts[i + 1].s - sts[i].s, cap(i)), sts[i].s, sts[i + 1].s); add(i < n - 2 ? dw : TURN, sts[i + 1].s, sts[i + 1].s) }
      for (let i = n - 2; i >= 0; i--) { add(tt(sts[i + 1].s - sts[i].s, cap(i)), sts[i + 1].s, sts[i].s); add(i > 0 ? dw : TURN, sts[i].s, sts[i].s) }
    }
    let cyc = 0
    legs.forEach((g) => { g.t0 = cyc; cyc += g.t })
    const N = Math.min(80, Math.max(1, l.fleet > 0 ? Math.round(l.fleet) : Math.ceil(cyc / (l.head > 0 ? l.head : 180))))
    const head = cyc / N, trainCap = v.cars * v.cap
    const routeLen = path.loop ? path.len : 2 * (sts[n - 1].s - sts[0].s)
    ops = { legs, cyc, N, head, res: Math.ceil(N * 0.1), trainCap, perH: (3600 / head) * trainCap,
      avg: (routeLen / cyc) * 3.6, trainLen: v.cars * v.len }
  }
  const veh = ops ? (ops.N + ops.res) * v.cars * v.carCost : 0
  const over = (civil + sta + veh) * overhead
  return { path, sts, km, civil, sta, veh, over, total: civil + sta + veh + over, ops, minR: minRadius(path.pts), vehicle: v }
}

/** 선로 s0~s1(m) 구간의 좌표열 */
export function slicePath(path: Path, s0: number, s1: number): LL[] {
  const out: LL[] = [posAt(path, s0)]
  path.cum.forEach((c, i) => { if (c > s0 && c < s1) out.push(path.pts[i]) })
  out.push(posAt(path, s1))
  return out
}

/** 역 사이 구간별로 선로를 나눠서 (공법별 선 모양 표시용) */
export function pieces(path: Path, sts: StationOn[]): { pts: LL[]; m?: Method }[] {
  const n = sts.length
  if (n < 2) return [{ pts: path.pts }]
  const out: { pts: LL[]; m?: Method }[] = []
  if (!path.loop && sts[0].s > 1) out.push({ pts: slicePath(path, 0, sts[0].s) })
  for (let i = 0; i < n - 1; i++) out.push({ pts: slicePath(path, sts[i].s, sts[i + 1].s), m: sts[i].method })
  if (path.loop) out.push({ pts: [...slicePath(path, sts[n - 1].s, path.len), ...slicePath(path, 0, sts[0].s)], m: sts[n - 1].method })
  else if (sts[n - 1].s < path.len - 1) out.push({ pts: slicePath(path, sts[n - 1].s, path.len) })
  return out
}

/* ---------- 요금 (성인 교통카드 기준 가정값) ---------- */
export const BASE_FARE = 1550, BASE_KM = 10
export const fareOf = (km: number) =>
  km <= BASE_KM ? BASE_FARE : km <= 50 ? BASE_FARE + Math.ceil((km - BASE_KM) / 5) * 100 : BASE_FARE + 800 + Math.ceil((km - 50) / 8) * 100

/** 이름이 같은 역은 환승으로 연결. 최단 거리 경로의 거리·환승 횟수 */
export function route(lines: Line[], a: string, b: string) {
  type E = { to: string; d: number; line: string }
  const adj = new Map<string, E[]>()
  const put = (k: string, e: E) => { const arr = adj.get(k) ?? []; arr.push(e); adj.set(k, arr) }
  const link = (x: string, y: string, d: number, line: string) => { put(x, { to: y, d, line }); put(y, { to: x, d, line }) }
  lines.forEach((l) => {
    const p = pathOf(l), st = stationsOn(l, p), n = st.length
    for (let i = 0; i < n - 1; i++) link(st[i].name, st[i + 1].name, st[i + 1].s - st[i].s, l.id)
    if (p.loop && n >= 3) link(st[n - 1].name, st[0].name, p.len - (st[n - 1].s - st[0].s), l.id)
  })
  const dist = new Map<string, number>([[a, 0]])
  const prev = new Map<string, { from: string; line: string }>()
  const done = new Set<string>()
  for (;;) {
    let u: string | null = null
    for (const [k, d] of dist) if (!done.has(k) && (u === null || d < (dist.get(u) as number))) u = k
    if (u === null || u === b) break
    done.add(u)
    for (const e of adj.get(u) ?? []) {
      const nd = (dist.get(u) as number) + e.d
      if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, { from: u, line: e.line }) }
    }
  }
  if (!dist.has(b)) return null
  const used: string[] = []
  for (let k = b; k !== a; ) { const p = prev.get(k) as { from: string; line: string }; used.unshift(p.line); k = p.from }
  let transfers = 0
  for (let i = 1; i < used.length; i++) if (used[i] !== used[i - 1]) transfers++
  return { km: (dist.get(b) as number) / 1000, transfers, lineIds: [...new Set(used)] }
}

export const fmtKRW = (eok: number) =>
  eok >= 10000 ? `${(eok / 10000).toFixed(2)}조원` : `${Math.round(eok).toLocaleString()}억원`

/* ---------- 편집 도구용 지오메트리 ---------- */
const M = 111320 // 위도 1도 ≈ m
/** 기준점에서 동쪽 e(m), 북쪽 n(m)만큼 이동한 좌표 */
export const shift = (c: LL, e: number, n: number): LL => [c[0] + n / M, c[1] + e / (M * Math.cos(c[0] * rad))]

/** 다각형 면적(㎡) */
export function polyArea(poly: LL[]): number {
  if (poly.length < 3) return 0
  const k = Math.cos(poly[0][0] * rad)
  const xy = poly.map((p) => [(p[1] - poly[0][1]) * k * M, (p[0] - poly[0][0]) * M])
  let a = 0
  for (let i = 0; i < xy.length; i++) { const j = (i + 1) % xy.length; a += xy[i][0] * xy[j][1] - xy[j][0] * xy[i][1] }
  return Math.abs(a) / 2
}

/** 선로를 옆으로 m미터 평행 이동 (복선 표시용) */
export function offsetPts(pts: LL[], m: number): LL[] {
  if (pts.length < 2) return pts
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
    const k = Math.cos(p[0] * rad)
    let tx = (b[1] - a[1]) * k, ty = b[0] - a[0]
    const L = Math.hypot(tx, ty) || 1
    tx /= L; ty /= L
    return shift(p, -ty * m, tx * m)
  })
}

/** 선로 위 거리 s에서의 진행 방향 (동·북 단위벡터) */
export function dirAt(path: Path, s: number): [number, number] {
  const a = posAt(path, s - 5), b = posAt(path, s + 5)
  const e = (b[1] - a[1]) * Math.cos(a[0] * rad) * M, n = (b[0] - a[0]) * M
  const L = Math.hypot(e, n) || 1
  return [e / L, n / L]
}

/** 중심 c, 진행방향 dir 기준 길이×폭(m) 사각형 */
export function rectAround(c: LL, dir: [number, number], len: number, wid: number): LL[] {
  const [ue, un] = dir, pe = -un, pn = ue
  const corner = (a: number, b: number) => shift(c, ue * a + pe * b, un * a + pn * b)
  return [corner(-len / 2, -wid / 2), corner(len / 2, -wid / 2), corner(len / 2, wid / 2), corner(-len / 2, wid / 2)]
}

/** 원본 점(points)마다 부드러운 선로 위의 거리 s. 곡선은 원본 점을 항상 지나요 */
export function rawS(l: Line, path: Path): number[] {
  const out: number[] = []
  let from = 0
  for (const p of l.points) {
    let found = -1
    for (let i = from; i < path.pts.length; i++) {
      if (Math.abs(path.pts[i][0] - p[0]) < 1e-9 && Math.abs(path.pts[i][1] - p[1]) < 1e-9) { found = i; break }
    }
    if (found >= 0) { out.push(path.cum[found]); from = found } else out.push(project(path.pts, path.cum, p).s)
  }
  return out
}

/** 선로 위 q 지점에 새 점을 넣을 위치(원본 points 인덱스) */
export function insertIndex(l: Line, path: Path, q: LL): number {
  const s = project(path.pts, path.cum, q).s
  const sj = rawS(l, path)
  for (let j = 0; j < sj.length; j++) if (sj[j] > s + 0.01) return j
  return l.points.length
}
