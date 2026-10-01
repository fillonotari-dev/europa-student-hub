import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { fmtEuro, fmtIt } from '@/pages/admin/Contratti';

export type Anteprima = {
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

export type RigaDaEmettere = {
  canoneId: string;
  etichetta: string;
  dati: Anteprima;
};

type Props = {
  open: boolean;
  righe: RigaDaEmettere[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConferma: () => void;
};

/**
 * Anteprima e conferma del lotto. Il dialogo NON chiama la funzione: riceve
 * dalla pagina le anteprime già ottenute al caricamento dell'elenco, così
 * lista e dialogo non possono mostrare numeri diversi. Le guardie vengono
 * comunque rivalutate dalla funzione alla conferma: quella è la verifica che
 * conta. Il gestionale CREA la fattura; l'emissione (SDI) resta manuale.
 */
export function EmettiFatturaDialog({ open, righe, busy, onOpenChange, onConferma }: Props) {
  const prima = righe[0]?.dati;
  const totale = righe.reduce((s, r) => s + Number(r.dati.totale), 0);
  const imponibile = righe.reduce((s, r) => s + Number(r.dati.imponibile), 0);
  const iva = righe.reduce((s, r) => s + Number(r.dati.iva), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {righe.length === 1 ? 'Crea 1 fattura su Fatture in Cloud' : `Crea ${righe.length} fatture su Fatture in Cloud`}
          </DialogTitle>
          <DialogDescription>
            Controlla i dati prima di creare {righe.length === 1 ? 'la fattura' : 'le fatture'} su Fatture in Cloud.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[300px] overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/70 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Intestatario</th>
                <th className="text-left px-3 py-2 font-semibold">Descrizione</th>
                <th className="text-right px-3 py-2 font-semibold">Imponibile</th>
                <th className="text-right px-3 py-2 font-semibold">IVA</th>
                <th className="text-right px-3 py-2 font-semibold">Totale</th>
                <th className="text-left px-3 py-2 font-semibold">Scadenza del pagamento</th>
              </tr>
            </thead>
            <tbody>
              {righe.map((r) => (
                <tr key={r.canoneId} className="border-t border-border/50">
                  <td className="px-3 py-2">{r.dati.intestatario || r.etichetta}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.dati.descrizione}</td>
                  <td className="px-3 py-2 text-right">{fmtEuro(r.dati.imponibile)}</td>
                  <td className="px-3 py-2 text-right">{fmtEuro(r.dati.iva)}</td>
                  <td className="px-3 py-2 text-right">{fmtEuro(r.dati.totale)}</td>
                  <td className="px-3 py-2">{fmtIt(r.dati.scadenza)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/40 font-semibold">
                <td className="px-3 py-2" colSpan={2}>Totale del lotto</td>
                <td className="px-3 py-2 text-right">{fmtEuro(imponibile)}</td>
                <td className="px-3 py-2 text-right">{fmtEuro(iva)}</td>
                <td className="px-3 py-2 text-right">{fmtEuro(totale)}</td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>

        {prima && (
          <div className="space-y-1 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground min-w-[170px]">Data del documento</span>
              <span>{fmtIt(prima.data_emissione)}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground min-w-[170px]">Sezionale</span>
              <span>{prima.numerazione || '—'}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground min-w-[170px]">Metodo di pagamento</span>
              <span>metodo {prima.metodo_pagamento_id} — {prima.metodo_pagamento_nome || 'senza nome'}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground min-w-[170px]">Aliquota IVA</span>
              <span>aliquota {prima.vat_id} — {prima.vat_valore}%</span>
            </div>
          </div>
        )}

        <div className="flex gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm">
          <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <span>
            La fattura viene creata su Fatture in Cloud e resta modificabile lì finché non viene emessa,
            cioè trasmessa allo SDI. Nel gestionale la mensilità passa subito a fatturato e non torna
            indietro: un documento sbagliato va corretto su Fatture in Cloud, non cancellato.{' '}
            La trasmissione allo SDI non viene fatta dal gestionale e resta un'azione manuale su Fatture in Cloud.
          </span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Annulla</Button>
          <Button onClick={onConferma} disabled={busy || righe.length === 0}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Conferma e crea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
