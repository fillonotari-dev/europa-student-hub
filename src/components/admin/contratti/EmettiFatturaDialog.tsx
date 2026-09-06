import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { TIPO_DOCUMENTO } from '@shared/fic-fattura';
import { fmtEuro, fmtIt } from '@/pages/admin/Contratti';

type Anteprima = {
  intestatario: string;
  descrizione: string;
  imponibile: number;
  iva: number;
  totale: number;
  aliquota: number;
  data_emissione: string;
  scadenza: string;
  numerazione: string;
  metodo_pagamento_id: number;
  metodo_pagamento_nome: string;
  vat_id: number;
  vat_valore: number;
};

type Props = {
  canoneId: string | null;
  onOpenChange: (open: boolean) => void;
  onEmessa: () => void;
};

const Voce = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex gap-2 text-sm">
    <span className="text-muted-foreground min-w-[150px]">{k}</span>
    <span>{v}</span>
  </div>
);

/**
 * Due tempi obbligati: all'apertura si chiede alla funzione l'anteprima
 * (nessuna chiamata a Fatture in Cloud, nessuna scrittura), poi l'operatore
 * conferma. L'avviso si adegua da solo al valore di TIPO_DOCUMENTO, così non
 * può restare a mentire quando la costante cambia.
 */
export function EmettiFatturaDialog({ canoneId, onOpenChange, onEmessa }: Props) {
  const { toast } = useToast();
  const [caricamento, setCaricamento] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dati, setDati] = useState<Anteprima | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    if (!canoneId) { setDati(null); setErrore(null); return; }
    let annullato = false;
    setCaricamento(true);
    setDati(null);
    setErrore(null);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('fic-emetti-fattura', {
          body: { canone_ids: [canoneId], conferma: false },
        });
        if (error) throw error;
        const esito = data?.esiti?.[0];
        if (annullato) return;
        if (esito?.ok) setDati(esito.dati as Anteprima);
        else setErrore(esito?.message ?? 'Anteprima non disponibile.');
      } catch {
        if (!annullato) setErrore('Impossibile contattare il servizio di fatturazione.');
      } finally {
        if (!annullato) setCaricamento(false);
      }
    })();
    return () => { annullato = true; };
  }, [canoneId]);

  const conferma = async () => {
    if (!canoneId) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('fic-emetti-fattura', {
        body: { canone_ids: [canoneId], conferma: true },
      });
      if (error) throw error;
      const esito = data?.esiti?.[0];
      if (esito?.ok) {
        const saltati: string[] = esito.passi_saltati ?? [];
        toast({
          title: TIPO_DOCUMENTO === 'invoice' ? 'Fattura emessa' : 'Documento di prova creato',
          description: saltati.length > 0 ? `${esito.message} ${saltati.join('; ')}.` : esito.message,
        });
        onEmessa();
        onOpenChange(false);
      } else {
        toast({
          title: 'Emissione non riuscita',
          description: esito?.message ?? 'Riprova più tardi.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Emissione non riuscita',
        description: 'Impossibile contattare il servizio di fatturazione.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const avviso = TIPO_DOCUMENTO === 'invoice'
    ? 'La fattura esisterà su Fatture in Cloud con il suo numero e non sarà più cancellabile né modificabile nell\'importo.'
    : 'Verrà creato un documento proforma di prova: non è un documento fiscale, non consuma il numero del sezionale ed è cancellabile. La mensilità resta da fatturare e nel gestionale non viene registrata alcuna fattura.';

  return (
    <Dialog open={!!canoneId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Emetti fattura</DialogTitle>
          <DialogDescription>
            Controlla i dati prima di creare il documento su Fatture in Cloud.
          </DialogDescription>
        </DialogHeader>

        {caricamento && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="w-4 h-4 animate-spin" />Preparazione dell'anteprima…
          </div>
        )}

        {errore && (
          <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <span>{errore}</span>
          </div>
        )}

        {dati && (
          <div className="space-y-1.5">
            <Voce k="Intestatario" v={dati.intestatario} />
            <Voce k="Descrizione" v={dati.descrizione} />
            <Voce k="Imponibile" v={fmtEuro(dati.imponibile)} />
            <Voce k="IVA" v={`${fmtEuro(dati.iva)} (${dati.aliquota}%)`} />
            <Voce k="Totale" v={<strong>{fmtEuro(dati.totale)}</strong>} />
            <Voce k="Data di emissione" v={fmtIt(dati.data_emissione)} />
            <Voce k="Scadenza" v={fmtIt(dati.scadenza)} />
            <Voce k="Sezionale" v={dati.numerazione || '—'} />
            <Voce k="Metodo di pagamento" v={`metodo ${dati.metodo_pagamento_id} — ${dati.metodo_pagamento_nome || 'senza nome'}`} />
            <Voce k="Aliquota IVA" v={`aliquota ${dati.vat_id} — ${dati.vat_valore}%`} />
          </div>
        )}

        {dati && (
          <div className="flex gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <span>
              {avviso}{' '}
              La trasmissione allo SDI non viene fatta dal gestionale e resta un'azione manuale su Fatture in Cloud.
            </span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Annulla</Button>
          <Button onClick={conferma} disabled={busy || !dati}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Conferma ed emetti
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
