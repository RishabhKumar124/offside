import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { CLUBS } from '@/lib/clubs';

export default function ClubSearch({ value, onChange }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const filtered = query
    ? CLUBS.filter(c => c.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search for a club..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="pl-9 pr-9"
        />
        {query && (
          <button onClick={() => { setQuery(''); onChange(''); }} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-card border rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {filtered.map(club => (
            <button
              key={club}
              onClick={() => { setQuery(club); onChange(club); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors first:rounded-t-lg last:rounded-b-lg"
            >
              {club}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}