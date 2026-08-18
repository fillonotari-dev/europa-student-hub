# Macchina a stati candidature: transizioni mancanti

Oggi il link di completamento e l'invio del form completo non scrivono mai `stato`: una candidatura resta in `da_valutare` per tutto il percorso. Correzione solo a livello di codice, nessuna migration, nessun dato toccato.

## 1. Nuovo modulo condiviso

`supabase/functions/_shared/stato-candidatura.ts` — due funzioni pure, nessun import, nessuna API Deno, nessun accesso al database:

- `statoDopoLinkGenerato(stato)`: `da_valutare` → `in_attesa_studente`, tutto il resto invariato.
- `statoDopoCompletamento(stato)`: `da_valutare` e `in_attesa_studente` → `da_decidere`, tutto il resto invariato.

La guardia impedisce di retrocedere candidature già decise (`accolta`, `rifiutata`, `in_attesa_posto`).

## 2. generate-completion-link

- Nuovo rifiuto: se lo stato è `accolta`, `rifiutata` o `in_attesa_posto` la generazione del link viene bloccata con errore 400 (oggi blocca solo le candidature già completate).
- L'update sulla candidatura include `stato: statoDopoLinkGenerato(stato)` insieme a hash e scadenza token.
- La riga manuale in `log_stato_candidature` ("Generato link form completo") viene inserita solo quando lo stato non cambia — cioè nel caso di rigenerazione del link su una candidatura già in `in_attesa_studente`. Quando lo stato cambia, la transizione la registra già il trigger `candidature_log_stato`.

## 3. complete-candidatura

- L'update include `stato: statoDopoCompletamento(cand.stato)` insieme ai campi già presenti.
- La riga manuale "Form completo inviato dallo studente" viene inserita solo se lo stato resta invariato, per evitare il duplicato con il trigger.

## 4. Test

`src/test/stato-candidatura.test.ts` (vitest, già configurato) importa il modulo condiviso e verifica i sei casi: link su `da_valutare` → `in_attesa_studente`; completamento da `in_attesa_studente` e da `da_valutare` → `da_decidere`; rigenerazione su `in_attesa_studente` invariata; completamento su `accolta` e su `in_attesa_posto` senza retrocessione.

## 5. Documentazione

`docs/Context.md` §3 descrive già il comportamento corretto (`da_valutare` → `in_attesa_studente` → `da_decidere`): verrà aggiornato solo se dopo la correzione risulta una divergenza, con l'eventuale nota sul blocco della rigenerazione del link su candidature decise.

## Fuori perimetro

Nessuna migration, nessuna modifica a `candidature_log_stato`, `candidature_stato_check`, `v_studenti_stadio` o `src/lib/statoCandidatura.ts`. Nessun refactor aggiuntivo.

## Verifica finale

Esecuzione dei test vitest e deploy delle due edge function modificate.
