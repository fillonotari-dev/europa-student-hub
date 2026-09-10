/**
 * Generazione dello scadenzario (canoni) di un contratto.
 *
 * Regola provvisoria concordata: una riga per ogni mese di calendario toccato
 * dal periodo, con canone INTERO anche sui mesi parziali. Il rateo sui giorni
 * non è ancora deciso con la direzione e non va inventato qui.
 *
 * Scadenza POSTICIPATA: la mensilità scade il giorno indicato dal contratto
 * (giorno_scadenza) nel mese SUCCESSIVO a quello di competenza. Il canone di
 * agosto con giorno 15 scade il 15 settembre.
 *
 * Nota importante: `canoni.totale` è una colonna GENERATED ALWAYS STORED e
 * Postgres rifiuta l'intera scrittura se le si assegna un valore. Questa
 * funzione non lo produce mai, anche se i tipi generati lo espongono.
 */

import { lordoDaImponibile } from '@/lib/iva';

export type RigaScadenzario = {
  competenza: string;
  imponibile: number;
  aliquota_iva: number;
  scadenza: string;
  stato: 'da_fatturare';
};

export type ParametriScadenzario = {
  dataInizio: string;
  dataFine: string;
  canoneMensile: number;
  aliquotaIva: number;
  giornoScadenza: number;
};

function parseISO(d: string): { y: number; m: number; d: number } {
  const [y, m, day] = d.split('-').map(Number);
  return { y, m, d: day };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function generaScadenzario(p: ParametriScadenzario): RigaScadenzario[] {
  const { dataInizio, dataFine, canoneMensile, aliquotaIva, giornoScadenza } = p;
  if (!dataInizio || !dataFine) return [];
  const a = parseISO(dataInizio);
  const b = parseISO(dataFine);
  const startIdx = a.y * 12 + (a.m - 1);
  const endIdx = b.y * 12 + (b.m - 1);
  if (endIdx < startIdx) return [];

  // Clamp a 28: il giorno deve esistere anche a febbraio, che è il mese di
  // scadenza delle mensilità di gennaio.
  const giorno = Math.min(28, Math.max(1, Math.trunc(giornoScadenza || 1)));
  const righe: RigaScadenzario[] = [];

  for (let i = startIdx; i <= endIdx; i++) {
    const y = Math.floor(i / 12);
    const m = (i % 12) + 1;
    // Scadenza nel mese successivo: la stessa aritmetica applicata a i + 1,
    // così il passaggio d'anno non richiede casi speciali.
    const ys = Math.floor((i + 1) / 12);
    const ms = ((i + 1) % 12) + 1;
    righe.push({
      competenza: `${y}-${pad(m)}-01`,
      imponibile: canoneMensile,
      aliquota_iva: aliquotaIva,
      scadenza: `${ys}-${pad(ms)}-${pad(giorno)}`,
      stato: 'da_fatturare',
    });
  }

  return righe;
}

/**
 * Totale ivato di una riga, calcolato solo per l'anteprima: non va scritto.
 * Delega a src/lib/iva.ts, che calcola su centesimi interi replicando la
 * colonna generata canoni.totale: la formula esiste in un posto solo.
 */
export function totaleRiga(r: { imponibile: number; aliquota_iva: number }): number {
  return lordoDaImponibile(r.imponibile, r.aliquota_iva);
}
