import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { RowActions } from '@/components/admin/RowActions';
import { useToast } from '@/hooks/use-toast';
import { ExportButton } from '@/components/admin/ExportButton';
import { fmtDate } from '@/lib/exportXlsx';
import { Search, Users as UsersIcon, ArrowUp, ArrowDown, ArrowUpDown, User, ArrowRightLeft, LogOut, Mail } from 'lucide-react';
import { STADI_RESIDENTI, formatStadio } from '@/lib/statoCandidatura';
import { StadioBadge } from '@/components/admin/candidatura/CandidaturaBadges';
import { fetchStadi, type StadioRow } from '@/lib/studentiQuery';

const PAGE_SIZE = 15;
type SortKey = 'nome' | 'email' | 'camera' | 'struttura' | 'stadio';

export default function Residenti() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') ?? '';
  const filterStadio = searchParams.get('stadio') ?? 'tutti';
  const filterStruttura = searchParams.get('sede') ?? 'tutti';
  const sortKey = ((searchParams.get('sk') as SortKey) ?? 'nome');
  const sortDir = ((searchParams.get('sd') as 'asc' | 'desc') ?? 'asc');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);

  const patchParams = (patch: Record<string, string | null>, opts: { resetPage?: boolean } = {}) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k); else next.set(k, v);
    }
    if (opts.resetPage) next.delete('page');
    setSearchParams(next, { replace: true });
  };
  const setPage = (p: number | ((prev: number) => number)) => {
    const val = typeof p === 'function' ? p(page) : p;
    patchParams({ page: val > 1 ? String(val) : null });
  };

  const openScheda = (studenteId: string) => {
    const qs = searchParams.toString();
    const suffix = qs ? `&${qs}` : '';
    navigate(`/admin/studenti/${studenteId}?from=residenti${suffix}`);
  };

  const [transferTarget, setTransferTarget] = useState<StadioRow | null>(null);
  const [transferCameraId, setTransferCameraId] = useState<string>('');
  const [transferData, setTransferData] = useState<string>(new Date().toISOString().split('T')[0]);
  const [transferFine, setTransferFine] = useState<string>('');
  const [endTarget, setEndTarget] = useState<StadioRow | null>(null);
  const [endData, setEndData] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endNote, setEndNote] = useState('');
  const [endMotivo, setEndMotivo] = useState<string>('');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rows } = useQuery({
    queryKey: ['stadio', 'residenti'],
    queryFn: () => fetchStadi([...STADI_RESIDENTI, 'archiviato']),
  });

  const { data: strutture } = useQuery({
    queryKey: ['strutture-tutte'],
    queryFn: async () => {
      const { data } = await supabase.from('strutture').select('id, nome').order('nome');
      return data ?? [];
    },
  });

  const { data: tutteCamere } = useQuery({
    queryKey: ['camere-disponibili'],
    queryFn: async () => {
      const { data } = await supabase.from('camere').select('*, strutture(nome)').neq('stato', 'manutenzione');
      return data ?? [];
    },
  });

  const { data: tutteAssegnazioniAttive } = useQuery({
    queryKey: ['assegnazioni-attive'],
    queryFn: async () => {
      const { data } = await supabase.from('assegnazioni').select('camera_id').eq('stato', 'attiva');
      return data ?? [];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['stadio'] });
    queryClient.invalidateQueries({ queryKey: ['camere'] });
    queryClient.invalidateQueries({ queryKey: ['assegnazioni-attive'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  };

  const transferisci = useMutation({
    mutationFn: async (v: { assegnazione_id: string; studente_id: string; vecchia_camera_id: string;
                            nuova_camera_id: string; nuova_data_inizio: string; nuova_data_fine: string }) => {
      if (v.nuova_camera_id === v.vecchia_camera_id) throw new Error('La camera di destinazione coincide con quella attuale.');
      const { data: disp, error: dispErr } = await supabase.rpc('camere_disponibilita', {
        p_dal: v.nuova_data_inizio, p_al: v.nuova_data_fine, p_struttura_id: null,
      });
      if (dispErr) throw dispErr;
      const row = (disp ?? []).find((r: any) => r.camera_id === v.nuova_camera_id);
      if (!row) throw new Error('Camera non trovata.');
      const occupati: number[] = row.posti_occupati_numeri ?? [];
      let nextPosto = 0;
      for (let p = 1; p <= row.posti; p++) if (!occupati.includes(p)) { nextPosto = p; break; }
      if (nextPosto === 0) throw new Error('La camera non ha posti liberi nel periodo scelto.');
      const { data: lastCand } = await supabase
        .from('candidature').select('id').eq('studente_id', v.studente_id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!lastCand) throw new Error('Nessuna candidatura trovata per lo studente.');
      const inizio = new Date(v.nuova_data_inizio + 'T00:00:00Z');
      const chiusuraStr = new Date(inizio.getTime() - 86400000).toISOString().split('T')[0];
      const { error: updErr } = await supabase.from('assegnazioni')
        .update({ stato: 'conclusa', data_fine: chiusuraStr, motivo_chiusura: 'trasferimento' })
        .eq('id', v.assegnazione_id);
      if (updErr) throw updErr;
      const { error: insErr } = await supabase.from('assegnazioni').insert({
        camera_id: v.nuova_camera_id, studente_id: v.studente_id, candidatura_id: lastCand.id,
        posto: nextPosto, data_inizio: v.nuova_data_inizio, data_fine: v.nuova_data_fine, stato: 'attiva',
      });
      if (insErr) throw insErr;
    },
    onSuccess: () => { invalidateAll(); toast({ title: 'Trasferimento completato' }); setTransferTarget(null); setTransferCameraId(''); },
    onError: (e: any) => toast({ title: 'Errore', description: e.message, variant: 'destructive' }),
  });

  const concludi = useMutation({
    mutationFn: async (v: { assegnazione_id: string; data: string; note: string; motivo: string }) => {
      if (!v.motivo) throw new Error('Seleziona un motivo di chiusura.');
      const { error } = await supabase.from('assegnazioni')
        .update({ stato: 'conclusa', data_fine: v.data, note: v.note || null, motivo_chiusura: v.motivo })
        .eq('id', v.assegnazione_id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast({ title: 'Soggiorno concluso' }); setEndTarget(null); setEndNote(''); setEndMotivo(''); },
    onError: (e: any) => toast({ title: 'Errore', description: e.message, variant: 'destructive' }),
  });

  const filtered = useMemo(() => {
    const list = (rows ?? []).filter(r =>
      filterStadio === 'tutti' ? r.stadio !== 'archiviato' : r.stadio === filterStadio,
    );
    return list
      .filter(r => filterStruttura === 'tutti' || r.struttura_id === filterStruttura)
      .filter(r => {
        if (!search) return true;
        const q = search.toLowerCase();
        return r.nome?.toLowerCase().includes(q) || r.cognome?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        switch (sortKey) {
          case 'nome':
            return dir * `${a.cognome ?? ''} ${a.nome ?? ''}`.localeCompare(`${b.cognome ?? ''} ${b.nome ?? ''}`);
          case 'email':
            return dir * (a.email ?? '').localeCompare(b.email ?? '');
          case 'camera':
            return dir * String(a.camera_numero ?? '').localeCompare(String(b.camera_numero ?? ''), undefined, { numeric: true });
          case 'struttura':
            return dir * (a.struttura_nome ?? '').localeCompare(b.struttura_nome ?? '');
          case 'stadio':
            return dir * a.stadio.localeCompare(b.stadio);
        }
      });
  }, [rows, filterStadio, filterStruttura, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) patchParams({ sd: sortDir === 'asc' ? 'desc' : 'asc' }, { resetPage: true });
    else patchParams({ sk: key, sd: 'asc' }, { resetPage: true });
  };

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => {
    const active = sortKey === k;
    const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <th className="text-left px-4 py-3 font-semibold">
        <button type="button" onClick={() => toggleSort(k)}
          className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? 'text-foreground' : ''}`}>
          {label}
          <Icon className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-40'}`} />
        </button>
      </th>
    );
  };

  const camereDisponibili = (tutteCamere ?? []).filter((c: any) => {
    if (transferTarget && c.id === transferTarget.camera_id) return false;
    const occ = (tutteAssegnazioniAttive ?? []).filter((a: any) => a.camera_id === c.id).length;
    return occ < c.posti;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cerca residente..." value={search}
            onChange={e => patchParams({ q: e.target.value || null }, { resetPage: true })} className="pl-9" />
        </div>
        <Select value={filterStadio} onValueChange={(v) => patchParams({ stadio: v === 'tutti' ? null : v }, { resetPage: true })}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Attivi (assegnati + in casa)</SelectItem>
            <SelectItem value="assegnato">Assegnati (pre-arrivo)</SelectItem>
            <SelectItem value="in_casa">In casa</SelectItem>
            <SelectItem value="archiviato">Archiviati</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStruttura} onValueChange={(v) => patchParams({ sede: v === 'tutti' ? null : v }, { resetPage: true })}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutte le sedi</SelectItem>
            {(strutture ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <ExportButton
          filename="residenti"
          getRows={() => filtered.map(r => ({
            'Cognome': r.cognome ?? '',
            'Nome': r.nome ?? '',
            'Email': r.email ?? '',
            'Stadio': formatStadio(r.stadio),
            'Struttura': r.struttura_nome ?? '',
            'Camera': r.camera_numero ?? '',
            'Posto': r.posto ?? '',
            'Data inizio': fmtDate(r.data_inizio ?? undefined),
            'Data fine': fmtDate(r.data_fine ?? undefined),
          }))}
        />
      </div>

      <div className="bg-card border border-border/50 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/70 text-xs uppercase tracking-wider text-muted-foreground">
              <SortHeader k="nome" label="Nome" />
              <SortHeader k="email" label="Email" />
              <SortHeader k="camera" label="Camera" />
              <SortHeader k="struttura" label="Struttura" />
              <SortHeader k="stadio" label="Stadio" />
              <th className="px-4 py-3 text-right font-semibold">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((r, i) => (
              <motion.tr key={`${r.studente_id}-${r.assegnazione_id ?? ''}`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                className="border-b border-border/30 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => openScheda(r.studente_id)}>
                <td className="px-4 py-3 text-sm font-medium">{r.cognome} {r.nome}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{r.email}</td>
                <td className="px-4 py-3 text-sm">{r.camera_numero || '—'}</td>
                <td className="px-4 py-3 text-sm">{r.struttura_nome || '—'}</td>
                <td className="px-4 py-3"><StadioBadge stadio={r.stadio} /></td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <RowActions>
                    <DropdownMenuItem onClick={() => openScheda(r.studente_id)}>
                      <User className="w-4 h-4 mr-2" /> Visualizza profilo
                    </DropdownMenuItem>
                    {r.assegnazione_id && (r.stadio === 'in_casa' || r.stadio === 'assegnato') && (
                      <DropdownMenuItem onClick={() => {
                        setTransferTarget(r); setTransferCameraId('');
                        setTransferData(new Date().toISOString().split('T')[0]); setTransferFine(r.data_fine ?? '');
                      }}>
                        <ArrowRightLeft className="w-4 h-4 mr-2" /> Trasferisci in altra camera
                      </DropdownMenuItem>
                    )}
                    {r.email && (
                      <DropdownMenuItem asChild>
                        <a href={`mailto:${r.email}`}><Mail className="w-4 h-4 mr-2" /> Contatta via email</a>
                      </DropdownMenuItem>
                    )}
                    {r.assegnazione_id && (r.stadio === 'in_casa' || r.stadio === 'assegnato') && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => { setEndTarget(r); setEndData(new Date().toISOString().split('T')[0]); setEndNote(''); setEndMotivo(''); }}
                        >
                          <LogOut className="w-4 h-4 mr-2" /> Concludi soggiorno
                        </DropdownMenuItem>
                      </>
                    )}
                  </RowActions>
                </td>
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
          <span>{pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} di {filtered.length}</span>
          {totalPages > 1 && (
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setPage(p => Math.max(1, p - 1)); }}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''} />
                </PaginationItem>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <PaginationItem key={i}>
                    <PaginationLink href="#" isActive={currentPage === i + 1}
                      onClick={(e) => { e.preventDefault(); setPage(i + 1); }}>{i + 1}</PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setPage(p => Math.min(totalPages, p + 1)); }}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}

      {/* Transfer dialog */}
      <Dialog open={!!transferTarget} onOpenChange={open => { if (!open) { setTransferTarget(null); setTransferCameraId(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Trasferisci residente</DialogTitle></DialogHeader>
          {transferTarget && (
            <div className="space-y-3">
              <p className="text-sm">
                <strong>{transferTarget.cognome} {transferTarget.nome}</strong>
                <br />
                <span className="text-muted-foreground">
                  Da camera {transferTarget.camera_numero} ({transferTarget.struttura_nome})
                </span>
              </p>
              <div>
                <Label>Nuova camera</Label>
                <Select value={transferCameraId} onValueChange={setTransferCameraId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona camera disponibile" /></SelectTrigger>
                  <SelectContent>
                    {camereDisponibili.map((c: any) => {
                      const occ = (tutteAssegnazioniAttive ?? []).filter((a: any) => a.camera_id === c.id).length;
                      return (
                        <SelectItem key={c.id} value={c.id}>
                          {c.strutture?.nome} – Cam. {c.numero} ({occ}/{c.posti})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Data inizio nuovo soggiorno *</Label>
                  <Input type="date" value={transferData} onChange={e => setTransferData(e.target.value)} />
                </div>
                <div>
                  <Label>Data fine nuovo soggiorno *</Label>
                  <Input type="date" value={transferFine} onChange={e => setTransferFine(e.target.value)} />
                </div>
              </div>
              <p className="text-[12px] text-muted-foreground">La vecchia assegnazione verrà chiusa il giorno precedente con motivo <strong>trasferimento</strong>.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferTarget(null)}>Annulla</Button>
            <Button
              disabled={!transferCameraId || !transferData || !transferFine || transferFine < transferData || transferisci.isPending}
              onClick={() => transferTarget?.assegnazione_id && transferisci.mutate({
                assegnazione_id: transferTarget.assegnazione_id,
                vecchia_camera_id: transferTarget.camera_id!,
                studente_id: transferTarget.studente_id,
                nuova_camera_id: transferCameraId,
                nuova_data_inizio: transferData,
                nuova_data_fine: transferFine,
              })}
            >
              Trasferisci
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End stay */}
      <AlertDialog open={!!endTarget} onOpenChange={open => { if (!open) setEndTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concludere il soggiorno?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-[13px]">
                <p><strong>{endTarget?.cognome} {endTarget?.nome}</strong> – Camera {endTarget?.camera_numero}.</p>
                <p>Lo studente uscirà dall'elenco Residenti; il posto si libera dal giorno successivo alla data di fine.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <div>
              <Label>Data fine *</Label>
              <Input type="date" value={endData} onChange={e => setEndData(e.target.value)} />
            </div>
            <div>
              <Label>Motivo chiusura *</Label>
              <Select value={endMotivo} onValueChange={setEndMotivo}>
                <SelectTrigger><SelectValue placeholder="Seleziona motivo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fine_naturale">Fine naturale</SelectItem>
                  <SelectItem value="partenza_anticipata">Partenza anticipata</SelectItem>
                  <SelectItem value="mai_arrivato">Mai arrivato</SelectItem>
                  <SelectItem value="allontanato">Allontanato</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nota (opzionale)</Label>
              <Textarea rows={2} value={endNote} onChange={e => setEndNote(e.target.value)} />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              disabled={!endData || !endMotivo}
              onClick={() => endTarget?.assegnazione_id && concludi.mutate({
                assegnazione_id: endTarget.assegnazione_id, data: endData, note: endNote, motivo: endMotivo,
              })}
            >
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}