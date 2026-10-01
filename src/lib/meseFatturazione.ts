/**
 * Mese proposto da /admin/fatturazione. Funzioni pure su stringhe 'YYYY-MM' e
 * date ISO: la data odierna arriva da oggiRoma() (fuso Europe/Rome), mai da
 * getUTC*, che fra le 00:00 e le 02:00 italiane darebbe il giorno prima.
 */

export function mesePrecedente(m: string): string {
  const [a, mm] = m.split('-').map(Number);
  return mm === 1 ? `${a - 1}-12` : `${a}-${String(mm - 1).padStart(2, '0')}`;
}

export function meseSuccessivo(m: string): string {
  const [a, mm] = m.split('-').map(Number);
  return mm === 12 ? `${a + 1}-01` : `${a}-${String(mm + 1).padStart(2, '0')}`;
}

/**
 * Il più vecchio fra il mese precedente a oggi (fatturazione posticipata) e il
 * mese più vecchio con mensilità ancora da fatturare: gli arretrati vengono
 * prima. Non propone mai il mese corrente né un mese futuro.
 */
export function mesePredefinito(oggiIso: string, competenzaPiuVecchia: string | null | undefined): string {
  const precedente = mesePrecedente(oggiIso.slice(0, 7));
  const vecchio = competenzaPiuVecchia ? competenzaPiuVecchia.slice(0, 7) : null;
  return vecchio && vecchio < precedente ? vecchio : precedente;
}
