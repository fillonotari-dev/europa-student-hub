/**
 * Conversione fra importo IVA inclusa (lordo) e imponibile.
 *
 * Regola del sistema: l'operatore digita e legge sempre l'importo IVA inclusa,
 * il database conserva l'imponibile (`contratti.canone_mensile`, `canoni.imponibile`).
 * L'unica colonna già lorda è `listini.importo_mensile_lordo`.
 *
 * Tutti i calcoli avvengono su centesimi interi: la promessa dell'intera
 * funzionalità è che il totale mostrato coincida con quello che finirà in
 * fattura, e quel totale lo produce la colonna generata
 *   canoni.totale = round(imponibile * (1 + aliquota_iva / 100), 2)
 * con l'aritmetica esatta di Postgres. Con la virgola mobile di JavaScript la
 * coincidenza non sarebbe garantita.
 *
 * Nota: la conversione non è idempotente e non deve esserlo. 500,00 € lordi
 * danno imponibile 454,55 € e totale 500,01 €: è l'arrotondamento a due
 * decimali, va dichiarato all'operatore, non corretto.
 */

const cent = (euro: number) => Math.round(euro * 100);
const euro = (c: number) => c / 100;

/** Aliquota in centesimi di punto percentuale: 10 -> 1000, 22.5 -> 2250. */
const aliquotaCent = (aliquota: number) => Math.round(aliquota * 100);

/** Divisione intera con arrotondamento half-up (valori non negativi). */
const divHalfUp = (numeratore: number, denominatore: number) =>
  Math.floor((numeratore * 2 + denominatore) / (2 * denominatore));

/** Imponibile in centesimi a partire dal lordo in centesimi. */
export function imponibileCentDaLordoCent(lordoCent: number, aliquota: number): number {
  const a = aliquotaCent(aliquota);
  // lordoCent / (1 + a/10000) = lordoCent * 10000 / (10000 + a)
  return divHalfUp(lordoCent * 10000, 10000 + a);
}

/** Totale in centesimi a partire dall'imponibile in centesimi. Replica canoni.totale. */
export function totaleCentDaImponibileCent(imponibileCent: number, aliquota: number): number {
  const a = aliquotaCent(aliquota);
  return divHalfUp(imponibileCent * (10000 + a), 10000);
}

/** Da importo IVA inclusa a imponibile, in euro con due decimali. */
export function imponibileDaLordo(lordo: number, aliquota: number): number {
  return euro(imponibileCentDaLordoCent(cent(lordo), aliquota));
}

/** Da imponibile a importo IVA inclusa, in euro con due decimali. */
export function lordoDaImponibile(imponibile: number, aliquota: number): number {
  return euro(totaleCentDaImponibileCent(cent(imponibile), aliquota));
}

export interface ScomposizioneIva {
  /** Imponibile che verrà scritto sul database. */
  imponibile: number;
  /** IVA effettiva, cioè totale - imponibile. */
  iva: number;
  /** Totale che finirà in fattura: può differire dal lordo digitato di un centesimo. */
  totale: number;
}

/** Scompone un importo IVA inclusa nei valori che il sistema userà davvero. */
export function scomposizione(lordo: number, aliquota: number): ScomposizioneIva {
  const impCent = imponibileCentDaLordoCent(cent(lordo), aliquota);
  const totCent = totaleCentDaImponibileCent(impCent, aliquota);
  return { imponibile: euro(impCent), iva: euro(totCent - impCent), totale: euro(totCent) };
}
