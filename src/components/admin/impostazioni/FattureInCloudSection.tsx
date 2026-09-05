import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';

type Esito =
  | { ok: true; azienda: string; quotaOra: string | null; quotaMese: string | null }
  | { ok: false; messaggio: string };

type ImpostazioniFic = {
  fic_numerazione: string;
  fic_giorni_scadenza: string;
  fic_giorno_emissione: string;
  fic_iban: string;
  fic_metodo_pagamento: string;
};

const VUOTE: ImpostazioniFic = {
  fic_numerazione: '',
  fic_giorni_scadenza: '',
  fic_giorno_emissione: '',
  fic_iban: '',
  fic_metodo_pagamento: '',
};

function ImpostazioniFatturazione() {
  const { toast } = useToast();
  const [form, setForm] = useState<ImpostazioniFic>(VUOTE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [numerazioneBloccata, setNumerazioneBloccata] = useState(false);

  useEffect(() => {
    (async () => {
      const [imp, emesse] = await Promise.all([
        supabase
          .from('impostazioni')
          .select('fic_numerazione, fic_giorni_scadenza, fic_giorno_emissione, fic_iban, fic_metodo_pagamento')
          .eq('id', 1)
          .maybeSingle(),
        supabase.from('fatture').select('id', { count: 'exact', head: true }).eq('stato', 'emessa'),
      ]);
      if (imp.error) {
        toast({ title: 'Errore', description: imp.error.message, variant: 'destructive' });
      } else if (imp.data) {
        setForm({
          fic_numerazione: imp.data.fic_numerazione ?? '',
          fic_giorni_scadenza: imp.data.fic_giorni_scadenza?.toString() ?? '',
          fic_giorno_emissione: imp.data.fic_giorno_emissione?.toString() ?? '',
          fic_iban: imp.data.fic_iban ?? '',
          fic_metodo_pagamento: imp.data.fic_metodo_pagamento ?? '',
        });
      }
      setNumerazioneBloccata((emesse.count ?? 0) > 0);
      setLoading(false);
    })();
  }, [toast]);

  const setField = (k: keyof ImpostazioniFic, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const salva = async () => {
    const giorniScadenza = Number(form.fic_giorni_scadenza);
    const giornoEmissione = Number(form.fic_giorno_emissione);
    if (!Number.isInteger(giorniScadenza) || giorniScadenza < 1 || giorniScadenza > 365) {
      toast({ title: 'Giorni di scadenza non validi', description: 'Indica un numero intero fra 1 e 365.', variant: 'destructive' });
      return;
    }
    if (!Number.isInteger(giornoEmissione) || giornoEmissione < 1 || giornoEmissione > 28) {
      toast({ title: 'Giorno di emissione non valido', description: 'Indica un giorno del mese fra 1 e 28.', variant: 'destructive' });
      return;
    }
    if (form.fic_iban.trim().length > 34) {
      toast({ title: 'IBAN troppo lungo', description: 'Massimo 34 caratteri.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const patch: Record<string, unknown> = {
      fic_giorni_scadenza: giorniScadenza,
      fic_giorno_emissione: giornoEmissione,
      fic_iban: form.fic_iban.trim() || null,
      fic_metodo_pagamento: form.fic_metodo_pagamento.trim() || null,
    };
    if (!numerazioneBloccata) patch.fic_numerazione = form.fic_numerazione.trim() || null;
    const { error } = await supabase.from('impostazioni').update(patch).eq('id', 1);
    setSaving(false);
    if (error) toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    else toast({ title: 'Impostazioni di fatturazione salvate' });
  };

  if (loading) return <p className="text-[13px] text-muted-foreground">Caricamento impostazioni…</p>;

  return (
    <div className="space-y-4 pt-4 border-t">
      <div>
        <h3 className="text-sm font-semibold">Impostazioni di fatturazione</h3>
        <p className="text-[13px] text-muted-foreground">
          Valori usati per la creazione dei documenti. Non viene emesso nulla da questa pagina.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fic_numerazione">Sigla di numerazione</Label>
          <Input
            id="fic_numerazione"
            value={form.fic_numerazione}
            onChange={(e) => setField('fic_numerazione', e.target.value)}
            placeholder="/S"
            readOnly={numerazioneBloccata}
            disabled={numerazioneBloccata}
          />
          {numerazioneBloccata ? (
            <Alert className="mt-2">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription className="text-[12px]">
                Esiste già almeno una fattura emessa: la sigla di numerazione non è più modificabile.
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Non sarà più modificabile dopo la prima fattura emessa.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fic_metodo_pagamento">Metodo di pagamento</Label>
          <Input
            id="fic_metodo_pagamento"
            value={form.fic_metodo_pagamento}
            onChange={(e) => setField('fic_metodo_pagamento', e.target.value)}
            placeholder="bonifico"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fic_giorni_scadenza">Giorni di scadenza</Label>
          <Input
            id="fic_giorni_scadenza"
            type="number"
            min={1}
            max={365}
            value={form.fic_giorni_scadenza}
            onChange={(e) => setField('fic_giorni_scadenza', e.target.value)}
            placeholder="30"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fic_giorno_emissione">Giorno di emissione</Label>
          <Input
            id="fic_giorno_emissione"
            type="number"
            min={1}
            max={28}
            value={form.fic_giorno_emissione}
            onChange={(e) => setField('fic_giorno_emissione', e.target.value)}
            placeholder="25"
          />
          <p className="text-[11px] text-muted-foreground">Giorno del mese, da 1 a 28.</p>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="fic_iban">IBAN</Label>
          <Input
            id="fic_iban"
            value={form.fic_iban}
            onChange={(e) => setField('fic_iban', e.target.value)}
            placeholder="IT00A0000000000000000000000"
            maxLength={34}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={salva} disabled={saving}>
          {saving ? 'Salvataggio...' : 'Salva'}
        </Button>
      </div>
    </div>
  );
}

export function FattureInCloudSection() {
  const [loading, setLoading] = useState(false);
  const [esito, setEsito] = useState<Esito | null>(null);

  const verifica = async () => {
    setLoading(true);
    setEsito(null);
    try {
      const { data, error } = await supabase.functions.invoke('fic-test-connection');
      if (error) throw error;
      if (data?.ok) {
        setEsito({
          ok: true,
          azienda: data.company?.name ?? '—',
          quotaOra: data.quota?.hourly_remaining ?? null,
          quotaMese: data.quota?.monthly_remaining ?? null,
        });
      } else {
        setEsito({ ok: false, messaggio: data?.message ?? 'Verifica non riuscita.' });
      }
    } catch (e: any) {
      setEsito({ ok: false, messaggio: e?.message ?? 'Errore di comunicazione con il server.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardContent className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Fatture in Cloud</h2>
          <p className="text-[13px] text-muted-foreground">
            Verifica che il collegamento con l'account di fatturazione sia attivo. In questa fase il
            collegamento è in sola lettura: nessun documento viene creato o inviato.
          </p>
        </div>

        <Button onClick={verifica} disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {loading ? 'Verifica in corso...' : 'Verifica connessione'}
        </Button>

        {esito?.ok === true && (
          <div className="rounded-md border p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 text-success" />
              Connessione attiva
            </div>
            <p className="text-[13px]">
              Azienda collegata: <strong>{esito.azienda}</strong>
            </p>
            {(esito.quotaOra || esito.quotaMese) && (
              <p className="text-[12px] text-muted-foreground">
                Chiamate residue — quest'ora: {esito.quotaOra ?? '—'} · questo mese: {esito.quotaMese ?? '—'}
              </p>
            )}
          </div>
        )}

        {esito?.ok === false && (
          <div className="rounded-md border border-destructive/40 p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <XCircle className="w-4 h-4" />
              Verifica non riuscita
            </div>
            <p className="text-[13px]">{esito.messaggio}</p>
          </div>
        )}

        <ImpostazioniFatturazione />
      </CardContent>
    </Card>
  );
}
