import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Home, MapPin, Layers, DoorOpen, Users, Pencil, AlertTriangle } from 'lucide-react';

type Struttura = {
  id: string;
  nome: string;
  indirizzo: string | null;
  piani: number | null;
  attiva: boolean;
};

type Metrics = {
  camere: number;
  posti: number;
  occupati: number;
  singole: number;
  doppie: number;
  candidaturePendenti: number;
};

type FormState = {
  nome: string;
  indirizzo: string;
  piani: string;
  attiva: boolean;
};

export default function Strutture() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [editing, setEditing] = useState<Struttura | null>(null);
  const [form, setForm] = useState<FormState>({ nome: '', indirizzo: '', piani: '1', attiva: true });
  const [confirmDeactivate, setConfirmDeactivate] = useState<Struttura | null>(null);

  const { data: strutture = [], isLoading } = useQuery({
    queryKey: ['strutture-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('strutture')
        .select('id, nome, indirizzo, piani, attiva')
        .order('nome');
      if (error) throw error;
      return (data ?? []) as Struttura[];
    },
  });

  const { data: metricsByStruttura = {} } = useQuery({
    queryKey: ['strutture-metrics'],
    queryFn: async () => {
      const [{ data: camere }, { data: assegnazioni }, { data: candidature }] = await Promise.all([
        supabase.from('camere').select('struttura_id, tipo, posti'),
        supabase.from('assegnazioni').select('camera_id, stato'),
        supabase.from('candidature').select('struttura_preferita_id, stato'),
      ]);

      const camereById = new Map<string, { struttura_id: string; tipo: string; posti: number }>();
      const map: Record<string, Metrics> = {};
      const ensure = (id: string) => {
        if (!map[id]) map[id] = { camere: 0, posti: 0, occupati: 0, singole: 0, doppie: 0, candidaturePendenti: 0 };
        return map[id];
      };

      (camere ?? []).forEach((c: any) => {
        camereById.set(c.id ?? '', c);
        const m = ensure(c.struttura_id);
        m.camere += 1;
        m.posti += c.posti ?? 0;
        if (c.tipo === 'singola') m.singole += 1;
        if (c.tipo === 'doppia') m.doppie += 1;
      });

      // Count active assignments per struttura via camera lookup
      const { data: camereFull } = await supabase.from('camere').select('id, struttura_id');
      const cameraStruttura = new Map<string, string>();
      (camereFull ?? []).forEach((c: any) => cameraStruttura.set(c.id, c.struttura_id));
      (assegnazioni ?? []).forEach((a: any) => {
        if (a.stato !== 'attiva') return;
        const sid = cameraStruttura.get(a.camera_id);
        if (!sid) return;
        ensure(sid).occupati += 1;
      });

      (candidature ?? []).forEach((c: any) => {
        if (!c.struttura_preferita_id) return;
        if (c.stato !== 'ricevuta' && c.stato !== 'in_revisione') return;
        ensure(c.struttura_preferita_id).candidaturePendenti += 1;
      });

      return map;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; nome: string; indirizzo: string | null; piani: number | null; attiva: boolean }) => {
      const { error } = await supabase
        .from('strutture')
        .update({
          nome: payload.nome,
          indirizzo: payload.indirizzo,
          piani: payload.piani,
          attiva: payload.attiva,
        })
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Struttura aggiornata' });
      qc.invalidateQueries({ queryKey: ['strutture-list'] });
      qc.invalidateQueries({ queryKey: ['strutture-filter'] });
      qc.invalidateQueries({ queryKey: ['strutture-metrics'] });
      setEditing(null);
      setConfirmDeactivate(null);
    },
    onError: (e: any) => {
      toast({ title: 'Errore', description: e?.message ?? 'Impossibile salvare', variant: 'destructive' });
    },
  });

  const openEdit = (s: Struttura) => {
    setEditing(s);
    setForm({
      nome: s.nome,
      indirizzo: s.indirizzo ?? '',
      piani: String(s.piani ?? 1),
      attiva: s.attiva,
    });
  };

  const handleSave = () => {
    if (!editing) return;
    if (!form.nome.trim()) {
      toast({ title: 'Nome obbligatorio', variant: 'destructive' });
      return;
    }
    const piani = Math.max(1, parseInt(form.piani, 10) || 1);
    const m = metricsByStruttura[editing.id];
    const isDeactivating = editing.attiva && !form.attiva;
    const hasActivity = m && (m.occupati > 0 || m.candidaturePendenti > 0);

    if (isDeactivating && hasActivity) {
      setConfirmDeactivate(editing);
      return;
    }

    updateMutation.mutate({
      id: editing.id,
      nome: form.nome.trim(),
      indirizzo: form.indirizzo.trim() || null,
      piani,
      attiva: form.attiva,
    });
  };

  const confirmAndSave = () => {
    if (!editing) return;
    const piani = Math.max(1, parseInt(form.piani, 10) || 1);
    updateMutation.mutate({
      id: editing.id,
      nome: form.nome.trim(),
      indirizzo: form.indirizzo.trim() || null,
      piani,
      attiva: form.attiva,
    });
  };

  const sorted = useMemo(
    () => [...strutture].sort((a, b) => Number(b.attiva) - Number(a.attiva) || a.nome.localeCompare(b.nome)),
    [strutture]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Strutture</h1>
          <p className="text-muted-foreground mt-1">Gestisci le strutture ricettive e le loro informazioni</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Caricamento...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sorted.map((s, idx) => {
            const m = metricsByStruttura[s.id] ?? { camere: 0, posti: 0, occupati: 0, singole: 0, doppie: 0, candidaturePendenti: 0 };
            const occupazione = m.posti > 0 ? Math.round((m.occupati / m.posti) * 100) : 0;
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.05 }}
              >
                <Card className="hover:bg-muted/30 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Home className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-xl">{s.nome}</CardTitle>
                          <Badge
                            variant="outline"
                            className={
                              s.attiva
                                ? 'mt-1 bg-success/10 text-success border-success/30'
                                : 'mt-1 bg-muted text-muted-foreground border-border'
                            }
                          >
                            {s.attiva ? 'Attiva' : 'Disattivata'}
                          </Badge>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => openEdit(s)}>
                        <Pencil className="w-4 h-4 mr-1" />
                        Modifica
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span>{s.indirizzo || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Layers className="w-4 h-4 shrink-0" />
                        <span>{s.piani ?? 0} {s.piani === 1 ? 'piano' : 'piani'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-2 border-t">
                      <div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <DoorOpen className="w-3 h-3" /> Camere
                        </div>
                        <p className="text-lg font-semibold mt-0.5">{m.camere}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {m.singole} sing. · {m.doppie} dopp.
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="w-3 h-3" /> Posti
                        </div>
                        <p className="text-lg font-semibold mt-0.5">
                          {m.occupati}<span className="text-sm text-muted-foreground">/{m.posti}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">{occupazione}% occupati</p>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">In attesa</div>
                        <p className="text-lg font-semibold mt-0.5">{m.candidaturePendenti}</p>
                        <p className="text-[11px] text-muted-foreground">candidature</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica struttura</DialogTitle>
            <DialogDescription>Aggiorna le informazioni anagrafiche della struttura.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome *</Label>
              <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                Modificare il nome cambia anche come appare nel form pubblico di candidatura.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="indirizzo">Indirizzo</Label>
              <Input
                id="indirizzo"
                value={form.indirizzo}
                onChange={(e) => setForm({ ...form, indirizzo: e.target.value })}
                placeholder="Es. Via Turri 69, Reggio Emilia"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="piani">Numero piani</Label>
              <Input
                id="piani"
                type="number"
                min={1}
                value={form.piani}
                onChange={(e) => setForm({ ...form, piani: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="attiva" className="text-sm font-medium">Struttura attiva</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Se disattivata, sparisce dai filtri e dal form pubblico.
                </p>
              </div>
              <Switch
                id="attiva"
                checked={form.attiva}
                onCheckedChange={(v) => setForm({ ...form, attiva: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annulla</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Salvataggio...' : 'Salva'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm deactivate when there is activity */}
      <AlertDialog open={!!confirmDeactivate} onOpenChange={(o) => !o && setConfirmDeactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disattivare la struttura?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa struttura ha posti occupati o candidature pendenti. Disattivandola, sparirà dal form pubblico e dai filtri,
              ma i dati storici resteranno consultabili. Vuoi procedere?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAndSave}>Disattiva</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}