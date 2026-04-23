import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import { Search } from 'lucide-react';

const PAGE_SIZE = 20;

export default function StoricoResidenti() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: rows = [] } = useQuery({
    queryKey: ['storico-residenti'],
    queryFn: async () => {
      const { data } = await supabase
        .from('assegnazioni')
        .select('*, studenti(nome, cognome, email), camere(numero, piano, tipo, strutture(nome))')
        .neq('stato', 'attiva')
        .order('data_fine', { ascending: false, nullsFirst: false });
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r: any) => {
      const s = r.studenti;
      const c = r.camere;
      const blob = `${s?.nome ?? ''} ${s?.cognome ?? ''} ${s?.email ?? ''} ${c?.strutture?.nome ?? ''} ${c?.numero ?? ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const durata = (a?: string | null, b?: string | null) => {
    if (!a || !b) return '—';
    const d = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
    return `${d} gg`;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Card className="p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca studente, struttura o camera..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Studente</th>
                <th className="px-4 py-3 font-medium">Struttura / Camera</th>
                <th className="px-4 py-3 font-medium">Periodo</th>
                <th className="px-4 py-3 font-medium">Durata</th>
                <th className="px-4 py-3 font-medium">Stato</th>
                <th className="px-4 py-3 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((r: any) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3">
                    {r.studenti ? `${r.studenti.nome} ${r.studenti.cognome}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.camere?.strutture?.nome ?? '—'} · Camera {r.camere?.numero ?? '—'} · Posto {r.posto}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {r.data_inizio ? new Date(r.data_inizio).toLocaleDateString('it-IT') : '—'} → {r.data_fine ? new Date(r.data_fine).toLocaleDateString('it-IT') : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{durata(r.data_inizio, r.data_fine)}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{r.stato}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{r.note || '—'}</td>
                </tr>
              ))}
              {pageItems.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Nessun residente nello storico
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