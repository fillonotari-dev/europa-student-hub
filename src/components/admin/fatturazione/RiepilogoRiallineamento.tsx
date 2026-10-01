import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export type EsitoRiallineamento = {
  ok: true;
  riepilogo: {
    controllate: number; aggiornate: number; annullate: number; anomalie: number;
    invariate: number; saltate: number; annullamenti_bloccati: boolean;
  };
  aggiornate: { fattura_id: string; numero: string; campi: string[]; importo_divergente: boolean }[];
  annullate: { fattura_id: string; numero: string; studente: string }[];
  anomalie: { fattura_id: string; numero: string; studente: string; codice: string }[];
};

const NOMI_CAMPI: Record<string, string> = {
  numero: 'numero', numerazione: 'sezionale', data: 'data', imponibile: 'imponibile', iva: 'IVA',
  totale: 'totale', ei_status: 'stato di invio', url_documento: 'link al documento',
};

export const SPIEGAZIONE_ANOMALIA: Record<string, string> = {
  troppi_404: 'più di due documenti risultano cancellati nello stesso giro: per sicurezza nessuno è stato annullato, vanno verificati su Fatture in Cloud',
  documento_trasmesso_scomparso: 'il documento risulta trasmesso allo SDI ma non esiste più su Fatture in Cloud',
  mensilita_non_fatturata_documento_scomparso: 'il documento non esiste più, ma la mensilità collegata non è in stato fatturata (per esempio è già pagata)',
  parametri_riallineamento_mancanti: 'Fatture in Cloud ha restituito dati incompleti',
};

export function RiepilogoRiallineamento({ esito, onClose }: { esito: EsitoRiallineamento | null; onClose: () => void }) {
  if (!esito) return null;
  const r = esito.riepilogo;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Riallineamento concluso</DialogTitle>
          <DialogDescription>
            {r.controllate} fatture controllate: {r.aggiornate} aggiornate, {r.annullate} annullate,
            {' '}{r.anomalie} anomalie, {r.invariate} invariate{r.saltate ? `, ${r.saltate} saltate per un errore di Fatture in Cloud` : ''}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm max-h-[60vh] overflow-y-auto">
          {esito.aggiornate.length > 0 && (
            <div>
              <p className="font-medium mb-1">Aggiornate</p>
              <ul className="space-y-1">
                {esito.aggiornate.map(a => (
                  <li key={a.fattura_id}>
                    {a.numero}: {a.campi.map(c => NOMI_CAMPI[c] ?? c).join(', ')}
                    {a.importo_divergente && <span className="text-destructive"> — importo diverso dalla mensilità</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {esito.annullate.length > 0 && (
            <div>
              <p className="font-medium mb-1">Annullate</p>
              <ul className="space-y-1">
                {esito.annullate.map(a => (
                  <li key={a.fattura_id}>{a.numero} — {a.studente}: mensilità tornata da fatturare</li>
                ))}
              </ul>
            </div>
          )}
          {esito.anomalie.length > 0 && (
            <div>
              <p className="font-medium mb-1">Anomalie</p>
              <ul className="space-y-1">
                {esito.anomalie.map(a => (
                  <li key={a.fattura_id}>{a.numero} — {a.studente}: {SPIEGAZIONE_ANOMALIA[a.codice] ?? a.codice}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter><Button onClick={onClose}>Chiudi</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
