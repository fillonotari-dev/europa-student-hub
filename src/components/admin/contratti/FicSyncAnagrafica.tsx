import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { mappaAnagraficaPerFic, type AnagraficaFic } from '@shared/fic-anagrafica';

type Props = {
  anagrafica: (AnagraficaFic & { id: string; fic_entity_id?: number | null }) | null | undefined;
  onSynced?: () => void;
};

/**
 * Stato di collegamento a Fatture in Cloud e comando di sincronizzazione,
 * mostrati nel riquadro "Intestazione fattura" della scheda contratto.
 */
export function FicSyncAnagrafica({ anagrafica, onSynced }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [mancanti, setMancanti] = useState<string[]>([]);
  const [esito, setEsito] = useState<{ ok: boolean; testo: string } | null>(null);

  const mappatura = useMemo(() => (anagrafica ? mappaAnagraficaPerFic(anagrafica) : null), [anagrafica]);

  if (!anagrafica) return null;
  const collegata = anagrafica.fic_entity_id != null;

  const sincronizza = async () => {
    setBusy(true);
    setMancanti([]);
    setEsito(null);
    try {
      const { data, error } = await supabase.functions.invoke('fic-sync-anagrafica', {
        body: { anagrafica_id: anagrafica.id },
      });
      if (error) throw error;
      if (data?.ok) {
        setEsito({ ok: true, testo: data.message });
        toast({ title: 'Sincronizzazione riuscita', description: data.message });
        onSynced?.();
      } else {
        if (Array.isArray(data?.campi_mancanti)) setMancanti(data.campi_mancanti);
        setEsito({ ok: false, testo: data?.message ?? 'Sincronizzazione non riuscita.' });
        toast({
          title: 'Sincronizzazione non riuscita',
          description: data?.message ?? 'Riprova più tardi.',
          variant: 'destructive',
        });
        if (data?.scollegata) onSynced?.();
      }
    } catch (e: any) {
      setEsito({ ok: false, testo: 'Impossibile contattare il servizio di sincronizzazione.' });
      toast({
        title: 'Sincronizzazione non riuscita',
        description: 'Impossibile contattare il servizio di sincronizzazione.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm">
          {collegata ? (
            <span className="inline-flex items-center gap-1.5 text-success">
              <CheckCircle2 className="w-4 h-4" />
              Collegata a Fatture in Cloud (ID {anagrafica.fic_entity_id})
            </span>
          ) : (
            <span className="text-muted-foreground">Non ancora collegata a Fatture in Cloud</span>
          )}
        </p>
        <Button size="sm" variant="outline" onClick={sincronizza} disabled={busy}>
          <RefreshCw className={busy ? 'w-3.5 h-3.5 mr-1.5 animate-spin' : 'w-3.5 h-3.5 mr-1.5'} />
          Sincronizza con Fatture in Cloud
        </Button>
      </div>

      {mappatura?.estera && mappatura.trasformazioni.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Anagrafica estera: {mappatura.trasformazioni.join('; ')}.
        </p>
      )}

      {mancanti.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
          <div>
            <p className="text-muted-foreground">Non inviata: mancano questi dati.</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              {mancanti.map(m => <li key={m}>{m}</li>)}
            </ul>
          </div>
        </div>
      )}

      {esito && mancanti.length === 0 && (
        <p className={esito.ok ? 'text-xs text-success' : 'text-xs text-destructive'}>{esito.testo}</p>
      )}
    </div>
  );
}
