# 409 da Fatture in Cloud come rifiuto definitivo + data odierna nel fuso italiano

## Cosa cambia per l'operatore
- Una fattura rifiutata da Fatture in Cloud con un conflitto (409) passa a "errore" con un messaggio chiaro, invece di restare "in invio" e bloccare il contratto.
- La data del documento è sempre quella italiana, anche fra mezzanotte e le 2.

## 1. 409 definitivo (`fic-emetti-fattura/index.ts`, riga 381)
- `definitivo = status === 400 || 409 || 422`, estratto in una funzione pura `rifiutoDefinitivoFic(status)` in `_shared/fic-client.ts` (testabile).
- Commento: la documentazione ufficiale (developers.fattureincloud.it/docs/basics/errors) dice che col 409 "the request has no effect"; fra le cause numero duplicato e violazione dell'ordine cronologico del sezionale. Il documento quindi non esiste: la riga passa a `errore` (riga 394-396).

## 2. Diagnostica per ogni 4xx
- In `fic-emetti-fattura`, sia nel PUT del cliente (riga 318) sia nel POST del documento (riga 387): `estraiDiagnosticaFic` si registra quando `status >= 400 && status < 500`. Stessa funzione, stesse regole sui dati personali (nessuna modifica a `estraiDiagnosticaFic`).
- `campi_inviati` resta com'è oggi (solo nomi).

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
