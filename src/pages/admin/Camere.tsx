import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { DoorOpen, User, X } from 'lucide-react';

const STATO_CAMERA_LABELS: Record<string, string> = {
  libera: 'Libera', parzialmente_occupata: 'Parz. occupata', occupata: 'Occupata', manutenzione: 'Manutenzione',
};

const STATO_BADGE_CLASSES: Record<string, string> = {
  libera: 'bg-success/10 text-success border-success/30 hover:bg-success/10',
  parzialmente_occupata: 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/10',
  occupata: 'bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/10',
  manutenzione: 'bg-muted text-muted-foreground border-border hover:bg-muted',
};

export default function Camere() {
  const [selectedCamera, setSelectedCamera] = useState<any>(null);
  const [selectedStruttura, setSelectedStruttura] = useState<string>('tutti');
  const [filterStato, setFilterStato] = useState<string>('tutti');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: strutture } = useQuery({
    queryKey: ['strutture'],
    queryFn: async () => {
      const { data } = await supabase.from('strutture').select('*');
      return data ?? [];
    },
  });

  const { data: camere } = useQuery({
    queryKey: ['camere', selectedStruttura],
    queryFn: async () => {
      let query = supabase.from('camere').select('*, strutture(nome)').order('piano').order('numero');
      if (selectedStruttura !== 'tutti') query = query.eq('struttura_id', selectedStruttura);
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

  const { data: studentiApprovati } = useQuery({
    queryKey: ['studenti-approvati'],
    queryFn: async () => {
      const { data } = await supabase
        .from('candidature')
        .select('id, studente_id, studenti(id, nome, cognome)')
        .eq('stato', 'approvata');
      return data ?? [];
    },
  });

  const assegna = useMutation({
    mutationFn: async ({ camera_id, studente_id, candidatura_id, posto }: any) => {
      await supabase.from('assegnazioni').insert({
        camera_id, studente_id, candidatura_id, posto, data_inizio: new Date().toISOString().split('T')[0], stato: 'attiva',
      });
      // Update camera stato
      const cameraAssegnazioni = (assegnazioni?.filter(a => a.camera_id === camera_id).length ?? 0) + 1;
      const camera = camere?.find(c => c.id === camera_id);
      const nuovoStato = camera && cameraAssegnazioni >= camera.posti ? 'occupata' : 'parzialmente_occupata';
      await supabase.from('camere').update({ stato: nuovoStato }).eq('id', camera_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camere'] });
      queryClient.invalidateQueries({ queryKey: ['assegnazioni-attive'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({ title: 'Studente assegnato' });
      setSelectedCamera(null);
    },
  });

  const concludi = useMutation({
    mutationFn: async ({ assegnazione_id, camera_id }: { assegnazione_id: string; camera_id: string }) => {
      await supabase
        .from('assegnazioni')
        .update({ stato: 'conclusa', data_fine: new Date().toISOString().split('T')[0] })
        .eq('id', assegnazione_id);
      const rimaste = (assegnazioni?.filter(a => a.camera_id === camera_id && a.id !== assegnazione_id).length ?? 0);
      const camera = camere?.find(c => c.id === camera_id);
      const nuovoStato = rimaste === 0 ? 'libera' : (camera && rimaste < camera.posti ? 'parzialmente_occupata' : 'occupata');
      await supabase.from('camere').update({ stato: nuovoStato }).eq('id', camera_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camere'] });
      queryClient.invalidateQueries({ queryKey: ['assegnazioni-attive'] });
      queryClient.invalidateQueries({ queryKey: ['residenti'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({ title: 'Assegnazione conclusa' });
    },
  });

  const filteredCamere = (camere ?? [])
    .filter(c => filterStato === 'tutti' || (c.stato || 'libera') === filterStato)
    .sort((a: any, b: any) => {
      const sa = a.strutture?.nome ?? '';
      const sb = b.strutture?.nome ?? '';
      if (sa !== sb) return sa.localeCompare(sb);
      if ((a.piano ?? 0) !== (b.piano ?? 0)) return (a.piano ?? 0) - (b.piano ?? 0);
      return String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true });
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Camere e Occupazione</h1>
          <p className="text-[13px] text-muted-foreground">Elenco camere per struttura, piano e stato</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedStruttura} onValueChange={setSelectedStruttura}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tutti">Tutte le strutture</SelectItem>
              {strutture?.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStato} onValueChange={setFilterStato}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tutti">Tutti gli stati</SelectItem>
              {Object.entries(STATO_CAMERA_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Rooms table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/70 hover:bg-muted/70">
              <TableHead className="text-xs uppercase tracking-wider">Numero</TableHead>
              <TableHead className="text-xs uppercase tracking-wider">Struttura</TableHead>
              <TableHead className="text-xs uppercase tracking-wider">Piano</TableHead>
              <TableHead className="text-xs uppercase tracking-wider">Tipo</TableHead>
              <TableHead className="text-xs uppercase tracking-wider">Posti</TableHead>
              <TableHead className="text-xs uppercase tracking-wider">Occupanti</TableHead>
              <TableHead className="text-xs uppercase tracking-wider">Stato</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCamere.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                  Nessuna camera trovata
                </TableCell>
              </TableRow>
            )}
            {filteredCamere.map((c: any, i: number) => {
              const occ = assegnazioni?.filter(a => a.camera_id === c.id) ?? [];
              const stato = c.stato || 'libera';
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
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSelectedCamera(c); }}>
                      Gestisci
                    </Button>
                  </TableCell>
                </motion.tr>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Assign dialog */}
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
                          <div key={a.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                            <div className="flex items-center gap-2 text-sm">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span>{a.studenti?.nome} {a.studenti?.cognome}</span>
                            </div>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                                  <X className="w-3.5 h-3.5 mr-1" />Concludi
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Concludere l'assegnazione?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    L'assegnazione di {a.studenti?.nome} {a.studenti?.cognome} alla camera {selectedCamera.numero} verrà conclusa con data odierna. Lo stato della camera verrà aggiornato automaticamente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => concludi.mutate({ assegnazione_id: a.id, camera_id: selectedCamera.id })}>
                                    Conferma
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {selectedCamera.stato !== 'occupata' && selectedCamera.stato !== 'manutenzione' && studentiApprovati && studentiApprovati.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Assegna studente approvato</p>
                    <div className="space-y-2">
                      {studentiApprovati.map((sa: any) => {
                        const alreadyAssigned = assegnazioni?.some(a => a.studente_id === sa.studente_id && a.stato === 'attiva');
                        if (alreadyAssigned) return null;
                        return (
                          <div key={sa.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                            <span className="text-sm">{sa.studenti?.nome} {sa.studenti?.cognome}</span>
                            <Button size="sm" onClick={() => {
                              const currentAssignments = assegnazioni?.filter(a => a.camera_id === selectedCamera.id).length ?? 0;
                              assegna.mutate({
                                camera_id: selectedCamera.id,
                                studente_id: sa.studente_id,
                                candidatura_id: sa.id,
                                posto: currentAssignments + 1,
                              });
                            }}>Assegna</Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
