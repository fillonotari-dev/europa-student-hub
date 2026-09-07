import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { TipoDocumento } from '@shared/fic-fattura';
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
  tipo_documento?: TipoDocumento;
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
  /** Modo in vigore, letto dalle impostazioni: mai un testo scritto a mano. */
  tipoDocumento: TipoDocumento;
  onOpenChange: (open: boolean) => void;
  onConferma: () => void;
};

/**
 * Anteprima e conferma del lotto. Il dialogo NON chiama la funzione: riceve
 * dalla pagina le anteprime già ottenute al caricamento dell'elenco, così
 * lista e dialogo non possono mostrare numeri diversi. Le guardie vengono
 * comunque rivalutate dalla funzione alla conferma: quella è la verifica che
 * conta. L'avviso e il pulsante dichiarano il modo in vigore, letto dalle
 * impostazioni: chi preme deve sapere se sta creando una proforma o una fattura.
 */
export function EmettiFatturaDialog({ open, righe, busy, tipoDocumento, onOpenChange, onConferma }: Props) {
  const fatture = tipoDocumento === 'invoice';
  const prima = righe[0]?.dati;
  const totale = righe.reduce((s, r) => s + Number(r.dati.totale), 0);
  const imponibile = righe.reduce((s, r) => s + Number(r.dati.imponibile), 0);
  const iva = righe.reduce((s, r) => s + Number(r.dati.iva), 0);

  const avviso = fatture
    ? `${righe.length === 1 ? 'La fattura esisterà' : 'Le fatture esisteranno'} su Fatture in Cloud con il proprio numero e non ${righe.length === 1 ? 'sarà' : 'saranno'} più cancellabili né modificabili nell'importo.`
    : 'Verranno creati documenti proforma di prova: non sono documenti fiscali, non consumano il numero del sezionale e sono cancellabili. Le mensilità restano da fatturare e nel gestionale non viene registrata alcuna fattura.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {fatture
              ? (righe.length === 1 ? 'Emetti 1 fattura' : `Emetti ${righe.length} fatture`)
              : (righe.length === 1 ? 'Crea 1 proforma' : `Crea ${righe.length} proforma`)}
          </DialogTitle>
          <DialogDescription>
            Controlla i dati prima di creare {righe.length === 1 ? 'il documento' : 'i documenti'} su Fatture in Cloud.{' '}
            Modo in vigore: <strong>{fatture ? 'fatture reali' : 'proforma di prova'}</strong>.
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
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/40 font-semibold">
                <td className="px-3 py-2" colSpan={2}>Totale del lotto</td>
                <td className="px-3 py-2 text-right">{fmtEuro(imponibile)}</td>
                <td className="px-3 py-2 text-right">{fmtEuro(iva)}</td>
                <td className="px-3 py-2 text-right">{fmtEuro(totale)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {prima && (
          <div className="space-y-1 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground min-w-[170px]">Data di emissione</span>
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
            {avviso}{' '}
            La trasmissione allo SDI non viene fatta dal gestionale e resta un'azione manuale su Fatture in Cloud.
          </span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Annulla</Button>
          <Button onClick={onConferma} disabled={busy || righe.length === 0}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {fatture ? 'Conferma ed emetti le fatture' : 'Conferma e crea le proforma'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
