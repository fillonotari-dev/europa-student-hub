import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { EsitoBozza } from '@/lib/precompilaContratto';

type Props = {
  esito: EsitoBozza | null;
  /** Testo dell'assegnazione appena fatta, mostrato in testa. */
  titolo: string;
  onClose: () => void;
};

/** Esito dell'assegnazione con la bozza di contratto creata (o il motivo per cui non è stata creata). */
export function EsitoBozzaDialog({ esito, titolo, onClose }: Props) {
  const navigate = useNavigate();
  if (!esito) return null;
  const contrattoId = esito.esito === 'errore' ? null : esito.contrattoId;
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{titolo}</DialogTitle>
          <DialogDescription>
            {esito.esito === 'creata' && 'Bozza di contratto creata. Va verificata e attivata: nessuna mensilità viene generata finché non la attivi.'}
            {esito.esito === 'creata' && esito.listinoMancante && ' Manca il listino per questa sede e tipo di camera: il canone è da inserire.'}
            {esito.esito === 'esistente' && (esito.motivo ? `Bozza non creata: la persona ${esito.motivo}.` : 'Esiste già un contratto per questa assegnazione.')}
            {esito.esito === 'errore' && `Bozza di contratto non creata: ${esito.motivo} Puoi crearlo dalla scheda del residente con «Crea il contratto».`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Più tardi</Button>
          {contrattoId && (
            <Button onClick={() => { onClose(); navigate(`/admin/contratti/${contrattoId}`); }}>
              Verifica e attiva il contratto
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
