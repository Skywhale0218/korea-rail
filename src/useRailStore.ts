import { create } from 'zustand'
import { Line, LL, Station, Method } from './rail'

export type Mode = 'pan' | 'draw' | 'station' | 'select'

interface RailStore {
  lines: Line[]
  activeId: string | null
  mode: Mode
  extendDirection: 'start' | 'end'
  selectedPointIndex: number | null
  speed: number
  playing: boolean
  overhead: number

  setActive: (id: string | null) => void
  setMode: (mode: Mode) => void
  setSpeed: (speed: number) => void
  togglePlay: () => void
  setOverhead: (v: number) => void
  setExtendDirection: (dir: 'start' | 'end') => void
  toggleExtendDirection: () => void
  setSelectedPointIndex: (idx: number | null) => void

  addPoint: (pt: LL) => void
  insertPoint: (index: number, pt: LL) => void
  removePoint: (index: number) => void
  undoPoint: () => void

  addStation: (lineId: string, ll: LL) => void
  updateStation: (stationId: string, patch: Partial<Station>) => void
  removeStation: (stationId: string) => void
  newLine: (preset: { name: string; color: string }) => void
  addCustomLine: (line: Line) => void
  update: (patch: Partial<Line>) => void
  setMix: (method: Method, val: number) => void
  removeLine: (id: string) => void

  addLines: (newLines: any[]) => void
  importLines: (lines: any[]) => void
  setLines: (lines: Line[]) => void
}

export const useRailStore = create<RailStore>((set) => ({
  lines: [],
  activeId: null,
  mode: 'pan',
  extendDirection: 'end',
  selectedPointIndex: null,
  speed: 1,
  playing: true,
  overhead: 0.1,

  setActive: (id) => set({ activeId: id }),
  setMode: (mode) => set({ mode }),
  setSpeed: (speed) => set({ speed }),
  togglePlay: () => set((state) => ({ playing: !state.playing })),
  setOverhead: (overhead) => set({ overhead }),
  setExtendDirection: (extendDirection) => set({ extendDirection }),
  toggleExtendDirection: () =>
    set((state) => ({
      extendDirection: state.extendDirection === 'end' ? 'start' : 'end',
    })),
  setSelectedPointIndex: (selectedPointIndex) => set({ selectedPointIndex }),

  addPoint: (pt) =>
    set((state) => {
      if (!state.activeId) return state
      return {
        lines: state.lines.map((l) => {
          if (l.id !== state.activeId) return l
          const newPoints =
            state.extendDirection === 'start' ? [pt, ...l.points] : [...l.points, pt]
          return { ...l, points: newPoints }
        }),
      }
    }),

  insertPoint: (index, pt) =>
    set((state) => {
      if (!state.activeId) return state
      return {
        lines: state.lines.map((l) => {
          if (l.id !== state.activeId) return l
          const newPoints = [...l.points]
          newPoints.splice(index, 0, pt)
          return { ...l, points: newPoints }
        }),
      }
    }),

  removePoint: (index) =>
    set((state) => {
      if (!state.activeId) return state
      return {
        selectedPointIndex: null,
        lines: state.lines.map((l) => {
          if (l.id !== state.activeId) return l
          const newPoints = l.points.filter((_, i) => i !== index)
          return { ...l, points: newPoints }
        }),
      }
    }),

  undoPoint: () =>
    set((state) => {
      if (!state.activeId) return state
      return {
        lines: state.lines.map((l) => {
          if (l.id !== state.activeId || l.points.length === 0) return l
          const idx = state.extendDirection === 'start' ? 0 : l.points.length - 1
          const newPoints = l.points.filter((_, i) => i !== idx)
          return { ...l, points: newPoints }
        }),
      }
    }),

  addStation: (lineId, ll) =>
    set((state) => {
      const line = state.lines.find((l) => l.id === lineId)
      const autoName = `${line ? line.name : '노선'}역 ${line ? line.stations.length + 1 : 1}`
      const newStation: Station = {
        id: `st-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: autoName,
        ll,
      }
      return {
        lines: state.lines.map((l) => {
          if (l.id !== lineId) return l
          return {
            ...l,
            stations: [...l.stations, newStation],
          }
        }),
      }
    }),

  updateStation: (stationId, patch) =>
    set((state) => ({
      lines: state.lines.map((l) => ({
        ...l,
        stations: l.stations.map((st) => (st.id === stationId ? { ...st, ...patch } : st)),
      })),
    })),

  removeStation: (stationId) =>
    set((state) => ({
      lines: state.lines.map((l) => ({
        ...l,
        stations: l.stations.filter((st) => st.id !== stationId),
      })),
    })),

  newLine: (preset) =>
    set((state) => {
      const id = `line-${Date.now()}`
      const l: Line = {
        id,
        name: preset.name,
        color: preset.color,
        vehicle: 'heavy10',
        mix: { tbm: 70, natm: 20, cut: 10, elevated: 0, surface: 0 },
        smooth: 0.5,
        dwell: 30,
        head: 180,
        fleet: 0,
        loop: false,
        points: [],
        stations: [],
      }
      return {
        lines: [...state.lines, l],
        activeId: id,
        mode: 'draw',
      }
    }),

  addCustomLine: (newLine) =>
    set((state) => ({
      lines: [...state.lines, newLine],
      activeId: newLine.id,
      mode: 'draw',
    })),

  update: (patch) =>
    set((state) => {
      if (!state.activeId) return state
      return {
        lines: state.lines.map((l) => (l.id === state.activeId ? { ...l, ...patch } : l)),
      }
    }),

  setMix: (method, val) =>
    set((state) => {
      if (!state.activeId) return state
      return {
        lines: state.lines.map((l) => {
          if (l.id !== state.activeId) return l
          return {
            ...l,
            mix: { ...l.mix, [method]: val },
          }
        }),
      }
    }),

  removeLine: (id) =>
    set((state) => {
      const remain = state.lines.filter((l) => l.id !== id)
      return {
        lines: remain,
        activeId: remain[0]?.id || null,
      }
    }),

  addLines: (newLines: any[]) =>
    set((state) => {
      const formatted: Line[] = newLines.map((p, idx) => ({
        id: p.id || `line-${Date.now()}-${idx}`,
        name: p.name || '노선',
        color: p.color || '#0052a4',
        vehicle: p.vehicle || 'heavy10',
        mix: p.mix || { tbm: 70, natm: 20, cut: 10, elevated: 0, surface: 0 },
        smooth: typeof p.smooth === 'number' ? p.smooth : 0.5,
        dwell: typeof p.dwell === 'number' ? p.dwell : 30,
        head: typeof p.head === 'number' ? p.head : 180,
        fleet: typeof p.fleet === 'number' ? p.fleet : 0,
        loop: !!p.loop,
        points: p.points || [],
        stations: p.stations || [],
      }))
      return {
        lines: [...state.lines, ...formatted],
        activeId: formatted[0]?.id || state.activeId,
      }
    }),

  importLines: (imported: any[]) =>
    set(() => {
      const fullLines: Line[] = imported.map((p, idx) => ({
        id: p.id || `line-${Date.now()}-${idx}`,
        name: p.name || '노선',
        color: p.color || '#0052a4',
        vehicle: p.vehicle || 'heavy10',
        mix: p.mix || { tbm: 70, natm: 20, cut: 10, elevated: 0, surface: 0 },
        smooth: typeof p.smooth === 'number' ? p.smooth : 0.5,
        dwell: typeof p.dwell === 'number' ? p.dwell : 30,
        head: typeof p.head === 'number' ? p.head : 180,
        fleet: typeof p.fleet === 'number' ? p.fleet : 0,
        loop: !!p.loop,
        points: p.points || [],
        stations: p.stations || [],
      }))
      return {
        lines: fullLines,
        activeId: fullLines[0]?.id || null,
      }
    }),

  setLines: (lines) =>
    set({
      lines,
      activeId: lines[0]?.id || null,
    }),
}))
