import type { Modalita } from '@/components/admin/contratti/AnagraficaFatturazioneFields';

export type RigaDestinazione =
  | { azione: 'aggiorna'; id: string }
  | { azione: 'crea'; id: null };

/**
 * Decide quale riga di anagrafiche_fatturazione verrà effettivamente scritta.
 *
 * È la decisione che determina quale identità fiscale viene sovrascritta:
 * alimenta sia l'avviso "usata anche da N altri contratti" sia il salvataggio,
 * quindi deve essere una sola e pura.
 *
 * - modalità "studente": si aggiorna l'anagrafica dello studente se esiste
 *   (l'indice unico parziale anagrafiche_fatt_studente_uniq la mantiene unica),
 *   altrimenti se ne crea una nuova;
 * - modalità "terzo" partendo da un terzo: si aggiorna quella riga;
 * - modalità "terzo" partendo dallo studente: si crea una riga nuova, perché
 *   l'anagrafica dello studente appartiene alla persona e serve ai contratti
 *   successivi.
 */
export function rigaDestinazioneAnagrafica(args: {
  modalita: Modalita;
  /** Id dell'anagrafica collegata allo studente, se esiste. */
  anagraficaStudenteId: string | null;
  /** Anagrafica attualmente collegata al contratto (null in creazione). */
  anaCorrente: { id: string; studente_id: string | null } | null;
}): RigaDestinazione {
  const { modalita, anagraficaStudenteId, anaCorrente } = args;

  if (modalita === 'studente') {
    return anagraficaStudenteId
      ? { azione: 'aggiorna', id: anagraficaStudenteId }
      : { azione: 'crea', id: null };
  }

  const correnteEraTerzo = !!anaCorrente && !anaCorrente.studente_id;
  return correnteEraTerzo
    ? { azione: 'aggiorna', id: anaCorrente!.id }
    : { azione: 'crea', id: null };
}
