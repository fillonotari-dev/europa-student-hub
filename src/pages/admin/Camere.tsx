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
import { useToast } from '@/hooks/use-toast';
import { DoorOpen, User, X } from 'lucide-react';

const STATO_CAMERA_COLORS: Record<string, string> = {
  libera: 'bg-success/10 border-success/30 text-success',
  parzialmente_occupata: 'bg-warning/10 border-warning/30 text-warning',
  occupata: 'bg-destructive/10 border-destructive/30 text-destructive',
  manutenzione: 'bg-muted border-border text-muted-foreground',
};

const STATO_CAMERA_LABELS: Record<string, string> = {
  libera: 'Libera', parzialmente_occupata: 'Parz. occupata', occupata: 'Occupata', manutenzione: 'Manutenzione',
};

export default function Camere() {
  const [selectedCamera, setSelectedCamera] = useState<any>(null);
  const [selectedStruttura, setSelectedStruttura] = useState<string>('tutti');
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

  const piani = [...new Set(camere?.map(c => c.piano))].sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Camere e Occupazione</h1>
          <p className="text-[13px] text-muted-foreground">Mappa delle camere per struttura e piano</p>
        </div>
        <Select value={selectedStruttura} onValueChange={setSelectedStruttura}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutte le strutture</SelectItem>
            {strutture?.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap">
        {Object.entries(STATO_CAMERA_LABELS).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5 text-[11px]">
            <div className={`w-3 h-3 rounded ${STATO_CAMERA_COLORS[k]}`} />
            <span className="text-muted-foreground">{v}</span>
          </div>
        ))}
      </div>

      {/* Rooms by floor */}
      {piani.map(piano => (
        <div key={piano}>
          <h2 className="text-sm font-semibold mb-3">Piano {piano}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {camere?.filter(c => c.piano === piano).map((c, i) => {
              const cameraAssegnazioni = assegnazioni?.filter(a => a.camera_id === c.id) ?? [];
              return (
                <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className={`border rounded-lg p-3 cursor-pointer transition-shadow hover:shadow-md ${STATO_CAMERA_COLORS[c.stato || 'libera']}`}
                  onClick={() => setSelectedCamera(c)}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold">{c.numero}</span>
                    <DoorOpen className="w-4 h-4" />
                  </div>
                  <p className="text-[11px] capitalize">{c.tipo} · {c.posti} posti</p>
                  {cameraAssegnazioni.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {cameraAssegnazioni.map((a: any) => (
                        <div key={a.id} className="flex items-center gap-1 text-[11px]">
                          <User className="w-3 h-3" />
                          <span>{a.studenti?.nome} {a.studenti?.cognome}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}

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
