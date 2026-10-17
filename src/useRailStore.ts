import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { hav, PRESET_LINES, type Line, type LL, type Method, type Station } from './rail'

export type Mode = 'pan' | 'draw' | 'station'
const uid = () => Math.random().toString(36).slice(2, 9)

export const makeLine = (n: number, name?: string, color?: string): Line => ({
  id: uid(), name: name ?? `${n}호선`, color: color ?? PRESET_LINES[(n - 1) % PRESET_LINES.length].color,
  mix: { tbm: 70, natm: 0, cut: 30, elevated: 0, surface: 0 },
  smooth: 0.8, vehicle: 'heavy8', dwell: 30, head: 0, fleet: 0, loop: false, points: [], stations: [],
})

interface S {
  lines: Line[]; activeId: string | null; mode: Mode
  speed: number; playing: boolean; overhead: number
  setMode: (m: Mode) => void
  setActive: (id: string) => void
  newLine: (preset?: { name: string; color: string }) => void
  removeLine: (id: string) => void
  update: (p: Partial<Line>) => void
  setMix: (m: Method, v: number) => void
  addPoint: (ll: LL) => void
  undoPoint: () => void
  addStation: (lineId: string, ll: LL) => void
  updateStation: (id: string, p: Partial<Station>) => void
  removeStation: (id: string) => void
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
      return {
        lines: [], activeId: null, mode: 'draw', speed: 4, playing: true, overhead: 0.15,
        setMode: (mode) => set({ mode }),
        setActive: (id) => set({ activeId: id }),
        newLine: (preset) => {
          const l = makeLine(get().lines.length + 1, preset?.name, preset?.color)
          set((s) => ({ lines: [...s.lines, l], activeId: l.id, mode: 'draw' }))
        },
        removeLine: (id) => set((s) => {
          const lines = s.lines.filter((l) => l.id !== id)
          return { lines, activeId: s.activeId === id ? (lines[0]?.id ?? null) : s.activeId }
        }),
        update: (p) => patch((l) => ({ ...l, ...p })),
        setMix: (m, v) => patch((l) => ({ ...l, mix: { ...l.mix, [m]: v } })),
        addPoint: (ll) => {
          if (!get().activeId) get().newLine()
          patch((l) => ({ ...l, points: [...l.points, ll] }))
        },
        undoPoint: () => patch((l) => ({ ...l, points: l.points.slice(0, -1) })),
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
        removeStation: (id) => patch((l) => ({ ...l, stations: l.stations.filter((x) => x.id !== id) })),
        setSpeed: (speed) => set({ speed }),
        togglePlay: () => set((s) => ({ playing: !s.playing })),
        setOverhead: (overhead) => set({ overhead }),
        importLines: (ls) => {
          const lines = ls.map((l, i) => ({ ...makeLine(i + 1), ...l, id: l.id || uid() })) as Line[]
          set({ lines, activeId: lines[0]?.id ?? null })
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
