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
import { Search } from 'lucide-react';
import { ExportButton } from '@/components/admin/ExportButton';
import { fmtDateTime } from '@/lib/exportXlsx';
import { formatStato, STATO_LABELS as STATO_LABELS_CANON } from '@/lib/statoCandidatura';

const STATO_LABELS = STATO_LABELS_CANON;
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

  // La prima riga della cronologia di una candidatura si identifica per
  // posizione cronologica (created_at più antico), non per assenza di stato_precedente.
  const firstLogIdByCandidatura = useMemo(() => {
    const oldest = new Map<string, { id: string; ts: number }>();
    for (const l of logs as any[]) {
      const candId = l.candidatura_id;
      if (!candId) continue;
      const ts = new Date(l.created_at).getTime();
      const cur = oldest.get(candId);
      if (!cur || ts < cur.ts) oldest.set(candId, { id: l.id, ts });
    }
    return new Set(Array.from(oldest.values()).map(v => v.id));
  }, [logs]);

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
      <div className="flex justify-end">
        <ExportButton
          filename="storico_candidature"
          getRows={() => filtered.map((l: any) => ({
            'Data': fmtDateTime(l.created_at),
            'Studente': l.candidature?.studenti ? `${l.candidature.studenti.nome} ${l.candidature.studenti.cognome}` : '',
            'Email': l.candidature?.studenti?.email ?? '',
            'Stato precedente': l.stato_precedente ? formatStato(l.stato_precedente) : '',
            'Stato nuovo': formatStato(l.stato_nuovo),
            'Note': l.note ?? '',
          }))}
        />
      </div>
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
                <th className="px-4 py-3 font-medium">Evento</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((l: any) => {
                const s = l.candidature?.studenti;
                const isFirst = firstLogIdByCandidatura.has(l.id);
                const isTransition = !isFirst && !!l.stato_precedente && l.stato_precedente !== l.stato_nuovo;
                const hasNote = !!(l.note && String(l.note).trim());
                return (
                  <tr key={l.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString('it-IT')}
                    </td>
                    <td className="px-4 py-3">
                      {s ? `${s.nome} ${s.cognome}` : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <div className="text-[13px]">
                          {isFirst ? (
                            l.stato_nuovo === 'da_valutare'
                              ? <>Candidatura ricevuta</>
                              : <>Candidatura registrata come <strong>{formatStato(l.stato_nuovo)}</strong></>
                          ) : isTransition ? (
                            <>Stato passato da <strong>{formatStato(l.stato_precedente)}</strong> a <strong>{formatStato(l.stato_nuovo)}</strong></>
                          ) : hasNote ? (
                            <span className="whitespace-pre-wrap">{l.note}</span>
                          ) : (
                            <>Stato registrato: <strong>{formatStato(l.stato_nuovo)}</strong></>
                          )}
                        </div>
                        {hasNote && (isFirst || isTransition) && (
                          <div className="text-[12px] text-muted-foreground whitespace-pre-wrap">{l.note}</div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pageItems.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
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