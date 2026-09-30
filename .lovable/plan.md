# 409 da Fatture in Cloud come rifiuto definitivo + data odierna nel fuso italiano

## Cosa cambia per l'operatore
- Una fattura rifiutata da Fatture in Cloud con un conflitto (409) passa a "errore" con un messaggio chiaro, invece di restare "in invio" e bloccare il contratto.
- La data del documento è sempre quella italiana, anche fra mezzanotte e le 2.

## 1. 409 definitivo (`fic-emetti-fattura/index.ts`, riga 381)
- `definitivo = rifiutoDefinitivoFic(doc.status)`: funzione pura (400, 409, 422) in `_shared/fic-collega.ts`, importata da lì in `fic-emetti-fattura`. `fic-client.ts` (unico modulo con I/O, `ficFetch`) non viene toccato, così i test importano solo moduli puri.
- Commento: la documentazione ufficiale (developers.fattureincloud.it/docs/basics/errors) dice che col 409 "the request has no effect"; fra le cause numero duplicato e violazione dell'ordine cronologico del sezionale. Il documento quindi non esiste: la riga passa a `errore` (riga 394-396).

## 2. Diagnostica per ogni 4xx
- Funzione pura `rispostaClient4xx(status)` (400-499) in `_shared/fic-collega.ts`, usata in tutti i punti sotto. Nessuna modifica a `estraiDiagnosticaFic` né alle regole sui dati personali (solo `error.message` / campi d'errore, `campi_inviati` solo nomi).
- Punti toccati:
  - `fic-emetti-fattura/index.ts:318` — PUT del cliente.
  - `fic-emetti-fattura/index.ts:387` — POST del documento.
  - `fic-sync-anagrafica/index.ts:231` — PUT/POST del cliente (usa la sua copia locale di `estraiDiagnosticaFic`, riga 46; l'unificazione con `fic-client.ts` resta rinviata come da commento in `fic-client.ts:6`).
  - `fic-collega-fattura/index.ts:110` — elenco documenti (modo elenca).
  - `fic-collega-fattura/index.ts:145` — rilettura del documento (modo collega): oggi non registra nessuna diagnostica, la aggiungo per i 4xx.
- `fic-registri/index.ts:115` resta su 400/422 (non richiesto).

## 3. Messaggio del 409 (`messaggioErrore`, riga 63)
- Nuovo ramo 409: «Fatture in Cloud ha rifiutato la fattura per un conflitto con i documenti esistenti (per esempio una data precedente all'ultima fattura del sezionale). Nessun documento è stato creato.» seguito, se presente, dal `error.message` del corpo (letto tramite `estraiDiagnosticaFic`).
- Questo messaggio va in `fatture.messaggio_errore`, in `fic_log.messaggio` e all'operatore.

## 4. Data odierna nel fuso Europe/Rome
- Nuova funzione pura `oggiRoma(ora: Date = new Date()): string` (YYYY-MM-DD) in `_shared/fic-fattura.ts`, con `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' })`.
- Punti trovati nelle funzioni fic-* (ricerca di `toISOString`, `new Date(`, `Date.now`): **uno solo**, `fic-emetti-fattura/index.ts:137` (`const oggi = …`), che alimenta scadenza (228), data emissione nel payload (243), riga fatture (260) e ripiego della data (442). `aggiungiGiorni` in `fic-fattura.ts:55` usa `toISOString` su date già ISO, non sull'ora corrente: resta invariata. `fic-registri`, `fic-collega-fattura`, `fic-sync-anagrafica`, `fic-test-connection` non calcolano la data odierna.

## 5. Test
- `src/test/fic-fattura.test.ts`: `oggiRoma` — 30/09 23:30 UTC → 2026-10-01; 30/09 12:00 UTC → 2026-09-30; cambio d'ora 25/10/2026: 24/10 22:30 UTC (00:30 CEST) → 2026-10-25, 25/10 23:30 UTC (00:30 CET) → 2026-10-26, 25/10 22:30 UTC (23:30 CET) → 2026-10-25.
- Nuovo test su `rifiutoDefinitivoFic`: 400/409/422 veri; 401, 403, 404, 429, 500, null falsi.
- Riporto esito della suite, typecheck, build; ridistribuisco `fic-emetti-fattura`.

## Fuori perimetro (dichiarato)
- La riga già bloccata in `in_invio` della mensilità 46cd973d… non viene toccata (nessuna modifica ai dati): va sbloccata a parte, su tua decisione.
- `fic-registri`, `fic-collega-fattura`, `fic-sync-anagrafica` mantengono la diagnostica solo su 400/422: il punto 2 lo applico a `fic-emetti-fattura`. Dimmi se vuoi estenderlo.
- Nessuna migration.
