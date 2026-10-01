import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  creaBozzaDaAssegnazione, type AssegnazioneSenzaContratto, type EsitoBozza,
} from '@/lib/precompilaContratto';

const fmtE = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const fmtD = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('it-IT') : '—');

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  elenco: AssegnazioneSenzaContratto[];
};

type Riga = { a: AssegnazioneSenzaContratto; esito: EsitoBozza };

/** Conferma, creazione una alla volta e riepilogo delle bozze mancanti. */
export function BozzeMancantiDialog({ open, onOpenChange, elenco }: Props) {
  const qc = useQueryClient();
  const [inCorso, setInCorso] = useState(false);
  const [fatti, setFatti] = useState<Riga[] | null>(null);
  const [avanzamento, setAvanzamento] = useState(0);
  const n = elenco.length;

  const chiudi = (v: boolean) => {
    if (inCorso) return;
    if (!v) { setFatti(null); setAvanzamento(0); }
    onOpenChange(v);
  };

  const crea = async () => {
    setInCorso(true);
    const out: Riga[] = [];
    for (const a of elenco) {
      // Non solleva: un errore su una non ferma le altre.
      out.push({ a, esito: await creaBozzaDaAssegnazione(a.assegnazioneId) });
      setAvanzamento(out.length);
    }
    setFatti(out);
    setInCorso(false);
    qc.invalidateQueries({ queryKey: ['contratti'] });
    qc.invalidateQueries({ queryKey: ['studente-contratti'] });
    qc.invalidateQueries({ queryKey: ['stadio'] });
    qc.invalidateQueries({ queryKey: ['assegnazioni-senza-contratto'] });
  };

  return (
    <Dialog open={open} onOpenChange={chiudi}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{fatti ? 'Riepilogo delle bozze' : 'Prepara le bozze mancanti'}</DialogTitle>
          {!fatti && (
            <DialogDescription>
              Verranno create {n} bozze di contratto. Nessun contratto viene attivato e nessuna mensilità viene
              generata: ogni bozza va verificata e attivata a mano.
            </DialogDescription>
          )}
        </DialogHeader>

        {!fatti ? (
          <ul className="divide-y divide-border/50 text-sm">
            {elenco.map(a => (
              <li key={a.assegnazioneId} className="py-2">
                <div className="font-medium">{a.persona}</div>
                <div className="text-muted-foreground">
                  {fmtD(a.dataInizio)} → {fmtD(a.dataFine)} · {a.sede}{a.tipoCamera ? ` · ${a.tipoCamera}` : ''} ·{' '}
                  canone {a.canone.listinoMancante ? 'da inserire' : `da listino ${fmtE(a.canone.lordo)}`}
                  {a.intestazioneDaCreare && ' · intestazione: verrà creata a nome dello studente'}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-border/50 text-sm">
            {fatti.map(({ a, esito }) => (
              <li key={a.assegnazioneId} className="py-2">
                <span className="font-medium">{a.persona}</span>{': '}
                {esito.esito === 'creata' && (
                  <Link className="text-primary hover:underline" to={`/admin/contratti/${esito.contrattoId}`}>creata</Link>
                )}
                {esito.esito === 'esistente' && (
                  <span>esisteva già{esito.motivo ? ` (${esito.motivo})` : ''}</span>
                )}
                {esito.esito === 'errore' && <span className="text-destructive">non creata: {esito.motivo}</span>}
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          {fatti ? (
            <>
              <Button variant="outline" asChild>
                <Link to="/admin/contratti?stato=bozza" onClick={() => chiudi(false)}>Vai alle bozze da verificare</Link>
              </Button>
              <Button onClick={() => chiudi(false)}>Chiudi</Button>
            </>
          ) : (
            <>
              <Button variant="outline" disabled={inCorso} onClick={() => chiudi(false)}>Annulla</Button>
              <Button disabled={inCorso || n === 0} onClick={crea}>
                {inCorso ? `Creazione ${avanzamento}/${n}…` : `Crea ${n} bozze`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
