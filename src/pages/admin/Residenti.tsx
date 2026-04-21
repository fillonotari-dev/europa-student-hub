import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import { Search, Users as UsersIcon, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

const PAGE_SIZE = 15;
type SortKey = 'nome' | 'email' | 'nazionalita' | 'camera' | 'struttura';

export default function Residenti() {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('nome');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const { data: residenti } = useQuery({
    queryKey: ['residenti'],
    queryFn: async () => {
      const { data } = await supabase
        .from('assegnazioni')
        .select('id, studenti(id, nome, cognome, email, nazionalita), camere(numero, strutture(nome))')
        .eq('stato', 'attiva');
      return data ?? [];
    },
  });

  const filtered = (residenti ?? [])
    .filter((a: any) => {
      if (!search) return true;
      const q = search.toLowerCase();
      const s = a.studenti;
      if (!s) return false;
      return s.nome?.toLowerCase().includes(q) || s.cognome?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
    })
    .sort((a: any, b: any) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'nome':
          return dir * `${a.studenti?.cognome ?? ''} ${a.studenti?.nome ?? ''}`.localeCompare(`${b.studenti?.cognome ?? ''} ${b.studenti?.nome ?? ''}`);
        case 'email':
          return dir * (a.studenti?.email ?? '').localeCompare(b.studenti?.email ?? '');
        case 'nazionalita':
          return dir * (a.studenti?.nazionalita ?? '').localeCompare(b.studenti?.nazionalita ?? '');
        case 'camera':
          return dir * String(a.camere?.numero ?? '').localeCompare(String(b.camere?.numero ?? ''), undefined, { numeric: true });
        case 'struttura':
          return dir * (a.camere?.strutture?.nome ?? '').localeCompare(b.camere?.strutture?.nome ?? '');
      }
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => {
    const active = sortKey === k;
    const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <th className="text-left px-4 py-3 font-semibold">
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? 'text-foreground' : ''}`}
        >
          {label}
          <Icon className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-40'}`} />
        </button>
      </th>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Residenti</h1>
        <p className="text-[13px] text-muted-foreground">Studenti con assegnazione attiva</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Cerca residente..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
      </div>

      <div className="bg-card border border-border/50 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/70 text-xs uppercase tracking-wider text-muted-foreground">
              <SortHeader k="nome" label="Nome" />
              <SortHeader k="email" label="Email" />
              <SortHeader k="nazionalita" label="Nazionalità" />
              <SortHeader k="camera" label="Camera" />
              <SortHeader k="struttura" label="Struttura" />
            </tr>
          </thead>
          <tbody>
            {pageItems.map((a: any, i: number) => (
              <motion.tr key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                className="border-b border-border/30 hover:bg-muted/50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium">{a.studenti?.cognome} {a.studenti?.nome}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{a.studenti?.email}</td>
                <td className="px-4 py-3 text-sm">{a.studenti?.nazionalita || '-'}</td>
                <td className="px-4 py-3 text-sm">{a.camere?.numero || '-'}</td>
                <td className="px-4 py-3 text-sm">{a.camere?.strutture?.nome || '-'}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <UsersIcon className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-[13px] text-muted-foreground">Nessun residente trovato</p>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="flex items-center justify-between text-[13px] text-muted-foreground">
          <span>
            {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} di {filtered.length}
          </span>
          {totalPages > 1 && (
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => { e.preventDefault(); setPage(p => Math.max(1, p - 1)); }}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <PaginationItem key={i}>
                    <PaginationLink
                      href="#"
                      isActive={currentPage === i + 1}
                      onClick={(e) => { e.preventDefault(); setPage(i + 1); }}
                    >
                      {i + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => { e.preventDefault(); setPage(p => Math.min(totalPages, p + 1)); }}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}
    </div>
  );
}
