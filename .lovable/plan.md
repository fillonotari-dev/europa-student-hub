# P5b — Riallineamento con Fatture in Cloud

## Verifiche fatte prima del piano
- Nessun job pg_cron permanente oggi: `cron.job` è vuoto. L'unico schema esistente che invoca una edge function da pg_cron è `email_queue_wake` / `email_queue_dispatch` (net.http_post con `Authorization` letto da `vault.decrypted_secrets` dove name = 'email_queue_service_role_key'). Lo riuso.
- Vault disponibile (1 segreto presente).
- Tutte le fic-* hanno `verify_jwt = true` (supabase/config.toml:18-27); le fic-* verificano admin con `getClaims` + `has_role` (es. fic-collega-fattura/index.ts:67-76).

## 1. Modulo puro `_shared/fic-riallinea.ts`
- `STATI_SDI_DEFINITIVI` = discarded, not_delivered, accepted, rejected, no_response, manual_accepted, manual_rejected.
- `confrontaFattura(locale, remoto | null)` → `{ decisione: 'aggiorna'|'annulla'|'anomalia'|'invariata', campi: string[] }`.
  - remoto null (404): ei_status locale NULL o not_sent → annulla; altrimenti anomalia.
  - remoto presente: campi diversi fra numero, numerazione, data, imponibile, iva, totale (confronto in centesimi via `stessoImporto`), ei_status (solo se remoto non nullo), url_documento (solo se locale vuoto) → aggiorna, altrimenti invariata.
- `parametriDaRemoto(doc)` estrae i valori per la RPC.
- Test in `src/test/fic-riallinea.test.ts`: ogni decisione, 404 su fattura trasmessa (anomalia), importi a centesimi, ei_status remoto nullo.

## 2. Edge function `fic-riallinea` (solo GET su Fatture in Cloud)
- Selezione: `stato='emessa'`, `fic_document_id` non nullo, (`ei_status` non definitivo **o** `riallineata_il` nullo), `data >= oggi Roma - 90 giorni`.
- Interruttore di sicurezza (un annullamento è irreversibile):
  - All'inizio GET `/c/{company}/company/info`: se fallisce, nessuna fattura elaborata, il giro si chiude con errore esplicito (fic_log esito errore).
  - Per ciascuna: GET `/c/{company}/issued_documents/{id}`. 200 → valori; 404 → secondo GET immediato, solo un doppio 404 vale "documento inesistente"; altro → saltata, diagnostica 4xx esistente (`rispostaClient4xx`, `estraiDiagnosticaFic`).
  - Prima si raccolgono tutti gli esiti del giro, poi si scrive. Funzione pura `ammettiAnnullamenti(nInesistenti)` in `fic-riallinea.ts`: soglia 2. Se gli inesistenti sono più di 2, nessuna chiamata con p_esiste false: tutti registrati come anomalia `troppi_404` (fic_log) e mostrati nell'avviso di Fatturazione. Gli aggiornamenti dei documenti esistenti procedono normalmente.
  - Test puri con 0, 1, 2, 3 inesistenti (0-2 ammessi, 3 bloccati).
- Chiama `riallinea_fattura` con il client service_role. Eccezione della RPC → anomalia, registrata, si prosegue.
- `fic_log` con operazione 'riallinea', metodo GET: esito, decisione, nomi dei campi; nessun dato personale.
- Risposta: elenco aggiornate (campi), annullate (nome studente letto dal gestionale, solo nella risposta all'admin, mai in fic_log), anomalie (codice dell'errore).

## 3. Autenticazione (nessun accesso pubblico)
- `verify_jwt = false` per questa sola funzione: è necessario perché pg_cron non ha un JWT utente. La verifica è nel codice, ed è l'una o l'altra:
  - (a) JWT admin: `getClaims` + `has_role`, come le altre fic-*.
  - (b) intestazione `x-riallinea-secret` confrontata a tempo costante con il secret `FIC_RIALLINEA_CRON_SECRET`.
  - Altrimenti 403.
- Segreto condiviso: lo inserisci tu, con lo stesso valore, nel secret della funzione `FIC_RIALLINEA_CRON_SECRET` e in Vault con nome `fic_riallinea_cron_secret`. Il valore non finisce mai in migration, tabelle o nel comando del job.
- Job pg_cron, creato solo dopo la tua conferma (con run_sql, come lo schema email): `fic-riallinea-giornaliero`, pianificato `0 5,6 * * *` UTC; il comando esegue net.http_post solo se `extract(hour from now() at time zone 'Europe/Rome') = 7`, così parte alle 07:00 italiane con ora legale e solare (una chiamata al giorno). Intestazione letta da `vault.decrypted_secrets`.
- Prova: curl senza Authorization e senza segreto → 403; con JWT non admin → 403. Nessuna prova che scriva sui dati: il primo giro vero lo lanci tu dal pulsante o arriva dal job delle 07:00.

## 4. Interfaccia
- Archivio: pulsante "Riallinea con Fatture in Cloud" → riepilogo (aggiornate con i campi; annullate con il nome dello studente e "mensilità tornata da fatturare"; anomalie). Invalida le query di fatturazione.
- Fatturazione, sopra l'elenco del mese: avviso in evidenza se esiste almeno una fattura scartata (discarded o error: "va riemessa"), creata e non emessa da più di 3 giorni (ei_status null o not_sent e data più vecchia di 3 giorni), con importo diverso dalla mensilità, o in anomalia (ultimo esito 'anomalia' in fic_log per quella fattura).
- Riquadro informativo di Fatturazione e avviso di EmettiFatturaDialog: nuovo testo — una fattura cancellata su Fatture in Cloud prima della trasmissione viene annullata anche qui al riallineamento successivo e la mensilità torna da fatturare.

## 5. `statiFatturazione.ts`
- STATO_FATTURA: `annullata` → "Annullata" (muted).
- `etichettaSdi(ei_status, codice_destinatario)` con le regole del brief (not_sent, in attesa, consegnata, cassetto fiscale con 0000000 e spiegazione, recapito non riuscito come attenzione, XXXXXXX con "copia da inviare allo studente", scartata destructive). Il codice destinatario viene da `anagrafiche_fatturazione` del contratto.
- Colonna "Invio elettronico" dell'Archivio usa `etichettaSdi`, con riallineata_il al passaggio del mouse. Test puri per ogni combinazione.

## 6. docs/Context.md
Perimetro, riallineamento, job e orario, autenticazione, limite dei 90 giorni, regole del 404; correzione delle voci "Riconciliazione e archivio" e "Un mese per volta". Con citazione di migration e file.

## Dettagli tecnici e scostamenti dichiarati
- Nessuna migration necessaria: la RPC esiste già (0002/0003). Il job va creato con run_sql perché contiene l'URL del progetto.
- Scostamento: `verify_jwt = false` su fic-riallinea (unica fic-* così), compensato dal controllo nel codice.
- Il job viene creato solo dopo che hai inserito il segreto in entrambi i posti; finché manca, il passo (b) resta aperto e lo dichiaro.
- Per "in anomalia" nell'avviso uso l'ultimo esito in fic_log: non aggiungo colonne a fatture.
- Verifica finale: test, typecheck, build, deploy, curl 403, Playwright in sola lettura sull'Archivio (senza cliccare il pulsante).
