/**
 * Generazione dello scadenzario (canoni) di un contratto.
 *
 * Regola provvisoria concordata: una riga per ogni mese di calendario toccato
 * dal periodo, con canone INTERO anche sui mesi parziali. Il rateo sui giorni
 * non è ancora deciso con la direzione e non va inventato qui.
 *
 * Nota importante: `canoni.totale` è una colonna GENERATED ALWAYS STORED e
 * Postgres rifiuta l'intera scrittura se le si assegna un valore. Questa
 * funzione non lo produce mai, anche se i tipi generati lo espongono.
 */

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

  const giorno = Math.min(28, Math.max(1, Math.trunc(giornoScadenza || 1)));
  const righe: RigaScadenzario[] = [];

  for (let i = startIdx; i <= endIdx; i++) {
    const y = Math.floor(i / 12);
    const m = (i % 12) + 1;
    righe.push({
      competenza: `${y}-${pad(m)}-01`,
      imponibile: canoneMensile,
      aliquota_iva: aliquotaIva,
      scadenza: `${y}-${pad(m)}-${pad(giorno)}`,
      stato: 'da_fatturare',
    });
  }

  return righe;
}

/** Totale ivato di una riga, calcolato solo per l'anteprima: non va scritto. */
export function totaleRiga(r: { imponibile: number; aliquota_iva: number }): number {
  return Math.round(r.imponibile * (1 + r.aliquota_iva / 100) * 100) / 100;
}
