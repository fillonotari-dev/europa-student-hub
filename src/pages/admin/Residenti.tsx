import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import {
  Search, Users as UsersIcon, ArrowUp, ArrowDown, ArrowUpDown,
  User, ArrowRightLeft, LogOut, Mail,
} from 'lucide-react';

const PAGE_SIZE = 15;
type SortKey = 'nome' | 'email' | 'nazionalita' | 'camera' | 'struttura';

export default function Residenti() {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('nome');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const [profileTarget, setProfileTarget] = useState<any>(null);
  const [transferTarget, setTransferTarget] = useState<any>(null);
  const [transferCameraId, setTransferCameraId] = useState<string>('');
  const [transferData, setTransferData] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endTarget, setEndTarget] = useState<any>(null);
  const [endData, setEndData] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endNote, setEndNote] = useState('');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: residenti } = useQuery({
    queryKey: ['residenti'],
    queryFn: async () => {
      const { data } = await supabase
        .from('assegnazioni')
        .select('id, posto, data_inizio, camera_id, studente_id, studenti(id, nome, cognome, email, nazionalita, telefono, universita, corso_di_studi, anno_di_corso, matricola), camere(id, numero, posti, struttura_id, strutture(nome))')
        .eq('stato', 'attiva');
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

  const { data: storico } = useQuery({
    queryKey: ['storico-studente', profileTarget?.studenti?.id],
    enabled: !!profileTarget?.studenti?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('assegnazioni')
        .select('id, data_inizio, data_fine, stato, posto, camere(numero, strutture(nome))')
        .eq('studente_id', profileTarget.studenti.id)
        .order('data_inizio', { ascending: false });
      return data ?? [];
    },
  });

  const recalcCameraStato = async (cameraId: string) => {
    const { data: rim } = await supabase.from('assegnazioni').select('id', { count: 'exact' }).eq('camera_id', cameraId).eq('stato', 'attiva');
    const { data: cam } = await supabase.from('camere').select('posti, stato').eq('id', cameraId).single();
    if (!cam) return;
    if (cam.stato === 'manutenzione') return;
    const occ = rim?.length ?? 0;
    const nuovo = occ === 0 ? 'libera' : occ >= cam.posti ? 'occupata' : 'parzialmente_occupata';
    await supabase.from('camere').update({ stato: nuovo }).eq('id', cameraId);
  };

  const transferisci = useMutation({
    mutationFn: async ({ assegnazione_id, vecchia_camera_id, studente_id, nuova_camera_id, data }: any) => {
      // Conclude old
      await supabase.from('assegnazioni').update({ stato: 'conclusa', data_fine: data }).eq('id', assegnazione_id);
      // Compute next posto in new camera
      const { data: existing } = await supabase.from('assegnazioni').select('posto').eq('camera_id', nuova_camera_id).eq('stato', 'attiva');
      const nextPosto = (existing?.length ?? 0) + 1;
      // Create new assignment (candidatura_id required NOT NULL → reuse last from this student)
      const { data: lastCand } = await supabase
        .from('candidature').select('id').eq('studente_id', studente_id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!lastCand) throw new Error('Nessuna candidatura trovata per lo studente.');
      await supabase.from('assegnazioni').insert({
        camera_id: nuova_camera_id, studente_id, candidatura_id: lastCand.id,
        posto: nextPosto, data_inizio: data, stato: 'attiva',
      });
      await recalcCameraStato(vecchia_camera_id);
      await recalcCameraStato(nuova_camera_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['residenti'] });
      queryClient.invalidateQueries({ queryKey: ['camere'] });
      queryClient.invalidateQueries({ queryKey: ['assegnazioni-attive'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({ title: 'Trasferimento completato' });
      setTransferTarget(null);
      setTransferCameraId('');
    },
    onError: (e: any) => toast({ title: 'Errore', description: e.message, variant: 'destructive' }),
  });

  const concludi = useMutation({
    mutationFn: async ({ assegnazione_id, camera_id, data, note }: any) => {
      await supabase.from('assegnazioni')
        .update({ stato: 'conclusa', data_fine: data, note: note || null })
        .eq('id', assegnazione_id);
      await recalcCameraStato(camera_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['residenti'] });
      queryClient.invalidateQueries({ queryKey: ['camere'] });
      queryClient.invalidateQueries({ queryKey: ['assegnazioni-attive'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({ title: 'Soggiorno concluso' });
      setEndTarget(null);
      setEndNote('');
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
        <button type="button" onClick={() => toggleSort(k)}
          className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? 'text-foreground' : ''}`}>
          {label}
          <Icon className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-40'}`} />
        </button>
      </th>
    );
  };

  // Camere disponibili per il trasferimento (escludi la camera corrente, escludi piene)
  const camereDisponibili = (tutteCamere ?? []).filter((c: any) => {
    if (transferTarget && c.id === transferTarget.camera_id) return false;
    const occ = (tutteAssegnazioniAttive ?? []).filter((a: any) => a.camera_id === c.id).length;
    return occ < c.posti;
  });

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
              <th className="px-4 py-3 text-right font-semibold">Azioni</th>
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
                <td className="px-4 py-3 text-right">
                  <RowActions>
                    <DropdownMenuItem onClick={() => setProfileTarget(a)}>
                      <User className="w-4 h-4 mr-2" /> Visualizza profilo
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setTransferTarget(a); setTransferCameraId(''); setTransferData(new Date().toISOString().split('T')[0]); }}>
                      <ArrowRightLeft className="w-4 h-4 mr-2" /> Trasferisci in altra camera
                    </DropdownMenuItem>
                    {a.studenti?.email && (
                      <DropdownMenuItem asChild>
                        <a href={`mailto:${a.studenti.email}`}><Mail className="w-4 h-4 mr-2" /> Contatta via email</a>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => { setEndTarget(a); setEndData(new Date().toISOString().split('T')[0]); setEndNote(''); }}
                    >
                      <LogOut className="w-4 h-4 mr-2" /> Concludi soggiorno
                    </DropdownMenuItem>
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

      {/* Profile dialog */}
      <Dialog open={!!profileTarget} onOpenChange={open => !open && setProfileTarget(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {profileTarget && (
            <>
              <DialogHeader>
                <DialogTitle>{profileTarget.studenti?.cognome} {profileTarget.studenti?.nome}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="bg-muted/30 rounded-lg p-3 space-y-1.5 text-[13px]">
                  <Row label="Email" value={profileTarget.studenti?.email} />
                  <Row label="Telefono" value={profileTarget.studenti?.telefono} />
                  <Row label="Nazionalità" value={profileTarget.studenti?.nazionalita} />
                  <Row label="Università" value={profileTarget.studenti?.universita} />
                  <Row label="Corso" value={profileTarget.studenti?.corso_di_studi} />
                  <Row label="Anno" value={profileTarget.studenti?.anno_di_corso} />
                  <Row label="Matricola" value={profileTarget.studenti?.matricola} />
                </div>
                <div>
                  <p className="text-sm font-semibold mb-2">Storico assegnazioni</p>
                  <div className="space-y-1.5">
                    {(storico ?? []).map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between text-[13px] p-2 rounded bg-muted/30">
                        <span>
                          Cam. {s.camere?.numero} ({s.camere?.strutture?.nome})
                        </span>
                        <span className="text-muted-foreground">
                          {s.data_inizio} → {s.data_fine ?? 'in corso'} · {s.stato}
                        </span>
                      </div>
                    ))}
                    {(storico?.length ?? 0) === 0 && <p className="text-[13px] text-muted-foreground">Nessun dato</p>}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer dialog */}
      <Dialog open={!!transferTarget} onOpenChange={open => { if (!open) { setTransferTarget(null); setTransferCameraId(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trasferisci residente</DialogTitle>
          </DialogHeader>
          {transferTarget && (
            <div className="space-y-3">
              <p className="text-sm">
                <strong>{transferTarget.studenti?.cognome} {transferTarget.studenti?.nome}</strong>
                <br />
                <span className="text-muted-foreground">
                  Da camera {transferTarget.camere?.numero} ({transferTarget.camere?.strutture?.nome})
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
              <div>
                <Label>Data trasferimento</Label>
                <Input type="date" value={transferData} onChange={e => setTransferData(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferTarget(null)}>Annulla</Button>
            <Button
              disabled={!transferCameraId || transferisci.isPending}
              onClick={() => transferisci.mutate({
                assegnazione_id: transferTarget.id,
                vecchia_camera_id: transferTarget.camera_id,
                studente_id: transferTarget.studente_id,
                nuova_camera_id: transferCameraId,
                data: transferData,
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
            <AlertDialogDescription>
              {endTarget?.studenti?.cognome} {endTarget?.studenti?.nome} – Camera {endTarget?.camere?.numero}.
              L'assegnazione verrà chiusa e lo stato camera ricalcolato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <div>
              <Label>Data fine</Label>
              <Input type="date" value={endData} onChange={e => setEndData(e.target.value)} />
            </div>
            <div>
              <Label>Nota (opzionale)</Label>
              <Textarea rows={2} value={endNote} onChange={e => setEndNote(e.target.value)} />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => endTarget && concludi.mutate({
                assegnazione_id: endTarget.id, camera_id: endTarget.camera_id, data: endData, note: endNote,
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

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || '-'}</span>
    </div>
  );
}
