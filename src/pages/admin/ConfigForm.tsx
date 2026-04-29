import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  SlidersHorizontal, Plus, Pencil, Trash2, ArrowUp, ArrowDown, FileText, FileIcon, X,
} from 'lucide-react';

type CampoTipo = 'text' | 'textarea' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect';

type CampoOpzione = { value: string; label_it: string; label_en: string };

type Campo = {
  id: string;
  chiave: string;
  tipo: CampoTipo;
  label_it: string;
  label_en: string;
  descrizione_it: string | null;
  descrizione_en: string | null;
  opzioni: CampoOpzione[] | null;
  obbligatorio: boolean;
  attivo: boolean;
  ordine: number;
};

type Documento = {
  id: string;
  chiave: string;
  label_it: string;
  label_en: string;
  descrizione_it: string | null;
  descrizione_en: string | null;
  obbligatorio: boolean;
  attivo: boolean;
  ordine: number;
};

const TIPO_LABELS: Record<CampoTipo, string> = {
  text: 'Testo breve',
  textarea: 'Testo lungo',
  number: 'Numero',
  date: 'Data',
  boolean: 'Sì / No',
  select: 'Scelta singola',
  multiselect: 'Scelta multipla',
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

const KEY_RE = /^[a-z][a-z0-9_]{0,59}$/;

export default function ConfigForm() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <SlidersHorizontal className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Configurazione form</h1>
            <p className="text-sm text-muted-foreground">
              Aggiungi campi e documenti extra che appariranno nel form di candidatura pubblico.
            </p>
          </div>
        </div>
      </motion.div>

      <Tabs defaultValue="campi" className="w-full">
        <TabsList>
          <TabsTrigger value="campi">Campi extra</TabsTrigger>
          <TabsTrigger value="documenti">Documenti extra</TabsTrigger>
        </TabsList>

        <TabsContent value="campi" className="mt-4">
          <CampiTab />
        </TabsContent>
        <TabsContent value="documenti" className="mt-4">
          <DocumentiTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ========================= CAMPI ========================= */

type CampoForm = {
  chiave: string;
  chiaveAuto: boolean;
  tipo: CampoTipo;
  label_it: string;
  label_en: string;
  descrizione_it: string;
  descrizione_en: string;
  obbligatorio: boolean;
  attivo: boolean;
  opzioni: CampoOpzione[];
};

const EMPTY_CAMPO: CampoForm = {
  chiave: '',
  chiaveAuto: true,
  tipo: 'text',
  label_it: '',
  label_en: '',
  descrizione_it: '',
  descrizione_en: '',
  obbligatorio: false,
  attivo: true,
  opzioni: [],
};

function CampiTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Campo | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CampoForm>(EMPTY_CAMPO);
  const [deleteTarget, setDeleteTarget] = useState<Campo | null>(null);

  const { data: campi = [], isLoading } = useQuery({
    queryKey: ['form-campi-custom-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_campi_custom')
        .select('*')
        .order('ordine')
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as unknown as Campo[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: { id?: string; data: any }) => {
      if (payload.id) {
        const { error } = await supabase.from('form_campi_custom').update(payload.data).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('form_campi_custom').insert(payload.data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-campi-custom-admin'] });
      qc.invalidateQueries({ queryKey: ['form-campi-custom-public'] });
      toast({ title: 'Salvato' });
      closeDialog();
    },
    onError: (e: any) => toast({ title: 'Errore', description: e.message, variant: 'destructive' }),
  });

  const toggleAttivo = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from('form_campi_custom').update({ attivo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-campi-custom-admin'] });
      qc.invalidateQueries({ queryKey: ['form-campi-custom-public'] });
    },
    onError: (e: any) => toast({ title: 'Errore', description: e.message, variant: 'destructive' }),
  });

  const move = useMutation({
    mutationFn: async ({ a, b }: { a: Campo; b: Campo }) => {
      const { error: e1 } = await supabase.from('form_campi_custom').update({ ordine: b.ordine }).eq('id', a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('form_campi_custom').update({ ordine: a.ordine }).eq('id', b.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-campi-custom-admin'] });
      qc.invalidateQueries({ queryKey: ['form-campi-custom-public'] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('form_campi_custom').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-campi-custom-admin'] });
      qc.invalidateQueries({ queryKey: ['form-campi-custom-public'] });
      toast({ title: 'Campo eliminato' });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: 'Errore', description: e.message, variant: 'destructive' }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_CAMPO);
    setCreating(true);
  };
  const openEdit = (c: Campo) => {
    setEditing(c);
    setForm({
      chiave: c.chiave,
      chiaveAuto: false,
      tipo: c.tipo,
      label_it: c.label_it,
      label_en: c.label_en,
      descrizione_it: c.descrizione_it ?? '',
      descrizione_en: c.descrizione_en ?? '',
      obbligatorio: c.obbligatorio,
      attivo: c.attivo,
      opzioni: c.opzioni ?? [],
    });
    setCreating(true);
  };
  const closeDialog = () => {
    setCreating(false);
    setEditing(null);
  };

  const setLabelIt = (v: string) => {
    setForm(f => ({
      ...f,
      label_it: v,
      chiave: f.chiaveAuto && !editing ? slugify(v) : f.chiave,
    }));
  };

  const needsOptions = form.tipo === 'select' || form.tipo === 'multiselect';

  const submit = () => {
    if (!form.label_it.trim() || !form.label_en.trim()) {
      toast({ title: 'Compila label IT ed EN', variant: 'destructive' });
      return;
    }
    if (!KEY_RE.test(form.chiave)) {
      toast({
        title: 'Chiave non valida',
        description: 'Usa solo lettere minuscole, numeri e underscore. Deve iniziare per lettera.',
        variant: 'destructive',
      });
      return;
    }
    if (needsOptions) {
      if (form.opzioni.length < 1) {
        toast({ title: 'Aggiungi almeno un\'opzione', variant: 'destructive' });
        return;
      }
      for (const o of form.opzioni) {
        if (!o.value.trim() || !o.label_it.trim() || !o.label_en.trim()) {
          toast({ title: 'Tutte le opzioni devono avere valore e label', variant: 'destructive' });
          return;
        }
      }
      const values = form.opzioni.map(o => o.value);
      if (new Set(values).size !== values.length) {
        toast({ title: 'I valori delle opzioni devono essere unici', variant: 'destructive' });
        return;
      }
    }

    const data: any = {
      chiave: form.chiave,
      tipo: form.tipo,
      label_it: form.label_it.trim(),
      label_en: form.label_en.trim(),
      descrizione_it: form.descrizione_it.trim() || null,
      descrizione_en: form.descrizione_en.trim() || null,
      opzioni: needsOptions ? form.opzioni : null,
      obbligatorio: form.obbligatorio,
      attivo: form.attivo,
    };
    if (!editing) {
      const maxOrdine = campi.reduce((m, c) => Math.max(m, c.ordine), -1);
      data.ordine = maxOrdine + 1;
    }
    upsert.mutate({ id: editing?.id, data });
  };

  const addOption = () => {
    setForm(f => ({ ...f, opzioni: [...f.opzioni, { value: '', label_it: '', label_en: '' }] }));
  };
  const updateOption = (i: number, patch: Partial<CampoOpzione>) => {
    setForm(f => ({
      ...f,
      opzioni: f.opzioni.map((o, j) => (j === i ? { ...o, ...patch } : o)),
    }));
  };
  const removeOption = (i: number) => {
    setForm(f => ({ ...f, opzioni: f.opzioni.filter((_, j) => j !== i) }));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Campi extra</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Domande aggiuntive che appariranno in coda al form di candidatura.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1.5" /> Aggiungi campo
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : campi.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nessun campo extra configurato.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2 w-20">Ordine</th>
                  <th className="px-3 py-2">Label (IT)</th>
                  <th className="px-3 py-2">Chiave</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2 text-center">Obbligatorio</th>
                  <th className="px-3 py-2 text-center">Attivo</th>
                  <th className="px-3 py-2 text-right w-32">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {campi.map((c, i) => (
                  <tr key={c.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7"
                          disabled={i === 0}
                          onClick={() => move.mutate({ a: c, b: campi[i - 1] })}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7"
                          disabled={i === campi.length - 1}
                          onClick={() => move.mutate({ a: c, b: campi[i + 1] })}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-medium">{c.label_it}</td>
                    <td className="px-3 py-2 text-muted-foreground font-mono text-[12px]">{c.chiave}</td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{TIPO_LABELS[c.tipo]}</Badge>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {c.obbligatorio ? <Badge>Sì</Badge> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Switch
                        checked={c.attivo}
                        onCheckedChange={(v) => toggleAttivo.mutate({ id: c.id, attivo: v })}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(c)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(c)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Dialog crea/modifica */}
      <Dialog open={creating} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifica campo' : 'Nuovo campo'}</DialogTitle>
            <DialogDescription>
              I campi vengono mostrati nello step "Informazioni aggiuntive" del form pubblico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Label (italiano)<span className="text-destructive ml-0.5">*</span></Label>
                <Input value={form.label_it} onChange={e => setLabelIt(e.target.value)} className="mt-1.5" maxLength={120} />
              </div>
              <div>
                <Label>Label (inglese)<span className="text-destructive ml-0.5">*</span></Label>
                <Input value={form.label_en} onChange={e => setForm(f => ({ ...f, label_en: e.target.value }))} className="mt-1.5" maxLength={120} />
              </div>
            </div>
            <div>
              <Label>Chiave<span className="text-destructive ml-0.5">*</span></Label>
              <Input
                value={form.chiave}
                onChange={e => setForm(f => ({ ...f, chiave: e.target.value, chiaveAuto: false }))}
                className="mt-1.5 font-mono"
                disabled={!!editing}
                maxLength={60}
              />
              <p className="text-[12px] text-muted-foreground mt-1">
                Identificatore tecnico (snake_case). {editing ? 'Non modificabile dopo la creazione.' : 'Generato automaticamente dalla label.'}
              </p>
            </div>
            <div>
              <Label>Tipo<span className="text-destructive ml-0.5">*</span></Label>
              <Select value={form.tipo} onValueChange={(v: CampoTipo) => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIPO_LABELS) as CampoTipo[]).map(t => (
                    <SelectItem key={t} value={t}>{TIPO_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Descrizione (italiano)</Label>
                <Textarea
                  value={form.descrizione_it}
                  onChange={e => setForm(f => ({ ...f, descrizione_it: e.target.value }))}
                  className="mt-1.5"
                  maxLength={300}
                  rows={2}
                />
              </div>
              <div>
                <Label>Descrizione (inglese)</Label>
                <Textarea
                  value={form.descrizione_en}
                  onChange={e => setForm(f => ({ ...f, descrizione_en: e.target.value }))}
                  className="mt-1.5"
                  maxLength={300}
                  rows={2}
                />
              </div>
            </div>

            {needsOptions && (
              <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label>Opzioni</Label>
                  <Button size="sm" variant="outline" onClick={addOption}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Aggiungi
                  </Button>
                </div>
                {form.opzioni.length === 0 && (
                  <p className="text-[12px] text-muted-foreground">Nessuna opzione.</p>
                )}
                {form.opzioni.map((o, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                    <Input placeholder="valore" value={o.value} onChange={e => updateOption(i, { value: e.target.value })} className="font-mono text-[12px]" />
                    <Input placeholder="Label IT" value={o.label_it} onChange={e => updateOption(i, { label_it: e.target.value })} />
                    <Input placeholder="Label EN" value={o.label_en} onChange={e => updateOption(i, { label_en: e.target.value })} />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeOption(i)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between border-t pt-3">
              <div className="flex items-center gap-2">
                <Switch checked={form.obbligatorio} onCheckedChange={(v) => setForm(f => ({ ...f, obbligatorio: v }))} />
                <Label className="cursor-pointer">Obbligatorio</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.attivo} onCheckedChange={(v) => setForm(f => ({ ...f, attivo: v }))} />
                <Label className="cursor-pointer">Attivo</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Annulla</Button>
            <Button onClick={submit} disabled={upsert.isPending}>
              {upsert.isPending ? 'Salvataggio…' : 'Salva'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conferma eliminazione */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il campo?</AlertDialogTitle>
            <AlertDialogDescription>
              Il campo "{deleteTarget?.label_it}" verrà rimosso dal form. Le risposte già raccolte nelle candidature
              esistenti restano salvate, ma verranno mostrate con la chiave tecnica al posto della label.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/* ========================= DOCUMENTI ========================= */

type DocForm = {
  chiave: string;
  chiaveAuto: boolean;
  label_it: string;
  label_en: string;
  descrizione_it: string;
  descrizione_en: string;
  obbligatorio: boolean;
  attivo: boolean;
};

const EMPTY_DOC: DocForm = {
  chiave: '',
  chiaveAuto: true,
  label_it: '',
  label_en: '',
  descrizione_it: '',
  descrizione_en: '',
  obbligatorio: false,
  attivo: true,
};

function DocumentiTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Documento | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<DocForm>(EMPTY_DOC);
  const [deleteTarget, setDeleteTarget] = useState<Documento | null>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['form-documenti-custom-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_documenti_custom')
        .select('*')
        .order('ordine')
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as unknown as Documento[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: { id?: string; data: any }) => {
      if (payload.id) {
        const { error } = await supabase.from('form_documenti_custom').update(payload.data).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('form_documenti_custom').insert(payload.data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-documenti-custom-admin'] });
      qc.invalidateQueries({ queryKey: ['form-documenti-custom-public'] });
      toast({ title: 'Salvato' });
      closeDialog();
    },
    onError: (e: any) => toast({ title: 'Errore', description: e.message, variant: 'destructive' }),
  });

  const toggleAttivo = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from('form_documenti_custom').update({ attivo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-documenti-custom-admin'] });
      qc.invalidateQueries({ queryKey: ['form-documenti-custom-public'] });
    },
  });

  const move = useMutation({
    mutationFn: async ({ a, b }: { a: Documento; b: Documento }) => {
      const { error: e1 } = await supabase.from('form_documenti_custom').update({ ordine: b.ordine }).eq('id', a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('form_documenti_custom').update({ ordine: a.ordine }).eq('id', b.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-documenti-custom-admin'] });
      qc.invalidateQueries({ queryKey: ['form-documenti-custom-public'] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('form_documenti_custom').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-documenti-custom-admin'] });
      qc.invalidateQueries({ queryKey: ['form-documenti-custom-public'] });
      toast({ title: 'Documento eliminato' });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: 'Errore', description: e.message, variant: 'destructive' }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_DOC);
    setCreating(true);
  };
  const openEdit = (d: Documento) => {
    setEditing(d);
    setForm({
      chiave: d.chiave,
      chiaveAuto: false,
      label_it: d.label_it,
      label_en: d.label_en,
      descrizione_it: d.descrizione_it ?? '',
      descrizione_en: d.descrizione_en ?? '',
      obbligatorio: d.obbligatorio,
      attivo: d.attivo,
    });
    setCreating(true);
  };
  const closeDialog = () => {
    setCreating(false);
    setEditing(null);
  };
  const setLabelIt = (v: string) => {
    setForm(f => ({
      ...f,
      label_it: v,
      chiave: f.chiaveAuto && !editing ? slugify(v) : f.chiave,
    }));
  };

  const submit = () => {
    if (!form.label_it.trim() || !form.label_en.trim()) {
      toast({ title: 'Compila label IT ed EN', variant: 'destructive' });
      return;
    }
    if (!KEY_RE.test(form.chiave)) {
      toast({
        title: 'Chiave non valida',
        description: 'Usa solo lettere minuscole, numeri e underscore. Deve iniziare per lettera.',
        variant: 'destructive',
      });
      return;
    }
    const data: any = {
      chiave: form.chiave,
      label_it: form.label_it.trim(),
      label_en: form.label_en.trim(),
      descrizione_it: form.descrizione_it.trim() || null,
      descrizione_en: form.descrizione_en.trim() || null,
      obbligatorio: form.obbligatorio,
      attivo: form.attivo,
    };
    if (!editing) {
      const maxOrdine = docs.reduce((m, d) => Math.max(m, d.ordine), -1);
      data.ordine = maxOrdine + 1;
    }
    upsert.mutate({ id: editing?.id, data });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Documenti extra</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Documenti aggiuntivi che gli studenti dovranno (o potranno) caricare.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1.5" /> Aggiungi documento
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : docs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nessun documento extra configurato.</p>
            <p className="text-[12px] mt-1">
              I documenti standard (identità, certificato di iscrizione) restano sempre richiesti.
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2 w-20">Ordine</th>
                  <th className="px-3 py-2">Label (IT)</th>
                  <th className="px-3 py-2">Chiave</th>
                  <th className="px-3 py-2 text-center">Obbligatorio</th>
                  <th className="px-3 py-2 text-center">Attivo</th>
                  <th className="px-3 py-2 text-right w-32">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d, i) => (
                  <tr key={d.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          disabled={i === 0}
                          onClick={() => move.mutate({ a: d, b: docs[i - 1] })}>
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          disabled={i === docs.length - 1}
                          onClick={() => move.mutate({ a: d, b: docs[i + 1] })}>
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-medium">{d.label_it}</td>
                    <td className="px-3 py-2 text-muted-foreground font-mono text-[12px]">{d.chiave}</td>
                    <td className="px-3 py-2 text-center">
                      {d.obbligatorio ? <Badge>Sì</Badge> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Switch
                        checked={d.attivo}
                        onCheckedChange={(v) => toggleAttivo.mutate({ id: d.id, attivo: v })}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(d)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(d)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={creating} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifica documento' : 'Nuovo documento'}</DialogTitle>
            <DialogDescription>
              I documenti vengono caricati in fondo alla sezione "Documenti" del form pubblico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Label (italiano)<span className="text-destructive ml-0.5">*</span></Label>
                <Input value={form.label_it} onChange={e => setLabelIt(e.target.value)} className="mt-1.5" maxLength={120} />
              </div>
              <div>
                <Label>Label (inglese)<span className="text-destructive ml-0.5">*</span></Label>
                <Input value={form.label_en} onChange={e => setForm(f => ({ ...f, label_en: e.target.value }))} className="mt-1.5" maxLength={120} />
              </div>
            </div>
            <div>
              <Label>Chiave<span className="text-destructive ml-0.5">*</span></Label>
              <Input
                value={form.chiave}
                onChange={e => setForm(f => ({ ...f, chiave: e.target.value, chiaveAuto: false }))}
                className="mt-1.5 font-mono"
                disabled={!!editing}
                maxLength={60}
              />
              <p className="text-[12px] text-muted-foreground mt-1">
                Identificatore tecnico (snake_case). {editing ? 'Non modificabile dopo la creazione.' : 'Generato automaticamente dalla label.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Descrizione (italiano)</Label>
                <Textarea value={form.descrizione_it} onChange={e => setForm(f => ({ ...f, descrizione_it: e.target.value }))} className="mt-1.5" maxLength={300} rows={2} />
              </div>
              <div>
                <Label>Descrizione (inglese)</Label>
                <Textarea value={form.descrizione_en} onChange={e => setForm(f => ({ ...f, descrizione_en: e.target.value }))} className="mt-1.5" maxLength={300} rows={2} />
              </div>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <div className="flex items-center gap-2">
                <Switch checked={form.obbligatorio} onCheckedChange={(v) => setForm(f => ({ ...f, obbligatorio: v }))} />
                <Label className="cursor-pointer">Obbligatorio</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.attivo} onCheckedChange={(v) => setForm(f => ({ ...f, attivo: v }))} />
                <Label className="cursor-pointer">Attivo</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Annulla</Button>
            <Button onClick={submit} disabled={upsert.isPending}>
              {upsert.isPending ? 'Salvataggio…' : 'Salva'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Il documento "{deleteTarget?.label_it}" verrà rimosso dal form. I file già caricati nelle candidature
              esistenti restano salvati e accessibili dalla scheda candidatura.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
