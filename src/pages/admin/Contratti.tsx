import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import { ContrattoDialog } from '@/components/admin/contratti/ContrattoDialog';
import { RowActions } from '@/components/admin/RowActions';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { eliminaContrattoBozza } from '@/lib/contrattoDelete';
import { FileText, Plus, Search, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { lordoDaImponibile } from '@/lib/iva';

const PAGE_SIZE = 15;

export const STATI_CONTRATTO = ['bozza', 'attivo', 'scaduto', 'risolto', 'rinnovato'] as const;

export const STATO_CONTRATTO_COLORS: Record<string, string> = {
  bozza: 'bg-muted text-muted-foreground',
  attivo: 'bg-primary/10 text-primary',
  scaduto: 'bg-muted text-muted-foreground',
  risolto: 'bg-destructive/10 text-destructive',
  rinnovato: 'bg-accent/20 text-accent-foreground',
};

export const fmtEuro = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(n));

export const fmtIt = (d?: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('it-IT') : '—');

export default function Contratti() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [openNuovo, setOpenNuovo] = useState(false);
  const [daEliminare, setDaEliminare] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const elimina = async () => {
    if (!daEliminare) return;
    setBusy(true);
    try {
      await eliminaContrattoBozza(daEliminare);
      toast({ title: 'Contratto eliminato' });
      setDaEliminare(null);
      qc.invalidateQueries({ queryKey: ['contratti'] });
    } catch (e: any) {
      toast({ title: 'Errore', description: e?.message ?? 'Eliminazione non riuscita', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const search = searchParams.get('q') ?? '';
  const filterStato = searchParams.get('stato') ?? 'tutti';
  const filterStruttura = searchParams.get('sede') ?? 'tutti';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);

  const patchParams = (patch: Record<string, string | null>, opts: { resetPage?: boolean } = {}) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k); else next.set(k, v);
    }
    if (opts.resetPage) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const { data: strutture } = useQuery({
    queryKey: ['strutture-tutte'],
    queryFn: async () => (await supabase.from('strutture').select('id, nome').order('nome')).data ?? [],
  });

  const { data: rows } = useQuery({
    queryKey: ['contratti', 'lista'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contratti')
        .select(`id, stato, data_inizio, data_fine, canone_mensile, aliquota_iva, struttura_id, file_firmato_path,
                 deposito_richiesto, deposito_importo, studente_id,
                 studenti(nome, cognome), strutture(nome)`)
        .order('data_inizio', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    return (rows ?? [])
      .filter((r: any) => filterStato === 'tutti' || r.stato === filterStato)
      .filter((r: any) => filterStruttura === 'tutti' || r.struttura_id === filterStruttura)
      .filter((r: any) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return `${r.studenti?.cognome ?? ''} ${r.studenti?.nome ?? ''}`.toLowerCase().includes(q);
      });
  }, [rows, filterStato, filterStruttura, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cerca per nome..." value={search} className="pl-9"
            onChange={e => patchParams({ q: e.target.value || null }, { resetPage: true })} />
        </div>
        <Select value={filterStato} onValueChange={v => patchParams({ stato: v === 'tutti' ? null : v }, { resetPage: true })}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti gli stati</SelectItem>
            {STATI_CONTRATTO.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStruttura} onValueChange={v => patchParams({ sede: v === 'tutti' ? null : v }, { resetPage: true })}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutte le sedi</SelectItem>
            {(strutture ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button className="ml-auto" onClick={() => setOpenNuovo(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nuovo contratto
        </Button>
      </div>

      <div className="bg-card border border-border/50 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/70 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-4 py-3 font-semibold">Studente</th>
              <th className="text-left px-4 py-3 font-semibold">Struttura</th>
              <th className="text-left px-4 py-3 font-semibold">Periodo</th>
              <th className="text-left px-4 py-3 font-semibold">Canone</th>
              <th className="text-left px-4 py-3 font-semibold">Stato</th>
              <th className="text-left px-4 py-3 font-semibold">Deposito</th>
              <th className="text-left px-4 py-3 font-semibold">PDF firmato</th>
              <th />
            </tr>
          </thead>
          <tbody className="text-sm">
            {pageItems.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Nessun contratto</td></tr>
            )}
            {pageItems.map((r: any) => (
              <tr key={r.id} className="border-t border-border/50 hover:bg-muted/50 cursor-pointer"
                onClick={() => navigate(`/admin/contratti/${r.id}`)}>
                <td className="px-4 py-3">
                  <button type="button" className="hover:underline text-left"
                    onClick={e => { e.stopPropagation(); navigate(`/admin/studenti/${r.studente_id}`); }}>
                    {r.studenti?.cognome} {r.studenti?.nome}
                  </button>
                </td>
                <td className="px-4 py-3">{r.strutture?.nome ?? '—'}</td>
                <td className="px-4 py-3">{fmtIt(r.data_inizio)} → {fmtIt(r.data_fine)}</td>
                <td className="px-4 py-3">{fmtEuro(lordoDaImponibile(Number(r.canone_mensile), Number(r.aliquota_iva) || 0))}</td>
                <td className="px-4 py-3">
                  <span className={cn('text-[11px] uppercase tracking-wider px-2 py-0.5 rounded',
                    STATO_CONTRATTO_COLORS[r.stato] ?? 'bg-muted text-muted-foreground')}>{r.stato}</span>
                </td>
                <td className="px-4 py-3">{r.deposito_richiesto ? fmtEuro(r.deposito_importo) : 'non richiesto'}</td>
                <td className="px-4 py-3">
                  {r.file_firmato_path
                    ? <span className="inline-flex items-center gap-1 text-primary"><FileText className="w-4 h-4" /> Sì</span>
                    : <span className="text-muted-foreground">No</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  {r.stato === 'bozza' && (
                    <RowActions>
                      <DropdownMenuItem className="text-destructive focus:text-destructive"
                        onSelect={(e) => { e.preventDefault(); setDaEliminare(r); }}>
                        <Trash2 className="w-4 h-4 mr-2" /> Elimina contratto
                      </DropdownMenuItem>
                    </RowActions>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!daEliminare} onOpenChange={(o) => { if (!o) setDaEliminare(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la bozza di contratto?</AlertDialogTitle>
            <AlertDialogDescription>
              L'operazione non è reversibile. {daEliminare?.file_firmato_path
                ? 'Verrà eliminato prima il PDF allegato e poi il contratto. '
                : ''}
              I dati di fatturazione dello studente restano disponibili per altri contratti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annulla</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); elimina(); }} disabled={busy}>Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" onClick={e => { e.preventDefault(); patchParams({ page: currentPage > 2 ? String(currentPage - 1) : null }); }} />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <PaginationItem key={p}>
                <PaginationLink href="#" isActive={p === currentPage}
                  onClick={e => { e.preventDefault(); patchParams({ page: p > 1 ? String(p) : null }); }}>{p}</PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext href="#" onClick={e => { e.preventDefault(); patchParams({ page: String(Math.min(totalPages, currentPage + 1)) }); }} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <ContrattoDialog open={openNuovo} onOpenChange={setOpenNuovo}
        onCreated={(id) => navigate(`/admin/contratti/${id}`)} />
    </div>
  );
}
