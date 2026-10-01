# Riallineamento fatture con Fatture in Cloud (solo database)

Verificato nel database: `fatture_stato_check` = `stato IN ('in_invio','emessa','errore')`, `fatture_importi_coerenti` = `totale = imponibile + iva`. Le definizioni attuali di `fatture_protect_emesse` e `canoni_protect_fatturati` sono quelle in uso (lette dal catalogo).

## 1. Migration additiva
- `fatture_stato_check` sostituito da un CHECK che ammette `in_invio, emessa, errore, annullata` (eccezione autorizzata alla regola 6: il vincolo si allarga). Nello stesso blocco: DROP CONSTRAINT + ADD CONSTRAINT.
- Nuove colonne nullable su `fatture`: `riallineata_il timestamptz`, `annullata_il timestamptz`, `motivo_annullamento text`. Nessun dato toccato.

## 2. `public.riallinea_fattura(...) RETURNS jsonb`
- SECURITY DEFINER, `SET search_path = public`; REVOKE EXECUTE da PUBLIC, anon, authenticated; GRANT EXECUTE a service_role. Il proprietario della funzione viene dichiarato nel resoconto.
- Prima istruzione: `set_config('app.riallineamento','on',true)`; prima di ogni RETURN `set_config('app.riallineamento','off',true)`.
- Legge la fattura `FOR UPDATE`; deve essere `emessa` (altrimenti eccezione).
- `p_esiste = false`:
  - `ei_status` non NULL e diverso da `not_sent` → `RAISE documento_trasmesso_scomparso`, nulla toccato;
  - una qualunque mensilità collegata in stato diverso da `fatturato` (es. `incassato`) → `RAISE mensilita_non_fatturata_documento_scomparso`, nulla toccato;
  - altrimenti fattura `annullata` (annullata_il = now(), motivo «Documento cancellato su Fatture in Cloud prima della trasmissione allo SDI») e TUTTE le mensilità collegate `fatturato → da_fatturare` con `fattura_id = NULL` nella stessa UPDATE; esito `annullata`, con l'elenco delle mensilità riportate, oppure `mensilita: null` se non ce n'erano.
- `p_esiste = true`: aggiorna solo i campi che differiscono fra numero, numerazione, data, imponibile, iva, totale, ei_status; `url_documento` solo se vuoto; sempre `riallineata_il = now()`. Le mensilità non si toccano. Esito `aggiornata` o `invariata`, con `campi` (nomi cambiati) e `importo_divergente` = nuovo totale diverso da `canoni.totale` della mensilità collegata.

## 3. `fatture_protect_emesse` (CREATE OR REPLACE)
- Segnale valido solo se `current_setting('app.riallineamento', true) = 'on'` E `current_user NOT IN ('anon','authenticated')`.
- Identico a oggi senza segnale valido.
- Con segnale valido su riga `emessa`: ammessi numero, numerazione, data, imponibile, iva, totale, ei_status, url_documento, riallineata_il e la transizione `emessa → annullata` (con annullata_il, motivo_annullamento). Sempre vietati: DELETE, modifica di fic_document_id e contratto_id, altre transizioni.
- `annullata` raggiungibile SOLO da `emessa` e SOLO con segnale valido: ogni passaggio ad annullata da `in_invio` o `errore`, o senza segnale, è rifiutato. Vale anche per un INSERT diretto in stato annullata (trigger esteso a INSERT per questo solo controllo).
- Riga `annullata` immutabile e non cancellabile per chiunque.

## 4. `canoni_protect_fatturati` (CREATE OR REPLACE)
- Stessa definizione di segnale valido. Senza: identico a oggi. Con: ammessa solo `fatturato → da_fatturare` con `fattura_id` portato a NULL nella stessa UPDATE e nessun altro campo protetto cambiato.

## 5. Verifica (nessuna scrittura sui dati, nemmeno in transazione annullata)
- Resoconto con `pg_get_functiondef` delle tre funzioni, `has_function_privilege` su riallinea_fattura per anon, authenticated, service_role, definizione aggiornata di `fatture_stato_check`, proprietario della funzione.
- Codice, già letto: la guardia doppioni di fic-emetti-fattura legge solo `stato IN ('in_invio','emessa')` (`fic-emetti-fattura/index.ts:162`), quindi ignora le annullate. Il modo «elenca» di fic-collega-fattura esclude ogni `fic_document_id` già registrato, qualunque sia lo stato (`fic-collega-fattura/index.ts:130`): le annullate restano escluse, corretto perché quel documento su FIC non esiste più.
- docs/Context.md e roadmap.md aggiornati.

## Fuori perimetro (dichiarato)
- Nessuna edge function che chiama `riallinea_fattura`: il sincronizzatore è un intervento successivo.
- Etichetta «Annullata» in statiFatturazione.ts: arriva con l'intervento successivo.
- Nessun riallineamento eseguito su 7/S e 8/S.
