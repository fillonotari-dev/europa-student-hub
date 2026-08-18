# Macchina a stati candidature: transizioni mancanti

Oggi il link di completamento e l'invio del form completo non scrivono mai `stato`: una candidatura resta in `da_valutare` per tutto il percorso. Correzione solo a livello di codice, nessuna migration, nessun dato toccato.

## 1. Nuovo modulo condiviso

`supabase/functions/_shared/stato-candidatura.ts` — due funzioni pure, nessun import, nessuna API Deno, nessun accesso al database:

- `statoDopoLinkGenerato(stato)`: `da_valutare` → `in_attesa_studente`, tutto il resto invariato.
- `statoDopoCompletamento(stato)`: `da_valutare` e `in_attesa_studente` → `da_decidere`, tutto il resto invariato.

La guardia impedisce di retrocedere candidature già decise (`accolta`, `rifiutata`, `in_attesa_posto`).

## 2. generate-completion-link

- Nuovo rifiuto: se lo stato è `accolta` o `rifiutata` la generazione del link viene bloccata con errore 400 (oggi blocca solo le candidature già completate). `in_attesa_posto` resta consentito: è una lista d'attesa, non un esito, e serve poter chiedere la documentazione completa a un candidato in lista. La funzione pura lascia quello stato invariato, quindi il candidato compila il form restando in lista.
- L'update sulla candidatura include `stato: statoDopoLinkGenerato(stato)` insieme a hash e scadenza token.
- La riga manuale in `log_stato_candidature` ("Generato link form completo") viene inserita solo quando lo stato non cambia — cioè nel caso di rigenerazione del link su una candidatura già in `in_attesa_studente`. Quando lo stato cambia, la transizione la registra già il trigger `candidature_log_stato`.

## 3. complete-candidatura

- L'update include `stato: statoDopoCompletamento(cand.stato)` insieme ai campi già presenti.
- La riga manuale "Form completo inviato dallo studente" viene inserita solo se lo stato resta invariato, per evitare il duplicato con il trigger.

## 4. Azioni admin (`src/lib/candidaturaActions.ts`, `getAvailableActions`)

- Stadio `in_attesa_studente`: si aggiungono `assegna_camera` e `metti_in_attesa_posto` come azioni **secondarie**, lasciando `invia_form_completo` principale e `rifiuta` invariata. Con la macchina a stati corretta ogni candidatura con link inviato finisce qui, e oggi da questo stadio non sarebbe possibile assegnare un posto. Si allinea al comportamento di `da_valutare` con form non completo.
- Azione `elimina`: oggi disponibile solo su `archiviato`, `da_valutare`, `in_attesa_studente`. Si estende a `da_decidere` e `in_attesa_posto`, stadi di candidature non ancora decise. Le guardie reali restano `!haAvutoAssegnazione` e il controllo server in `delete-candidatura` (409 se esistono assegnazioni). `assegnato` e `in_casa` continuano a non offrire l'eliminazione.

## 5. Test

- `src/test/stato-candidatura.test.ts` — modulo condiviso delle edge function: link su `da_valutare` → `in_attesa_studente`; completamento da `in_attesa_studente` e da `da_valutare` → `da_decidere`; rigenerazione su `in_attesa_studente` invariata; completamento su `accolta` e su `in_attesa_posto` senza retrocessione.
- `src/test/candidatura-actions.test.ts` — file separato per `getAvailableActions`: `da_decidere` senza assegnazioni offre `elimina`; `in_attesa_posto` senza assegnazioni offre `elimina`; `in_casa` non la offre; `assegnato` non la offre; `da_decidere` con `haAvutoAssegnazione: true` non la offre; `in_attesa_studente` offre `assegna_camera`.

## 6. Documentazione

`docs/Context.md` viene aggiornato in ogni caso, esplicitando: il blocco della generazione del link su candidature `accolta` o `rifiutata` (con `in_attesa_posto` consentito); le azioni aggiornate dello stadio `in_attesa_studente` nella sintesi "Azioni per stadio" di §8bis; l'estensione dell'eliminazione a `da_decidere` e `in_attesa_posto`.

## Fuori perimetro

Nessuna migration, nessuna modifica a `candidature_log_stato`, `candidature_stato_check`, `v_studenti_stadio` o `src/lib/statoCandidatura.ts`. Nessun refactor aggiuntivo.

## Verifica finale

Esecuzione dei test vitest e deploy delle due edge function modificate.
