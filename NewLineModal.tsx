import { useState } from 'react'
import { X } from 'lucide-react'
import { PRESET_LINES, SYSTEMS, VEHICLES, type SystemType, type VehicleId } from './rail'
import { useRailStore } from './useRailStore'

const COLORS = [...PRESET_LINES.map((p) => p.color), '#000000', '#0052a4', '#6b7280']
const inp = 'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-black'

/** [+ 새 노선 만들기] — 이름·색·시스템 유형·설계 최고속도를 정해 빈 노선을 만들어요 */
export default function NewLineModal({ onClose }: { onClose: () => void }) {
  const n = useRailStore((s) => s.lines.length) + 1
  const newCustomLine = useRailStore((s) => s.newCustomLine)
  const [name, setName] = useState(`${n}호선`)
  const [color, setColor] = useState(PRESET_LINES[(n - 1) % PRESET_LINES.length].color)
  const [system, setSystem] = useState<SystemType>('heavy')
  const [vehicle, setVehicle] = useState<VehicleId>(SYSTEMS.heavy.vehicle)
  const [vmax, setVmax] = useState(SYSTEMS.heavy.vmax)

  const pickSystem = (s: SystemType) => { setSystem(s); setVehicle(SYSTEMS[s].vehicle); setVmax(SYSTEMS[s].vmax) }
  const create = () => {
    newCustomLine({ name: name.trim() || `${n}호선`, color, system, vehicle, vmax: Math.max(10, vmax || 0) })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[1300] grid place-items-center bg-black/40 p-3" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-neutral-300 bg-white p-5 text-black shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">새 노선 만들기</h2>
          <button onClick={onClose} aria-label="닫기" className="p-1 text-neutral-500 hover:text-black"><X size={18} /></button>
        </div>
        <div className="grid gap-3 text-sm">
          <label className="grid gap-1">노선 이름
            <input className={inp} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <div className="grid gap-1.5">노선 색
            <div className="flex flex-wrap items-center gap-1.5">
              {COLORS.map((c) => (
                <button key={c} aria-label={c} onClick={() => setColor(c)} className="h-7 w-7 rounded-full border-2"
                  style={{ background: c, borderColor: color === c ? '#000' : '#fff', boxShadow: '0 0 0 1px #aaa' }} />
              ))}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-neutral-300 bg-white p-0.5" aria-label="직접 고르기" />
            </div>
            <div className="flex flex-wrap gap-1">
              {PRESET_LINES.slice(0, 12).map((p) => (
                <button key={p.name} onClick={() => { setColor(p.color); setName(p.name) }}
                  className="rounded-full border border-neutral-300 px-2 py-0.5 text-xs hover:border-[#0052a4] hover:text-[#0052a4]">{p.name}</button>
              ))}
            </div>
          </div>
          <label className="grid gap-1">시스템 유형
            <select className={inp} value={system} onChange={(e) => pickSystem(e.target.value as SystemType)}>
              {Object.entries(SYSTEMS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1">차량
            <select className={inp} value={vehicle} onChange={(e) => setVehicle(e.target.value as VehicleId)}>
              {Object.entries(VEHICLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1">설계 최고속도 (km/h)
            <input className={inp} type="number" min={10} max={400} value={vmax} onChange={(e) => setVmax(+e.target.value)} />
          </label>
          <button onClick={create} className="rounded-lg border border-[#0052a4] bg-[#0052a4] px-3 py-2.5 font-semibold text-white hover:bg-[#003f80]">
            만들고 선로 그리기 시작
          </button>
        </div>
      </div>
    </div>
  )
}
