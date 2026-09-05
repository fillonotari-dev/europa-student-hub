/**
 * Partizione delle mensilità di un contratto rispetto a un cambio di canone.
 *
 * Specchio lato interfaccia della condizione scritta nella funzione database
 * aggiorna_canone_contratto: una mensilità viene aggiornata dal cambio di
 * canone solo se è da_fatturare, ha competenza dal mese corrente in poi ed è
 * ancora allineata al canone attuale del contratto. Le righe corrette a mano
 * dall'operatore hanno un imponibile deliberatamente diverso e restano intatte.
 *
 * Tenere il criterio qui, e non inline nei componenti, garantisce che il
 * conteggio mostrato nel dialogo di conferma coincida con ciò che la funzione
 * database farà davvero.
 */

export type MensilitaCanone = {
  stato: string;
  competenza: string; // YYYY-MM-DD, primo giorno del mese
  imponibile: number;
};

export type PartizioneMensilita<T extends MensilitaCanone> = {
  /** Righe che un cambio di canone aggiornerebbe. */
  aggiornate: T[];
  /** Righe che un cambio di canone lascerebbe intatte. */
  intatte: T[];
};

function primoDelMese(oggi: string): string {
  return oggi.slice(0, 7) + '-01';
}

export function partizionaMensilitaPerCambioCanone<T extends MensilitaCanone>(
  mensilita: T[],
  canoneAttuale: number,
  oggi: string,
): PartizioneMensilita<T> {
  const soglia = primoDelMese(oggi);
  const aggiornate: T[] = [];
  const intatte: T[] = [];
  for (const m of mensilita) {
    const toccata =
      m.stato === 'da_fatturare' &&
      m.competenza >= soglia &&
      Number(m.imponibile) === canoneAttuale;
    (toccata ? aggiornate : intatte).push(m);
  }
  return { aggiornate, intatte };
}

/** Vero se l'imponibile della riga è diverso dal canone del contratto. */
export function imponibilePersonalizzato(riga: MensilitaCanone, canoneAttuale: number): boolean {
  return Number(riga.imponibile) !== canoneAttuale;
}
