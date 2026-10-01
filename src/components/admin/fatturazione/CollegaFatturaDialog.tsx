import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Info, Loader2 } from 'lucide-react';
import { fmtEuro, fmtIt } from '@/pages/admin/Contratti';
import { cn } from '@/lib/utils';

type Documento = { id: number; number: number | null; numeration: string; date: string | null; amount_gross: number | null };

export type RigaDaCollegare = { canoneId: string; etichetta: string; totale: number };

export function CollegaFatturaDialog({ riga, onClose, onCollegata }: {
  riga: RigaDaCollegare | null;
  onClose: () => void;
  onCollegata: (messaggio: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [documenti, setDocumenti] = useState<Documento[]>([]);
  const [scelto, setScelto] = useState<number | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!riga) return;
    setDocumenti([]); setScelto(null); setErrore(null); setLoading(true);
    supabase.functions.invoke('fic-collega-fattura', { body: { modo: 'elenca', canone_id: riga.canoneId } })
      .then(({ data, error }) => {
        if (error) setErrore('Impossibile leggere le fatture da Fatture in Cloud.');
        else if (!data?.ok) setErrore(data?.message ?? 'Errore sconosciuto.');
        else setDocumenti(data.documenti ?? []);
      })
      .finally(() => setLoading(false));
  }, [riga]);

  const conferma = async () => {
    if (!riga || scelto == null) return;
    setBusy(true); setErrore(null);
    const { data, error } = await supabase.functions.invoke('fic-collega-fattura', {
      body: { modo: 'collega', canone_id: riga.canoneId, fic_document_id: scelto },
    });
    setBusy(false);
    if (error) { setErrore('Collegamento non riuscito: nessuna risposta dal server.'); return; }
    if (!data?.ok) { setErrore(data?.message ?? 'Collegamento non riuscito.'); return; }
    onCollegata(data.message);
  };

  return (
    <Dialog open={!!riga} onOpenChange={o => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Collega fattura esistente</DialogTitle>
          <DialogDescription>
            {riga?.etichetta} — totale mensilità {riga ? fmtEuro(riga.totale) : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
          <span>Nessun documento viene creato o modificato su Fatture in Cloud: la fattura scelta viene solo registrata nel gestionale e collegata a questa mensilità.</span>
        </div>

        <div className="max-h-[320px] overflow-y-auto border border-border/50 rounded-lg">
          {loading && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Lettura da Fatture in Cloud…
            </div>
          )}
          {!loading && documenti.length === 0 && !errore && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nessuna fattura di questo cliente da registrare.
            </div>
          )}
          {documenti.map(d => {
            const diverso = d.amount_gross != null && riga && Math.round(d.amount_gross * 100) !== Math.round(riga.totale * 100);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setScelto(d.id)}
                className={cn(
                  'w-full flex items-center justify-between gap-4 px-4 py-3 text-sm text-left border-t first:border-t-0 border-border/50 hover:bg-muted/50',
                  scelto === d.id && 'bg-muted',
                )}
              >
                <span className="font-medium">N. {d.number ?? '—'}{d.numeration}</span>
                <span className="text-muted-foreground">{d.date ? fmtIt(d.date) : '—'}</span>
                <span className={cn(diverso && 'text-destructive')}>
                  {d.amount_gross != null ? fmtEuro(d.amount_gross) : '—'}
                  {diverso && ' (importo diverso)'}
                </span>
              </button>
            );
          })}
        </div>

        {errore && <p className="text-sm text-destructive">{errore}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Annulla</Button>
          <Button onClick={conferma} disabled={scelto == null || busy}>
            {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Collega la fattura scelta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
