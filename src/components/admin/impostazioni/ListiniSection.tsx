import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

const oggi = () => new Date().toISOString().slice(0, 10);
const fmtData = (d?: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('it-IT') : '—');
const fmtEuro = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const giornoPrima = (iso: string) =>
  new Date(new Date(`${iso}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);

const inVigore = (r: any) => r.valido_dal <= oggi() && (!r.valido_al || r.valido_al >= oggi());

export function ListiniSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [strutturaId, setStrutturaId] = useState('');
  const [tipoCamera, setTipoCamera] = useState('');
  const [importo, setImporto] = useState('');
  const [validoDal, setValidoDal] = useState('');
  const [conferma, setConferma] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: strutture } = useQuery({
    queryKey: ['strutture-tutte'],
    queryFn: async () => (await supabase.from('strutture').select('id, nome').order('nome')).data ?? [],
  });

  const { data: listini } = useQuery({
    queryKey: ['listini'],
    queryFn: async () =>
      (await supabase
        .from('listini')
        .select('id, struttura_id, tipo_camera, importo_mensile_lordo, valido_dal, valido_al')
        .order('valido_dal', { ascending: false })).data ?? [],
  });

  const nomeStruttura = (id: string) => (strutture ?? []).find((s: any) => s.id === id)?.nome ?? '—';

  const righe = useMemo(() => {
    const l = [...(listini ?? [])];
    l.sort((a: any, b: any) => {
      const k = nomeStruttura(a.struttura_id).localeCompare(nomeStruttura(b.struttura_id));
      if (k !== 0) return k;
      if (a.tipo_camera !== b.tipo_camera) return a.tipo_camera.localeCompare(b.tipo_camera);
      return b.valido_dal.localeCompare(a.valido_dal);
    });
    return l;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listini, strutture]);

  const daChiudere = useMemo(() => {
    if (!strutturaId || !tipoCamera) return null;
    return (listini ?? []).find(
      (r: any) => r.struttura_id === strutturaId && r.tipo_camera === tipoCamera && r.valido_al === null,
    ) ?? null;
  }, [listini, strutturaId, tipoCamera]);

  const errore = (): string | null => {
    if (!strutturaId) return 'Seleziona la sede.';
    if (!tipoCamera) return 'Seleziona il tipo camera.';
    if (!importo || Number(importo) < 0) return 'Indica un importo valido.';
    if (!validoDal) return 'Indica la data di decorrenza.';
    return null;
  };

  const apriConferma = () => {
    const err = errore();
    if (err) { toast({ title: 'Dati incompleti', description: err, variant: 'destructive' }); return; }
    setConferma(true);
  };

  const salva = async () => {
    setSaving(true);
    const { error } = await supabase.rpc('imposta_listino', {
      p_struttura_id: strutturaId,
      p_tipo_camera: tipoCamera,
      p_importo: Number(importo),
      p_valido_dal: validoDal,
    });
    setSaving(false);
    setConferma(false);
    if (error) {
      toast({ title: 'Prezzo non inserito', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Nuovo prezzo in vigore', description: `Dal ${fmtData(validoDal)} per ${nomeStruttura(strutturaId)} · camera ${tipoCamera}.` });
    setImporto(''); setValidoDal('');
    qc.invalidateQueries({ queryKey: ['listini'] });
  };

  return (
    <Card className="mt-6">
      <CardContent className="pt-6 space-y-6">
        <div>
          <h2 className="text-base font-semibold">Listini</h2>
          <p className="text-[12px] text-muted-foreground mt-1">
            I prezzi di listino si esprimono <strong>IVA inclusa</strong>: è l'importo concordato con lo studente.
            Il sistema conserva l'imponibile e lo calcola al momento del contratto.
          </p>
          <p className="text-[12px] text-muted-foreground mt-1">
            I prezzi non si modificano: si succedono nel tempo. Per cambiare un canone si apre un nuovo prezzo
            con una nuova data di decorrenza, e quello in vigore viene chiuso il giorno prima.
          </p>

        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[12px] text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Sede</th>
                <th className="text-left font-medium px-3 py-2">Tipo camera</th>
                <th className="text-right font-medium px-3 py-2">Importo</th>
                <th className="text-left font-medium px-3 py-2">Dal</th>
                <th className="text-left font-medium px-3 py-2">Al</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {righe.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-4 text-muted-foreground">Nessun prezzo inserito.</td></tr>
              )}
              {righe.map((r: any) => (
                <tr key={r.id} className={`border-t ${inVigore(r) ? '' : 'text-muted-foreground'}`}>
                  <td className="px-3 py-2">{nomeStruttura(r.struttura_id)}</td>
                  <td className="px-3 py-2 capitalize">{r.tipo_camera}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtEuro(Number(r.importo_mensile_lordo))}</td>
                  <td className="px-3 py-2">{fmtData(r.valido_dal)}</td>
                  <td className="px-3 py-2">{r.valido_al ? fmtData(r.valido_al) : '—'}</td>
                  <td className="px-3 py-2">
                    {inVigore(r) ? <Badge variant="secondary">In vigore</Badge> : <span className="text-[12px]">Storico</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 pt-2 border-t">
          <h3 className="text-sm font-semibold">Nuovo prezzo</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Sede</Label>
              <Select value={strutturaId} onValueChange={setStrutturaId}>
                <SelectTrigger><SelectValue placeholder="Seleziona…" /></SelectTrigger>
                <SelectContent>
                  {(strutture ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo camera</Label>
              <Select value={tipoCamera} onValueChange={setTipoCamera}>
                <SelectTrigger><SelectValue placeholder="Seleziona…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="singola">Singola</SelectItem>
                  <SelectItem value="doppia">Doppia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="listino_importo">Importo mensile IVA inclusa (€)</Label>
              <Input id="listino_importo" type="number" min="0" step="0.01" value={importo}
                onChange={(e) => setImporto(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="listino_dal">Decorrenza</Label>
              <Input id="listino_dal" type="date" value={validoDal} onChange={(e) => setValidoDal(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={apriConferma} disabled={saving}>Inserisci prezzo</Button>
          </div>
        </div>

        <AlertDialog open={conferma} onOpenChange={setConferma}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confermi il nuovo prezzo?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <p>
                    {nomeStruttura(strutturaId)} · camera {tipoCamera}: {importo ? fmtEuro(Number(importo)) : '—'} dal {fmtData(validoDal)}.
                  </p>
                  {daChiudere ? (
                    <p>
                      Il prezzo attuale di {fmtEuro(Number(daChiudere.importo_mensile_lordo))} (in vigore dal {fmtData(daChiudere.valido_dal)})
                      verrà chiuso il {validoDal ? fmtData(giornoPrima(validoDal)) : '—'}.
                    </p>
                  ) : (
                    <p>Non c'è nessun prezzo aperto da chiudere per questa sede e tipo camera.</p>
                  )}
                  <p className="text-muted-foreground">Un prezzo inserito non è modificabile né cancellabile.</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.preventDefault(); salva(); }} disabled={saving}>
                {saving ? 'Salvataggio...' : 'Conferma'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}