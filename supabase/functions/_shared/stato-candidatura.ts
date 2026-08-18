/**
 * Transizioni della macchina a stati delle candidature (§3 docs/Context.md).
 *
 * Funzioni PURE: nessun import, nessuna API Deno, nessun accesso al database.
 * Sono importate sia dalle edge function sia dai test vitest.
 *
 * La guardia "qualsiasi altro stato -> invariato" evita di retrocedere una
 * candidatura già decisa ('accolta', 'rifiutata') o già in lista d'attesa
 * ('in_attesa_posto').
 */

/** Stato dopo la generazione del link di completamento. */
export function statoDopoLinkGenerato(statoCorrente: string): string {
  return statoCorrente === "da_valutare" ? "in_attesa_studente" : statoCorrente;
}

/** Stato dopo l'invio del form completo da parte dello studente. */
export function statoDopoCompletamento(statoCorrente: string): string {
  if (statoCorrente === "da_valutare" || statoCorrente === "in_attesa_studente") {
    return "da_decidere";
  }
  return statoCorrente;
}
