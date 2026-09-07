/**
 * Copertura di un mese di competenza da parte del periodo di un contratto.
 *
 * Il rateo sui giorni non viene calcolato: il primo e l'ultimo mese di un
 * contratto vengono addebitati interi anche quando sono parziali, e vanno
 * corretti a mano PRIMA dell'emissione, perché dopo canoni_protect_fatturati
 * blocca l'importo. Questa funzione è il presidio che rende visibile il caso.
 *
 * Tutto si calcola su stringhe ISO in UTC: nessun fuso orario di mezzo.
 */

export type CoperturaMese = {
  /** Giorni del mese di competenza (28, 29, 30 o 31). */
  giorniMese: number;
  /** Giorni effettivamente coperti dal periodo del contratto. */
  giorniCoperti: number;
  /** Vero quando i giorni coperti sono meno dei giorni del mese. */
  parziale: boolean;
};

const giorno = (iso: string) => Date.UTC(
  Number(iso.slice(0, 4)),
  Number(iso.slice(5, 7)) - 1,
  Number(iso.slice(8, 10)),
);

const GIORNO_MS = 86_400_000;

/** Giorni del mese a cui appartiene la competenza: il giorno 0 del mese dopo. */
export function giorniDelMese(competenzaIso: string): number {
  const a = Number(competenzaIso.slice(0, 4));
  const m = Number(competenzaIso.slice(5, 7));
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

/**
 * Confronta il mese della competenza con il periodo del contratto.
 * Estremi inclusi: un contratto dal 15 al 30 settembre copre 16 giorni.
 */
export function coperturaMese(
  competenzaIso: string,
  dataInizio: string | null | undefined,
  dataFine: string | null | undefined,
): CoperturaMese {
  const giorniMese = giorniDelMese(competenzaIso);
  const a = Number(competenzaIso.slice(0, 4));
  const m = Number(competenzaIso.slice(5, 7));
  const primo = Date.UTC(a, m - 1, 1);
  const ultimo = Date.UTC(a, m - 1, giorniMese);

  // Senza estremi noti non si può affermare nulla: il mese si dichiara intero.
  const da = dataInizio ? Math.max(primo, giorno(dataInizio)) : primo;
  const al = dataFine ? Math.min(ultimo, giorno(dataFine)) : ultimo;

  const giorniCoperti = al < da ? 0 : Math.round((al - da) / GIORNO_MS) + 1;
  return { giorniMese, giorniCoperti, parziale: giorniCoperti < giorniMese };
}

/** "17 giorni su 30", oppure null se il mese è interamente coperto. */
export function etichettaCopertura(c: CoperturaMese): string | null {
  return c.parziale ? `${c.giorniCoperti} giorni su ${c.giorniMese}` : null;
}
