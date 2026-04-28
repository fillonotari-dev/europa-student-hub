import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import { Search, Eye } from 'lucide-react';
import { ExportButton } from '@/components/admin/ExportButton';
import { useStrutturaFilter } from '@/hooks/useStrutturaFilter';
import { StrutturaSelect } from '@/components/admin/StrutturaSelect';

const PAGE_SIZE = 20;

export default function StoricoCamere() {
  const { strutturaId, setStrutturaId, strutture, isAll } = useStrutturaFilter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any>(null);

  const { data: camere = [] } = useQuery({
    queryKey: ['storico-camere', strutturaId],
    queryFn: async () => {
      let q = supabase
        .from('camere')
        .select('*, strutture(nome), assegnazioni(id, posto, stato, data_inizio, data_fine, studenti(nome, cognome))')
        .order('numero', { ascending: true });
      if (!isAll) q = q.eq('struttura_id', strutturaId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return camere;
    return camere.filter((c: any) => {
      const blob = `${c.strutture?.nome ?? ''} ${c.numero} ${c.tipo}`.toLowerCase();
      return blob.includes(q);
    });
  }, [camere, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const timeline = useMemo(() => {
    if (!selected) return [];
    return [...(selected.assegnazioni ?? [])].sort((a: any, b: any) => {
      return new Date(b.data_inizio ?? 0).getTime() - new Date(a.data_inizio ?? 0).getTime();
    });
  }, [selected]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <StrutturaSelect
          value={strutturaId}
          onChange={(v) => { setStrutturaId(v); setPage(1); }}
          strutture={strutture}
        />
        <ExportButton
          filename="storico_camere"
          getRows={() => filtered.map((c: any) => ({
            'Struttura': c.strutture?.nome ?? '',
            'Camera': c.numero,
            'Piano': c.piano ?? '',
            'Tipo': c.tipo,
            'Posti': c.posti,
            'Assegnazioni totali': c.assegnazioni?.length ?? 0,
            'Assegnazioni attive': (c.assegnazioni ?? []).filter((a: any) => a.stato === 'attiva').length,
          }))}
        />
      </div>
      <Card className="p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per struttura, numero o tipo..."
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
                <th className="px-4 py-3 font-medium">Struttura</th>
                <th className="px-4 py-3 font-medium">Camera</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Assegnazioni totali</th>
                <th className="px-4 py-3 font-medium">Attive</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((c: any) => {
                const tot = c.assegnazioni?.length ?? 0;
                const attive = (c.assegnazioni ?? []).filter((a: any) => a.stato === 'attiva').length;
                return (
                  <tr key={c.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">{c.strutture?.nome ?? '—'}</td>
                    <td className="px-4 py-3">N° {c.numero}{c.piano != null ? ` · piano ${c.piano}` : ''}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.tipo}</td>
                    <td className="px-4 py-3">{tot}</td>
                    <td className="px-4 py-3">{attive}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelected(c)}>
                        <Eye className="w-4 h-4 mr-1" /> Timeline
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {pageItems.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Nessuna camera trovata
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

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Timeline · {selected?.strutture?.nome} · Camera {selected?.numero}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {timeline.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Nessuna assegnazione registrata</p>
            )}
            {timeline.map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">
                      {a.studenti ? `${a.studenti.nome} ${a.studenti.cognome}` : '—'}
                    </span>
                    <Badge variant="outline">Posto {a.posto}</Badge>
                    <Badge variant={a.stato === 'attiva' ? 'default' : 'outline'}>{a.stato}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {a.data_inizio ? new Date(a.data_inizio).toLocaleDateString('it-IT') : '—'}
                    {' → '}
                    {a.data_fine ? new Date(a.data_fine).toLocaleDateString('it-IT') : 'in corso'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}