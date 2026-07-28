import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { searchStudenti, type StadioRow } from '@/lib/studentiQuery';
import { StadioBadge } from '@/components/admin/candidatura/CandidaturaBadges';

export function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data: results } = useQuery({
    queryKey: ['global-search', q],
    enabled: q.trim().length >= 2,
    queryFn: () => searchStudenti(q),
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  const go = (r: StadioRow) => {
    setOpen(false);
    setQ('');
    const cand = r.candidatura_id ? `?candidatura=${r.candidatura_id}` : '';
    navigate(`/admin/studenti/${r.studente_id}${cand}`);
  };

  return (
    <div className="relative w-72" ref={boxRef}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <Input
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Cerca persona..."
        className="pl-9 h-9"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute right-0 top-full mt-1 w-96 bg-popover border rounded-md shadow-lg z-50 max-h-80 overflow-auto">
          {(results?.length ?? 0) === 0 ? (
            <p className="text-[13px] text-muted-foreground p-3">Nessun risultato</p>
          ) : (
            <ul>
              {results!.map((r) => (
                <li key={`${r.studente_id}-${r.candidatura_id ?? ''}`}>
                  <button
                    type="button"
                    onClick={() => go(r)}
                    className="w-full text-left px-3 py-2 hover:bg-muted flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.cognome} {r.nome}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{r.email}</p>
                    </div>
                    <StadioBadge stadio={r.stadio} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}