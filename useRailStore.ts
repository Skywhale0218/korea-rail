import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { hav, PRESET_LINES, SYSTEMS, type Entrance, type Line, type LL, type Method, type Station, type SystemType, type VehicleId } from './rail'

export type Mode = 'pan' | 'draw' | 'station' | 'edit' | 'footprint' | 'entrance' | 'walk'
export type Extend = 'end' | 'start'
export interface StRef { lineId: string; stationId: string }
const uid = () => Math.random().toString(36).slice(2, 9)

export const makeLine = (n: number, name?: string, color?: string): Line => ({
  id: uid(), name: name ?? `${n}호선`, color: color ?? PRESET_LINES[(n - 1) % PRESET_LINES.length].color,
  mix: { tbm: 70, natm: 0, cut: 30, elevated: 0, surface: 0 },
  smooth: 0.8, vehicle: 'heavy8', dwell: 30, head: 0, fleet: 0, loop: false, points: [], stations: [],
})

export interface NewLineOpts { name: string; color: string; system: SystemType; vehicle?: VehicleId; vmax: number }

interface S {
  lines: Line[]; activeId: string | null; mode: Mode
  speed: number; playing: boolean; overhead: number
  // ── 화면 상태 (저장하지 않아요) ──
  extend: Extend                       // 그리기 방향: 종점 연장 / 시점 연장
  sel: StRef | null                    // 선택한 역
  selPt: { lineId: string; i: number } | null // 선택한 선형 점(팝업)
  draft: LL[]                          // 그리는 중인 역 부지
  walkFrom: StRef | null               // 도보 환승 첫 번째 역
  setMode: (m: Mode) => void
  setExtend: (e: Extend) => void
  setActive: (id: string) => void
  newLine: (preset?: { name: string; color: string }) => void
  newCustomLine: (o: NewLineOpts) => void
  removeLine: (id: string) => void
  update: (p: Partial<Line>) => void
  setMix: (m: Method, v: number) => void
  addPoint: (ll: LL) => void
  undoPoint: () => void
  insertPoint: (i: number, ll: LL) => void
  movePoint: (i: number, ll: LL) => void
  removePoint: (i: number) => void
  selectPoint: (p: { lineId: string; i: number } | null) => void
  addStation: (lineId: string, ll: LL) => void
  updateStation: (id: string, p: Partial<Station>) => void
  removeStation: (id: string) => void
  selectStation: (r: StRef | null) => void
  patchStation: (r: StRef, fn: (s: Station) => Station) => void
  addDraft: (ll: LL) => void
  undoDraft: () => void
  cancelDraft: () => void
  finishFootprint: () => void
  addEntrance: (r: StRef, ll: LL) => void
  moveEntrance: (r: StRef, id: string, ll: LL) => void
  renameEntrance: (r: StRef, id: string, name: string) => void
  removeEntrance: (r: StRef, id: string) => void
  walkPick: (r: StRef) => string | null
  removeWalk: (owner: StRef, target: StRef) => void
  setSpeed: (v: number) => void
  togglePlay: () => void
  setOverhead: (v: number) => void
  importLines: (ls: Partial<Line>[]) => void
  addLines: (ls: Partial<Line>[]) => void
}

export const useRailStore = create<S>()(
  persist(
    (set, get) => {
      const patch = (fn: (l: Line) => Line) =>
        set((s) => ({ lines: s.lines.map((l) => (l.id === s.activeId ? fn(l) : l)) }))
      const patchSt = (r: StRef, fn: (s: Station) => Station) =>
        set((s) => ({ lines: s.lines.map((l) => l.id !== r.lineId ? l : { ...l, stations: l.stations.map((x) => (x.id === r.stationId ? fn(x) : x)) }) }))
      return {
        lines: [], activeId: null, mode: 'draw', speed: 4, playing: true, overhead: 0.15,
        extend: 'end', sel: null, selPt: null, draft: [], walkFrom: null,
        setMode: (mode) => set((s) => ({ mode, draft: mode === 'footprint' ? s.draft : [], walkFrom: null, selPt: null })),
        setExtend: (extend) => set({ extend, mode: 'draw' }),
        setActive: (id) => set({ activeId: id, selPt: null }),
        newLine: (preset) => {
          const l = makeLine(get().lines.length + 1, preset?.name, preset?.color)
          set((s) => ({ lines: [...s.lines, l], activeId: l.id, mode: 'draw', extend: 'end' }))
        },
        newCustomLine: (o) => {
          const base = makeLine(get().lines.length + 1, o.name, o.color)
          const l: Line = { ...base, system: o.system, vehicle: o.vehicle ?? SYSTEMS[o.system].vehicle, vmax: o.vmax }
          set((s) => ({ lines: [...s.lines, l], activeId: l.id, mode: 'draw', extend: 'end', selPt: null }))
        },
        removeLine: (id) => set((s) => {
          const lines = s.lines.filter((l) => l.id !== id)
          return { lines, activeId: s.activeId === id ? (lines[0]?.id ?? null) : s.activeId, selPt: null, sel: s.sel?.lineId === id ? null : s.sel }
        }),
        update: (p) => patch((l) => ({ ...l, ...p })),
        setMix: (m, v) => patch((l) => ({ ...l, mix: { ...l.mix, [m]: v } })),
        addPoint: (ll) => {
          if (!get().activeId) get().newLine()
          const start = get().extend === 'start'
          patch((l) => ({ ...l, points: start ? [ll, ...l.points] : [...l.points, ll] }))
          set({ selPt: null })
        },
        undoPoint: () => {
          const start = get().extend === 'start'
          patch((l) => ({ ...l, points: start ? l.points.slice(1) : l.points.slice(0, -1) }))
          set({ selPt: null })
        },
        insertPoint: (i, ll) => patch((l) => ({ ...l, points: [...l.points.slice(0, i), ll, ...l.points.slice(i)] })),
        movePoint: (i, ll) => patch((l) => ({ ...l, points: l.points.map((p, k) => (k === i ? ll : p)) })),
        removePoint: (i) => { patch((l) => ({ ...l, points: l.points.filter((_, k) => k !== i) })); set({ selPt: null }) },
        selectPoint: (selPt) => set({ selPt }),
        addStation: (lineId, ll) => set((s) => {
          // 다른 노선 역 120m 이내면 같은 이름·위치로 연결 → 환승역
          let name: string | null = null, pos = ll
          for (const o of s.lines) {
            if (o.id === lineId) continue
            for (const st of o.stations) if (hav(st.ll, ll) < 120) { name = st.name; pos = st.ll }
          }
          return { lines: s.lines.map((l) => l.id !== lineId ? l : {
            ...l, stations: [...l.stations, { id: uid(), name: name ?? `${l.name} ${l.stations.length + 1}역`, ll: pos }],
          }) }
        }),
        updateStation: (id, p) => patch((l) => ({ ...l, stations: l.stations.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
        removeStation: (id) => {
          patch((l) => ({ ...l, stations: l.stations.filter((x) => x.id !== id) }))
          set((s) => ({
            sel: s.sel?.stationId === id ? null : s.sel,
            // 이 역을 가리키던 도보 환승도 함께 정리
            lines: s.lines.map((l) => ({ ...l, stations: l.stations.map((x) => (x.walks?.some((w) => w.stationId === id) ? { ...x, walks: x.walks.filter((w) => w.stationId !== id) } : x)) })),
          }))
        },
        selectStation: (sel) => set({ sel, activeId: sel ? sel.lineId : get().activeId, selPt: null }),
        patchStation: (r, fn) => patchSt(r, fn),
        addDraft: (ll) => set((s) => ({ draft: [...s.draft, ll] })),
        undoDraft: () => set((s) => ({ draft: s.draft.slice(0, -1) })),
        cancelDraft: () => set({ draft: [], mode: 'pan' }),
        finishFootprint: () => {
          const { sel, draft } = get()
          if (sel && draft.length >= 3) patchSt(sel, (x) => ({ ...x, footprint: draft }))
          set({ draft: [], mode: 'pan' })
        },
        addEntrance: (r, ll) => patchSt(r, (x) => {
          const n = (x.entrances?.length ?? 0) + 1
          const e: Entrance = { id: uid(), name: `E${n}`, ll }
          return { ...x, entrances: [...(x.entrances ?? []), e] }
        }),
        moveEntrance: (r, id, ll) => patchSt(r, (x) => ({ ...x, entrances: x.entrances?.map((e) => (e.id === id ? { ...e, ll } : e)) })),
        renameEntrance: (r, id, name) => patchSt(r, (x) => ({ ...x, entrances: x.entrances?.map((e) => (e.id === id ? { ...e, name } : e)) })),
        removeEntrance: (r, id) => patchSt(r, (x) => ({ ...x, entrances: x.entrances?.filter((e) => e.id !== id) })),
        // 도보 환승: 두 역을 차례로 누르면 연결해요. 안내 문구(오류)를 돌려줘요
        walkPick: (r) => {
          const from = get().walkFrom
          if (!from) { set({ walkFrom: r, sel: r, activeId: r.lineId }); return null }
          if (from.lineId === r.lineId && from.stationId === r.stationId) return '같은 역이에요. 다른 역을 눌러 주세요.'
          const find = (x: StRef) => get().lines.find((l) => l.id === x.lineId)?.stations.find((st) => st.id === x.stationId)
          const a = find(from), b = find(r)
          if (!a || !b) { set({ walkFrom: null }); return '역을 찾지 못했어요.' }
          const d = hav(a.ll, b.ll)
          if (d > 1000) return `두 역이 ${Math.round(d)}m 떨어져 있어요. 1km 이내의 인접한 역만 연결할 수 있어요.`
          const dup = (a.walks ?? []).some((w) => w.stationId === r.stationId) || (b.walks ?? []).some((w) => w.stationId === from.stationId)
          if (!dup) patchSt(from, (x) => ({ ...x, walks: [...(x.walks ?? []), { lineId: r.lineId, stationId: r.stationId }] }))
          set({ walkFrom: null, mode: 'pan', sel: from })
          return dup ? '이미 연결된 역이에요.' : null
        },
        removeWalk: (owner, target) => patchSt(owner, (x) => ({ ...x, walks: x.walks?.filter((w) => !(w.lineId === target.lineId && w.stationId === target.stationId)) })),
        setSpeed: (speed) => set({ speed }),
        togglePlay: () => set((s) => ({ playing: !s.playing })),
        setOverhead: (overhead) => set({ overhead }),
        importLines: (ls) => {
          const lines = ls.map((l, i) => ({ ...makeLine(i + 1), ...l, id: l.id || uid() })) as Line[]
          set({ lines, activeId: lines[0]?.id ?? null, sel: null, selPt: null })
        },
        addLines: (ls) => set((s) => {
          const add = ls.map((l, i) => ({ ...makeLine(s.lines.length + i + 1), ...l, id: l.id || uid() })) as Line[]
          return { lines: [...s.lines, ...add], activeId: add[0]?.id ?? s.activeId }
        }),
      }
    },
    { name: 'korea-rail-sim-v2', partialize: (s) => ({ lines: s.lines, activeId: s.activeId, overhead: s.overhead }) },
  ),
)
