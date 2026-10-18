import React, { useState } from 'react';
import { useRailStore } from './useRailStore';
import { X, Plus } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#0052A4', '#00A84D', '#EF7C1C', '#00A5DE', '#996CAC',
  '#CD7C2F', '#747F00', '#EA545D', '#BDB092', '#26A9E0',
  '#7CA8D5', '#F5A200', '#B0CE18', '#81A914'
];

export const CustomLineModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { addCustomLine } = useRailStore();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#0052A4');
  const [system, setSystem] = useState<'metro' | 'light' | 'tram' | 'gtx' | 'hsr'>('metro');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addCustomLine({
      id: `custom-${Date.now()}`,
      name: name.trim(),
      color,
      system,
      carsPerTrain: system === 'metro' ? 8 : system === 'gtx' ? 8 : 4,
      costUndergroundKm: 1300,
      costElevatedKm: 700,
      costSurfaceKm: 350,
      costStation: 450,
      costCar: 18,
    });

    onClose();
    setName('');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-xl p-5 shadow-2xl text-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-sm">새 철도 노선 만들기</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">노선명</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 수도권 10호선, 대전 3호선"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">시스템 규격</label>
            <select
              value={system}
              onChange={(e: any) => setSystem(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="metro">중전철 (대형 지하철)</option>
              <option value="light">경전철 (AGT / 모노레일)</option>
              <option value="tram">트램 (노면전차)</option>
              <option value="gtx">광역급행철도 (GTX급)</option>
              <option value="hsr">고속철도</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1.5">노선 고유 색상</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition ${
                    color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
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
            className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition shadow-lg shadow-blue-600/30"
          >
            <Plus className="w-4 h-4" />
            노선 생성하고 그리기
          </button>
        </form>
      </div>
    </div>
  );
};