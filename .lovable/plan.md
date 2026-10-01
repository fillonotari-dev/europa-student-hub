# Riallineamento fatture con Fatture in Cloud (solo database)

Verificato nel database: `fatture_stato_check` = `stato IN ('in_invio','emessa','errore')`, `fatture_importi_coerenti` = `totale = imponibile + iva`. Le definizioni attuali di `fatture_protect_emesse` e `canoni_protect_fatturati` sono quelle in uso (lette dal catalogo).

## 1. Migration additiva
- `fatture_stato_check` sostituito da un CHECK che ammette `in_invio, emessa, errore, annullata` (eccezione autorizzata alla regola 6: il vincolo si allarga). Nello stesso blocco: DROP CONSTRAINT + ADD CONSTRAINT.
- Nuove colonne nullable su `fatture`: `riallineata_il timestamptz`, `annullata_il timestamptz`, `motivo_annullamento text`. Nessun dato toccato.

## 2. `public.riallinea_fattura(...) RETURNS jsonb`
- SECURITY DEFINER, `SET search_path = public`; REVOKE EXECUTE da PUBLIC, anon, authenticated; GRANT EXECUTE a service_role.
- Prima istruzione: `set_config('app.riallineamento','on',true)` (vale solo nella transazione).
- Legge la fattura `FOR UPDATE`; deve essere `emessa` (altrimenti eccezione).
- `p_esiste = false`: se `ei_status` è NULL o `not_sent` → fattura `annullata` (annullata_il = now(), motivo «Documento cancellato su Fatture in Cloud prima della trasmissione allo SDI») e mensilità collegata `fatturato → da_fatturare` con `fattura_id = NULL` nella stessa UPDATE; esito `annullata`. Altrimenti `RAISE documento_trasmesso_scomparso` senza toccare nulla.
- `p_esiste = true`: aggiorna solo i campi che differiscono fra numero, numerazione, data, imponibile, iva, totale, ei_status; `url_documento` solo se vuoto; sempre `riallineata_il = now()`. La mensilità non si tocca. Esito `aggiornata` o `invariata`, con `campi` (nomi cambiati) e `importo_divergente` = nuovo totale diverso da `canoni.totale` della mensilità collegata.

## 3. `fatture_protect_emesse` (CREATE OR REPLACE)
- Identico a oggi senza segnale.
- Con `current_setting('app.riallineamento', true) = 'on'` su riga `emessa`: ammessi numero, numerazione, data, imponibile, iva, totale, ei_status, url_documento, riallineata_il e la transizione `emessa → annullata` (con annullata_il, motivo_annullamento). Sempre vietati: DELETE, modifica di fic_document_id e contratto_id, altre transizioni.
- Nuovo: riga `annullata` immutabile e non cancellabile per chiunque, segnale o no.

## 4. `canoni_protect_fatturati` (CREATE OR REPLACE)
- Identico a oggi senza segnale. Con segnale: ammessa solo `fatturato → da_fatturare` con `fattura_id` portato a NULL nella stessa UPDATE e nessun altro campo protetto cambiato. Nient'altro.

## 5. Verifica (nessuna scrittura sui dati)
- Resoconto con `pg_get_functiondef` delle tre funzioni e `has_function_privilege` su riallinea_fattura per anon, authenticated, service_role.
- Lettura del codice, già fatta: la guardia doppioni di fic-emetti-fattura legge solo `stato IN ('in_invio','emessa')` (`fic-emetti-fattura/index.ts:162`), quindi ignora le annullate. Il modo «elenca» di fic-collega-fattura esclude ogni `fic_document_id` già registrato, qualunque sia lo stato (`fic-collega-fattura/index.ts:130`): anche le annullate restano escluse, il che è corretto perché quel documento su FIC non esiste più.
- docs/Context.md e roadmap.md aggiornati.

## Fuori perimetro (dichiarato)
- Nessuna edge function che chiama `riallinea_fattura`: il sincronizzatore è un intervento successivo.
- `src/lib/statiFatturazione.ts` non ha ancora l'etichetta per `annullata`: l'Archivio mostrerebbe il valore grezzo. Non la aggiungo se non me lo chiedi.
- Nessun riallineamento eseguito su 7/S e 8/S.
