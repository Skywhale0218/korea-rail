import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { mapRef } from './mapRef';

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
    const map = mapRef.current;
    if (map) {
      map.flyTo([parseFloat(lat), parseFloat(lon)], 16, { duration: 1.2 });
    }
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div className="relative w-64 md:w-72">
      <form onSubmit={handleSearch} className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="건물, 역 검색 (예: 인천국제공항)"
          className="w-full bg-white text-black text-xs pl-8 pr-7 py-1.5 rounded-lg border border-neutral-300 shadow-sm focus:outline-none focus:border-[#0052a4] placeholder-neutral-400"
        />
        <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 pointer-events-none" />
        {loading && (
          <Loader2 className="w-3.5 h-3.5 text-blue-600 absolute right-2.5 animate-spin" />
        )}
      </form>

      {isOpen && results.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-full bg-white border border-neutral-200 rounded-lg shadow-xl overflow-hidden z-[2000]">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(r.lat, r.lon)}
              className="w-full text-left px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-100 border-b border-neutral-100 last:border-b-0 flex flex-col gap-0.5 cursor-pointer"
            >
              <span className="font-semibold text-black truncate">{r.display_name.split(',')[0]}</span>
              <span className="text-[10px] text-neutral-500 truncate">{r.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
