import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { getMapInstance } from './mapRef';

export const SearchBar: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setIsOpen(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&countrycodes=kr&limit=5`
      );
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (lat: string, lon: string) => {
    const map = getMapInstance();
    if (map) {
      map.flyTo([parseFloat(lat), parseFloat(lon)], 16, { duration: 1.2 });
    }
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div className="relative w-72">
      <form onSubmit={handleSearch} className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="건물, 역, 장소 검색 (예: 대전한화생명볼파크)"
          className="w-full bg-slate-800/90 text-white text-xs pl-8 pr-8 py-2 rounded-lg border border-slate-700 shadow-md focus:outline-none focus:border-blue-500 placeholder-slate-400 backdrop-blur-sm"
        />
        <Search className="w-4 h-4 text-slate-400 absolute left-2.5 pointer-events-none" />
        {loading && (
          <Loader2 className="w-4 h-4 text-blue-400 absolute right-2.5 animate-spin" />
        )}
      </form>

      {isOpen && results.length > 0 && (
        <div className="absolute left-0 top-full mt-1.5 w-full bg-slate-900/95 border border-slate-700 rounded-lg shadow-2xl overflow-hidden z-[1000] backdrop-blur-md">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => handleSelect(r.lat, r.lon)}
              className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-blue-600/40 border-b border-slate-800 last:border-b-0 transition flex flex-col gap-0.5"
            >
              <span className="font-semibold text-white truncate">{r.display_name.split(',')[0]}</span>
              <span className="text-[10px] text-slate-400 truncate">{r.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};