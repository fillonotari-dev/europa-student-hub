import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

type Esito =
  | { ok: true; azienda: string; quotaOra: string | null; quotaMese: string | null }
  | { ok: false; messaggio: string };

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
    <Card>
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
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
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
      </CardContent>
    </Card>
  );
}
