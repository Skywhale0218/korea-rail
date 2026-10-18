import { create } from 'zustand';
import { Line, LL, Station, Method } from './rail';

export type Mode = 'pan' | 'draw' | 'station' | 'select';

interface RailStore {
  lines: Line[];
  activeId: string | null;
  activeLineId: string | null;
  mode: Mode;
  extendDirection: 'start' | 'end';
  selectedPointIndex: number | null;
  speed: number;
  playing: boolean;
  overhead: number;

  setActive: (id: string | null) => void;
  setActiveLineId: (id: string | null) => void;
  setMode: (mode: Mode) => void;
  setSpeed: (speed: number) => void;
  togglePlay: () => void;
  setOverhead: (v: number) => void;
  setExtendDirection: (dir: 'start' | 'end') => void;
  toggleExtendDirection: () => void;
  setSelectedPointIndex: (idx: number | null) => void;

  addPoint: (pt: LL) => void;
  insertPoint: (index: number, pt: LL) => void;
  removePoint: (index: number) => void;
  undoPoint: () => void;
  removeLastPoint: () => void;

  addStation: (lineIdOrStation: string | Station, maybeLL?: LL) => void;
  updateStation: (stationId: string, patch: Partial<Station>) => void;
  removeStation: (stationId: string) => void;
  newLine: (preset: { name: string; color: string }) => void;
  addCustomLine: (line: Line) => void;
  update: (patch: Partial<Line>) => void;
  setMix: (method: Method, val: number) => void;
  removeLine: (id: string) => void;

  // ImportTab.tsx 및 App.tsx의 느슨한 타입 모두 허용
  addLines: (newLines: any[]) => void;
  importLines: (lines: any[]) => void;
  setLines: (lines: Line[]) => void;
}

export const useRailStore = create<RailStore>((set) => ({
  lines: [],
  activeId: null,
  activeLineId: null,
  mode: 'pan',
  extendDirection: 'end',
  selectedPointIndex: null,
  speed: 1,
  playing: true,
  overhead: 0.1,

  setActive: (id) => set({ activeId: id, activeLineId: id }),
  setActiveLineId: (id) => set({ activeId: id, activeLineId: id }),
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
      const curId = state.activeId || state.activeLineId;
      if (!curId) return state;
      return {
        lines: state.lines.map((l) => {
          if (l.id !== curId) return l;
          const newPoints =
            state.extendDirection === 'start' ? [pt, ...l.points] : [...l.points, pt];
          return { ...l, points: newPoints };
        }),
      };
    }),

  insertPoint: (index, pt) =>
    set((state) => {
      const curId = state.activeId || state.activeLineId;
      if (!curId) return state;
      return {
        lines: state.lines.map((l) => {
          if (l.id !== curId) return l;
          const newPoints = [...l.points];
          newPoints.splice(index, 0, pt);
          return { ...l, points: newPoints };
        }),
      };
    }),

  removePoint: (index) =>
    set((state) => {
      const curId = state.activeId || state.activeLineId;
      if (!curId) return state;
      return {
        selectedPointIndex: null,
        lines: state.lines.map((l) => {
          if (l.id !== curId) return l;
          const newPoints = l.points.filter((_, i) => i !== index);
          return { ...l, points: newPoints };
        }),
      };
    }),

  undoPoint: () =>
    set((state) => {
      const curId = state.activeId || state.activeLineId;
      if (!curId) return state;
      return {
        lines: state.lines.map((l) => {
          if (l.id !== curId || l.points.length === 0) return l;
          const idx = state.extendDirection === 'start' ? 0 : l.points.length - 1;
          const newPoints = l.points.filter((_, i) => i !== idx);
          return { ...l, points: newPoints };
        }),
      };
    }),

  removeLastPoint: () =>
    set((state) => {
      const curId = state.activeId || state.activeLineId;
      if (!curId) return state;
      return {
        lines: state.lines.map((l) => {
          if (l.id !== curId || l.points.length === 0) return l;
          const idx = state.extendDirection === 'start' ? 0 : l.points.length - 1;
          const newPoints = l.points.filter((_, i) => i !== idx);
          return { ...l, points: newPoints };
        }),
      };
    }),

  addStation: (arg1, maybeLL) =>
    set((state) => {
      let targetLineId: string | null = null;
      let newStation: Station;

      if (typeof arg1 === 'string' && maybeLL) {
        targetLineId = arg1;
        const line = state.lines.find((l) => l.id === targetLineId);
        const autoName = `${line ? line.name : '노선'}역 ${line ? line.stations.length + 1 : 1}`;
        newStation = {
          id: `st-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: autoName,
          ll: maybeLL,
        };
      } else {
        targetLineId = state.activeId || state.activeLineId;
        newStation = arg1 as Station;
      }

      if (!targetLineId) return state;

      return {
        lines: state.lines.map((l) => {
          if (l.id !== targetLineId) return l;
          return {
            ...l,
            stations: [...l.stations, newStation],
          };
        }),
      };
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
      const id = `line-${Date.now()}`;
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
      };
      return {
        lines: [...state.lines, l],
        activeId: id,
        activeLineId: id,
        mode: 'draw',
      };
    }),

  addCustomLine: (newLine) =>
    set((state) => ({
      lines: [...state.lines, newLine],
      activeId: newLine.id,
      activeLineId: newLine.id,
      mode: 'draw',
    })),

  update: (patch) =>
    set((state) => {
      const curId = state.activeId || state.activeLineId;
      if (!curId) return state;
      return {
        lines: state.lines.map((l) => (l.id === curId ? { ...l, ...patch } : l)),
      };
    }),

  setMix: (method, val) =>
    set((state) => {
      const curId = state.activeId || state.activeLineId;
      if (!curId) return state;
      return {
        lines: state.lines.map((l) => {
          if (l.id !== curId) return l;
          return {
            ...l,
            mix: { ...l.mix, [method]: val },
          };
        }),
      };
    }),

  removeLine: (id) =>
    set((state) => {
      const remain = state.lines.filter((l) => l.id !== id);
      const nextId = remain[0]?.id || null;
      return {
        lines: remain,
        activeId: nextId,
        activeLineId: nextId,
      };
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
      }));
      const combined = [...state.lines, ...formatted];
      return {
        lines: combined,
        activeId: formatted[0]?.id || state.activeId,
        activeLineId: formatted[0]?.id || state.activeLineId,
      };
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
      }));
      return {
        lines: fullLines,
        activeId: fullLines[0]?.id || null,
        activeLineId: fullLines[0]?.id || null,
      };
    }),

  setLines: (lines) =>
    set({
      lines,
      activeId: lines[0]?.id || null,
      activeLineId: lines[0]?.id || null,
    }),
}));
