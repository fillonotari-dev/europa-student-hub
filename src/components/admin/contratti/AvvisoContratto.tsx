import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  bozzaId: string | null;
  onCrea: () => void;
  onVerifica: (id: string) => void;
};

/** Avviso fisso in testa alla scheda: residente assegnato o in casa senza contratto attivo. */
export function AvvisoContratto({ bozzaId, onCrea, onVerifica }: Props) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap rounded-lg border border-accent/50 bg-accent/10 px-4 py-3">
      <div className="flex items-start gap-2 text-sm text-foreground">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-accent-foreground" />
        <span>
          {bozzaId
            ? 'Nessun contratto attivo: c\u2019è una bozza da verificare e attivare.'
            : 'Nessun contratto attivo e nessuna bozza: le mensilità non vengono generate.'}
        </span>
      </div>
      {bozzaId
        ? <Button size="sm" onClick={() => onVerifica(bozzaId)}>Verifica e attiva</Button>
        : <Button size="sm" onClick={onCrea}>Crea il contratto</Button>}
    </div>
  );
}
