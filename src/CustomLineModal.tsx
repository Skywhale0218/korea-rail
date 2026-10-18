import React, { useState } from 'react';
import { useRailStore } from './useRailStore';
import { Line, PRESET_LINES, VEHICLES, VehicleId } from './rail';
import { X, Plus } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomLineModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { addCustomLine } = useRailStore();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#0052a4');
  const [vehicle, setVehicle] = useState<VehicleId>('heavy10');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newLine: Line = {
      id: `line-${Date.now()}`,
      name: name.trim(),
      color,
      vehicle,
      mix: { tbm: 70, natm: 20, cut: 10, elevated: 0, surface: 0 },
      smooth: 0.5,
      dwell: 30,
      head: 180,
      fleet: 0,
      loop: false,
      points: [],
      stations: [],
    };

    addCustomLine(newLine);
    onClose();
    setName('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[3000] flex items-center justify-center p-4">
      <div className="bg-white border border-neutral-300 w-full max-w-sm rounded-xl p-5 shadow-2xl text-black">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-sm">새 철도 노선 만들기</h3>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-black cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-neutral-600 mb-1">노선명</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 수도권 10호선, 대전 3호선"
              className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-black focus:outline-none focus:border-[#0052a4]"
              required
            />
          </div>

          <div>
            <label className="block text-neutral-600 mb-1">차량 규격</label>
            <select
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value as VehicleId)}
              className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-black focus:outline-none focus:border-[#0052a4]"
            >
              {Object.entries(VEHICLES).map(([id, v]) => (
                <option key={id} value={id}>
                  {v.label} ({v.cars}량, 최고 {v.vmax}km/h)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-neutral-600 mb-1.5">노선 색상</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {PRESET_LINES.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setColor(p.color)}
                  className={`w-6 h-6 rounded-full border-2 transition cursor-pointer ${
                    color === p.color ? 'border-black scale-110 shadow-md' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: p.color }}
                  title={p.name}
                />
              ))}
            </div>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full h-8 bg-transparent cursor-pointer rounded"
            />
          </div>

          <button
            type="submit"
            className="w-full mt-2 bg-[#0052a4] hover:bg-[#004080] text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition shadow cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            노선 생성하고 그리기
          </button>
        </form>
      </div>
    </div>
  );
};