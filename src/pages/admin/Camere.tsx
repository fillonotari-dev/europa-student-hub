import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { RowActions } from '@/components/admin/RowActions';
import { useToast } from '@/hooks/use-toast';
import { ExportButton } from '@/components/admin/ExportButton';
import { Select as SelectSede, SelectContent as SelectSedeContent, SelectItem as SelectSedeItem, SelectTrigger as SelectSedeTrigger, SelectValue as SelectSedeValue } from '@/components/ui/select';
import {
  DoorOpen, User, X, ArrowUp, ArrowDown, ArrowUpDown, Plus,
  Pencil, Wrench, RotateCcw, Trash2, Settings,
} from 'lucide-react';

const STATO_ORDER: Record<string, number> = {
  disponibile: 0, manutenzione: 1, non_disponibile: 2,
};
const PAGE_SIZE = 15;
type SortKey = 'numero' | 'struttura' | 'piano' | 'tipo' | 'posti' | 'occupanti' | 'stato';

const STATO_CAMERA_LABELS: Record<string, string> = {
  disponibile: 'Disponibile', manutenzione: 'Manutenzione', non_disponibile: 'Non disponibile',
};

const STATO_BADGE_CLASSES: Record<string, string> = {
  disponibile: 'bg-success/10 text-success border-success/30 hover:bg-success/10',
  manutenzione: 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/10',
  non_disponibile: 'bg-muted text-muted-foreground border-border hover:bg-muted',
};

type CameraForm = {
  id?: string;
  struttura_id: string;
  numero: string;
  piano: string;
  tipo: 'singola' | 'doppia';
  posti: string;
  note: string;
};

const emptyForm: CameraForm = {
  struttura_id: '', numero: '', piano: '', tipo: 'singola', posti: '1', note: '',
};

export default function Camere() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedCamera, setSelectedCamera] = useState<any>(null);
  const [filterStato, setFilterStato] = useState<string>('tutti');
  const [sortKey, setSortKey] = useState<SortKey>('numero');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  // CRUD dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CameraForm>(emptyForm);
  const [maintenanceTarget, setMaintenanceTarget] = useState<any>(null);
  const [maintenanceNote, setMaintenanceNote] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [reactivateTarget, setReactivateTarget] = useState<any>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filtro sede locale della pagina (il filtro globale è stato rimosso).
  const strutturaId = searchParams.get('sede') ?? 'tutti';
  const setStrutturaId = (v: string) =>
    setSearchParams(sp => { const n = new URLSearchParams(sp); if (v === 'tutti') n.delete('sede'); else n.set('sede', v); return n; }, { replace: true });
  const isAll = strutturaId === 'tutti';

  const { data: strutture } = useQuery({
    queryKey: ['strutture-tutte'],
    queryFn: async () => {
      const { data } = await supabase.from('strutture').select('id, nome').order('nome');
      return data ?? [];
    },
  });

  const { data: camere } = useQuery({
    queryKey: ['camere', strutturaId],
    queryFn: async () => {
      let query = supabase.from('camere').select('*, strutture(nome)').order('piano').order('numero');
      if (!isAll) query = query.eq('struttura_id', strutturaId);
      const { data } = await query;
      return data ?? [];
    },
  });

  const { data: assegnazioni } = useQuery({
    queryKey: ['assegnazioni-attive'],
    queryFn: async () => {
      const { data } = await supabase.from('assegnazioni').select('*, studenti(nome, cognome)').eq('stato', 'attiva');
      return data ?? [];
    },
  });

  const saveCamera = useMutation({
    mutationFn: async (f: CameraForm) => {
      const payload = {
        struttura_id: f.struttura_id,
        numero: f.numero.trim(),
        piano: f.piano === '' ? null : Number(f.piano),
        tipo: f.tipo,
        posti: Math.max(1, Number(f.posti) || 1),
        note: f.note.trim() || null,
      };
      if (f.id) {
        // Il trigger camere_check_posti valida server-side rispetto a tutte le
        // assegnazioni attive (in corso e future). Un pre-check client su
        // "oggi" non copre le future e darebbe un falso via libera: lasciamo
        // parlare l'errore del DB (messaggio esplicito, incluso il posto in
        // conflitto).
        const { error } = await supabase.from('camere').update(payload).eq('id', f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('camere').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['camere'] });
      toast({ title: vars.id ? 'Camera aggiornata' : 'Camera creata' });
      setFormOpen(false);
      setForm(emptyForm);
    },
    onError: (e: any) => toast({ title: 'Errore', description: e.message, variant: 'destructive' }),
  });

  const setManutenzione = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { data: existing, error: selErr } = await supabase.from('camere').select('note').eq('id', id).single();
      if (selErr) throw selErr;
      const merged = note
        ? `${existing?.note ? existing.note + '\n' : ''}[Manutenzione ${new Date().toLocaleDateString('it-IT')}] ${note}`
        : existing?.note;
      const { error } = await supabase.from('camere').update({ stato: 'manutenzione', note: merged }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camere'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({ title: 'Camera in manutenzione' });
      setMaintenanceTarget(null);
      setMaintenanceNote('');
    },
    onError: (e: any) => toast({ title: 'Errore', description: e.message, variant: 'destructive' }),
  });

  const reactivate = useMutation({
    mutationFn: async (camera: any) => {
      const { error } = await supabase.from('camere').update({ stato: 'disponibile' }).eq('id', camera.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camere'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({ title: 'Camera riattivata' });
      setReactivateTarget(null);
    },
    onError: (e: any) => toast({ title: 'Errore', description: e.message, variant: 'destructive' }),
  });

  const deleteCamera = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('camere').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camere'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({ title: 'Camera eliminata' });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: 'Errore', description: e.message, variant: 'destructive' }),
  });

  const occCount = (cameraId: string) => assegnazioni?.filter(a => a.camera_id === cameraId).length ?? 0;

  const filteredCamere = useMemo(() => (camere ?? [])
    .filter(c => filterStato === 'tutti' || c.stato === filterStato)
    .sort((a: any, b: any) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'numero':
          return dir * String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true });
        case 'struttura':
          return dir * (a.strutture?.nome ?? '').localeCompare(b.strutture?.nome ?? '');
        case 'piano':
          return dir * ((a.piano ?? 0) - (b.piano ?? 0));
        case 'tipo':
          return dir * String(a.tipo).localeCompare(String(b.tipo));
        case 'posti':
          return dir * ((a.posti ?? 0) - (b.posti ?? 0));
        case 'occupanti':
          return dir * (occCount(a.id) - occCount(b.id));
        case 'stato':
          return dir * ((STATO_ORDER[a.stato] ?? 0) - (STATO_ORDER[b.stato] ?? 0));
      }
    }), [camere, assegnazioni, filterStato, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredCamere.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredCamere.slice(pageStart, pageStart + PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const SortHeader = ({ k, label, align = 'left' }: { k: SortKey; label: string; align?: 'left' | 'right' }) => {
    const active = sortKey === k;
    const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <TableHead className={`text-xs uppercase tracking-wider ${align === 'right' ? 'text-right' : ''}`}>
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? 'text-foreground' : ''}`}
        >
          {label}
          <Icon className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-40'}`} />
        </button>
      </TableHead>
    );
  };

  const openCreate = () => {
    setForm({ ...emptyForm, struttura_id: strutture?.[0]?.id ?? '' });
    setFormOpen(true);
  };

  const openEdit = (c: any) => {
    setForm({
      id: c.id,
      struttura_id: c.struttura_id,
      numero: c.numero ?? '',
      piano: c.piano?.toString() ?? '',
      tipo: (c.tipo as 'singola' | 'doppia') ?? 'singola',
      posti: c.posti?.toString() ?? '1',
      note: c.note ?? '',
    });
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2 flex-wrap">
          <SelectSede value={strutturaId} onValueChange={setStrutturaId}>
            <SelectSedeTrigger className="w-[180px]"><SelectSedeValue /></SelectSedeTrigger>
            <SelectSedeContent>
              <SelectSedeItem value="tutti">Tutte le sedi</SelectSedeItem>
              {(strutture ?? []).map((s: any) => <SelectSedeItem key={s.id} value={s.id}>{s.nome}</SelectSedeItem>)}
            </SelectSedeContent>
          </SelectSede>
          <Select value={filterStato} onValueChange={setFilterStato}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tutti">Tutti gli stati</SelectItem>
              {Object.entries(STATO_CAMERA_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openCreate} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Nuova camera
          </Button>
          <ExportButton
            filename="camere"
            getRows={() => filteredCamere.map((c: any) => ({
              'Struttura': c.strutture?.nome ?? '',
              'Numero': c.numero,
              'Piano': c.piano ?? '',
              'Tipo': c.tipo,
              'Posti': c.posti,
              'Occupanti': occCount(c.id),
              'Stato': STATO_CAMERA_LABELS[c.stato] ?? c.stato,
              'Note': c.note ?? '',
            }))}
          />
        </div>
      </div>

      {/* Rooms table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/70 hover:bg-muted/70">
              <SortHeader k="numero" label="Numero" />
              <SortHeader k="struttura" label="Struttura" />
              <SortHeader k="piano" label="Piano" />
              <SortHeader k="tipo" label="Tipo" />
              <SortHeader k="posti" label="Posti" />
              <SortHeader k="occupanti" label="Occupanti" />
              <SortHeader k="stato" label="Stato" />
              <TableHead className="text-xs uppercase tracking-wider text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                  Nessuna camera trovata
                </TableCell>
              </TableRow>
            )}
            {pageItems.map((c: any, i: number) => {
              const occ = assegnazioni?.filter(a => a.camera_id === c.id) ?? [];
              const stato = c.stato || 'libera';
              const hasActive = occ.length > 0;
              return (
                <motion.tr
                  key={c.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.015, 0.3) }}
                  className="border-b cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setSelectedCamera(c)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <DoorOpen className="w-4 h-4 text-muted-foreground" />
                      {c.numero}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{c.strutture?.nome ?? '—'}</TableCell>
                  <TableCell className="text-sm">{c.piano ?? '—'}</TableCell>
                  <TableCell className="text-sm capitalize">{c.tipo}</TableCell>
                  <TableCell className="text-sm tabular-nums">{occ.length}/{c.posti}</TableCell>
                  <TableCell className="text-sm">
                    {occ.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      occ.map((a: any) => `${a.studenti?.nome ?? ''} ${a.studenti?.cognome ?? ''}`.trim()).join(', ')
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATO_BADGE_CLASSES[stato]}>
                      {STATO_CAMERA_LABELS[stato]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions>
                      <DropdownMenuItem onClick={() => setSelectedCamera(c)}>
                        <Settings className="w-4 h-4 mr-2" /> Gestisci occupanti
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEdit(c)}>
                        <Pencil className="w-4 h-4 mr-2" /> Modifica camera
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {stato !== 'manutenzione' ? (
                        <DropdownMenuItem onClick={() => setMaintenanceTarget(c)}>
                          <Wrench className="w-4 h-4 mr-2" /> Imposta in manutenzione
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => setReactivateTarget(c)}>
                          <RotateCcw className="w-4 h-4 mr-2" /> Riattiva
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        disabled={hasActive}
                        onClick={() => !hasActive && setDeleteTarget(c)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {hasActive ? 'Elimina (occupata)' : 'Elimina camera'}
                      </DropdownMenuItem>
                    </RowActions>
                  </TableCell>
                </motion.tr>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {filteredCamere.length > 0 && (
        <div className="flex items-center justify-between text-[13px] text-muted-foreground">
          <span>
            {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredCamere.length)} di {filteredCamere.length}
          </span>
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

      {/* Manage occupants dialog */}
      <Dialog open={!!selectedCamera} onOpenChange={open => !open && setSelectedCamera(null)}>
        <DialogContent>
          {selectedCamera && (
            <>
              <DialogHeader>
                <DialogTitle>Camera {selectedCamera.numero}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="text-[13px] space-y-1">
                  <p>Tipo: <strong className="capitalize">{selectedCamera.tipo}</strong></p>
                  <p>Posti: <strong>{selectedCamera.posti}</strong></p>
                  <p>Stato: <strong>{STATO_CAMERA_LABELS[selectedCamera.stato]}</strong></p>
                </div>

                {(() => {
                  const occupanti = assegnazioni?.filter(a => a.camera_id === selectedCamera.id) ?? [];
                  if (occupanti.length === 0) return null;
                  return (
                    <div>
                      <p className="text-sm font-semibold mb-2">Occupanti attivi</p>
                      <div className="space-y-2">
                        {occupanti.map((a: any) => (
                          <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 text-sm">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span>{a.studenti?.nome} {a.studenti?.cognome}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[12px] text-muted-foreground mt-2">Per concludere o trasferire un'assegnazione usa la pagina <strong>Residenti</strong>.</p>
                    </div>
                  );
                })()}

                <p className="text-[12px] text-muted-foreground">
                  Le assegnazioni si creano dalla scheda persona, tramite il gesto "Assegna posto".
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / edit camera dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? 'Modifica camera' : 'Nuova camera'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="col-span-2">
              <Label>Struttura</Label>
              <Select value={form.struttura_id} onValueChange={(v) => setForm(f => ({ ...f, struttura_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleziona struttura" /></SelectTrigger>
                <SelectContent>
                  {strutture?.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Numero</Label>
              <Input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} />
            </div>
            <div>
              <Label>Piano</Label>
              <Input type="number" value={form.piano} onChange={e => setForm(f => ({ ...f, piano: e.target.value }))} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v: 'singola' | 'doppia') => setForm(f => ({
                ...f, tipo: v, posti: v === 'singola' ? '1' : '2',
              }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="singola">Singola</SelectItem>
                  <SelectItem value="doppia">Doppia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Posti</Label>
              <Input type="number" min={1} value={form.posti} onChange={e => setForm(f => ({ ...f, posti: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>Note</Label>
              <Textarea rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Annulla</Button>
            <Button
              onClick={() => saveCamera.mutate(form)}
              disabled={!form.struttura_id || !form.numero.trim() || saveCamera.isPending}
            >
              {form.id ? 'Salva' : 'Crea'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maintenance dialog */}
      <AlertDialog open={!!maintenanceTarget} onOpenChange={open => { if (!open) { setMaintenanceTarget(null); setMaintenanceNote(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Imposta in manutenzione</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-[13px]">
                <p>La camera {maintenanceTarget?.numero} non sarà disponibile per nuove assegnazioni.</p>
                {maintenanceTarget && occCount(maintenanceTarget.id) > 0 && (
                  <p className="rounded-md bg-warning/10 text-warning border border-warning/30 p-2">
                    Attenzione: ci sono <strong>{occCount(maintenanceTarget.id)} residenti attivi</strong> in questa stanza.
                    Resteranno formalmente in camera ma essa risulterà non assegnabile. Per liberarli, gestisci le assegnazioni dalla pagina Residenti.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label>Nota (opzionale)</Label>
            <Textarea rows={2} value={maintenanceNote} onChange={e => setMaintenanceNote(e.target.value)} placeholder="Es. perdita rubinetto bagno" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => maintenanceTarget && setManutenzione.mutate({ id: maintenanceTarget.id, note: maintenanceNote })}>
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reactivate */}
      <AlertDialog open={!!reactivateTarget} onOpenChange={open => { if (!open) setReactivateTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Riattivare la camera?</AlertDialogTitle>
            <AlertDialogDescription>
              Lo stato verrà ricalcolato in base agli occupanti attuali.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => reactivateTarget && reactivate.mutate(reactivateTarget)}>
              Riattiva
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la camera {deleteTarget?.numero}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-[13px]">
                <p>Operazione irreversibile.</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>La camera scompare da elenco, filtri e statistiche.</li>
                  <li>Lo <strong>storico assegnazioni concluse</strong> resta nel database ma perderà il riferimento (camera mostrata come "—" nello storico).</li>
                </ul>
                <p className="text-muted-foreground">Per disabilitarla temporaneamente conviene usare "Imposta in manutenzione".</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteCamera.mutate(deleteTarget.id)}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
