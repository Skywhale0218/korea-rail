import { create } from 'zustand';
import { Line, LL, Station, Method } from './rail';

export type Mode = 'pan' | 'draw' | 'station' | 'select';

interface RailStore {
  lines: Line[];
  activeId: string | null;
  activeLineId: string | null; // 호환성 유지용
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

  // 선로 점 조작
  addPoint: (pt: LL) => void;
  insertPoint: (index: number, pt: LL) => void;
  removePoint: (index: number) => void;
  undoPoint: () => void;
  removeLastPoint: () => void;

  // 역 및 노선 조작
  addStation: (lineIdOrStation: string | Station, maybeLL?: LL) => void;
  updateStation: (stationId: string, patch: Partial<Station>) => void;
  removeStation: (stationId: string) => void;
  newLine: (preset: { name: string; color: string }) => void;
  addCustomLine: (line: Line) => void;
  update: (patch: Partial<Line>) => void;
  setMix: (method: Method, val: number) => void;
  removeLine: (id: string) => void;

  // 전체 데이터 교체
  importLines: (lines: Line[]) => void;
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

  newLine