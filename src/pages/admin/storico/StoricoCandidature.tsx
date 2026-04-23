import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import { Search, ArrowRight } from 'lucide-react';

const STATO_LABELS: Record<string, string> = {
  ricevuta: 'Ricevuta', in_valutazione: 'In valutazione', approvata: 'Approvata',
  rifiutata: 'Rifiutata', ritirata: 'Ritirata', sostituita: 'Sostituita',
};
const PAGE_SIZE = 20;

export default function StoricoCandidature() {
  const [search, setSearch] = useState('');
  const [filterStato, setFilterStato] = useState<string>('tutti');
  const [page, setPage] = useState(1);

  const { data: logs = [] } = useQuery({
    queryKey: ['storico-candidature'],
    queryFn: async () => {
      const { data } = await supabase
        .from('log_stato_candidature')
        .select('*, candidature(id, studenti(nome, cognome, email))')
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l: any) => {
      if (filterStato !== 'tutti' && l.stato_nuovo !== filterStato) return false;
      if (!q) return true;
      const s = l.candidature?.studenti;
      const name = `${s?.nome ?? ''} ${s?.cognome ?? ''} ${s?.email ?? ''}`.toLowerCase();
      return name.includes(q);
    });
  }, [logs, search, filterStato]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Card className="p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca studente..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={filterStato} onValueChange={(v) => { setFilterStato(v); setPage(1); }}>
          <SelectTrigger className="w-full md:w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti gli stati</SelectItem>
            {Object.entries(STATO_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Studente</th>
                <th className="px-4 py-3 font-medium">Transizione</th>
                <th className="px-4 py-3 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((l: any) => {
                const s = l.candidature?.studenti;
                return (
                  <tr key={l.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString('it-IT')}
                    </td>
                    <td className="px-4 py-3">
                      {s ? `${s.nome} ${s.cognome}` : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {l.stato_precedente ? (
                          <Badge variant="outline">{STATO_LABELS[l.stato_precedente] ?? l.stato_precedente}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">—</Badge>
                        )}
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <Badge>{STATO_LABELS[l.stato_nuovo] ?? l.stato_nuovo}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-md truncate">
                      {l.note || '—'}
                    </td>
                  </tr>
                );
              })}
              {pageItems.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Nessun evento storico
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious onClick={() => setPage((p) => Math.max(1, p - 1))} />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink isActive>{page} / {totalPages}</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext onClick={() => setPage((p) => Math.min(totalPages, p + 1))} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </motion.div>
  );
}