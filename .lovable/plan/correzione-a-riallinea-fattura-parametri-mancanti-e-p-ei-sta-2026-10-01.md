# Correzione a riallinea_fattura: parametri mancanti e p_ei_status nullo

Perimetro chiuso: **solo** `public.riallinea_fattura`. Nessun'altra funzione, nessun trigger, nessun file applicativo, nessuna prova che scriva sui dati.

## Stato attuale (verificato con pg_get_functiondef)

Con `p_esiste = true`, ogni confronto usa `IS DISTINCT FROM`: un parametro NULL e il campo locale valorizzato vengono considerati diversi, quindi la UPDATE sovrascrive il campo con NULL (per esempio `numero`, `data`, `totale`), e lo stesso vale per `ei_status`. Inoltre la funzione è `SECURITY DEFINER`, proprietario `postgres`, con EXECUTE solo a `postgres` e `service_role` (revocata da PUBLIC; `has_function_privilege` di anon e authenticated = false).

## Migration (una sola, DDL additivo — CREATE OR REPLACE FUNCTION)

1. Subito dopo i controlli su esistenza e stato (`fattura_inesistente`, `fattura_non_emessa`), nel ramo `p_esiste = true` (dopo il blocco `IF NOT p_esiste ... END IF;`):
   - Nuova variabile `v_mancanti text[]`.
   - Accumula in `v_mancanti` i nomi dei parametri nulli fra `p_numero`, `p_numerazione`, `p_data`, `p_imponibile`, `p_iva`, `p_totale`.
   - Se `cardinality(v_mancanti) > 0`: `RAISE EXCEPTION 'parametri_riallineamento_mancanti: parametri mancanti per l''aggiornamento: %', array_to_string(v_mancanti, ', ')`. Nessuna modifica scritta.
2. Confronto di `ei_status` solo se `p_ei_status IS NOT NULL`: un `p_ei_status` nullo significa "invariato" e non sovrascrive l'`ei_status` già registrato. La linea `IF p_ei_status IS DISTINCT FROM v_f.ei_status ...` diventa `IF p_ei_status IS NOT NULL AND p_ei_status IS DISTINCT FROM v_f.ei_status ...`.
3. Tutto il resto resta byte per byte: ramo `NOT p_esiste` (annullamento), `url_documento`, riallineata_il, controllo importo divergente con il canone, exception handler che spegne `app.riallineamento`, segnale per i trigger `fatture_protect_emesse` e `canoni_protect_fatturati`.
4. Intestazione invariata: `SECURITY DEFINER`, `SET search_path TO 'public'`.
5. Stessi privilegi della migration P5a, nel mismo ordine: `REVOKE ALL ON FUNCTION public.riallinea_fattura(...) FROM PUBLIC, anon, authenticated;` e `GRANT EXECUTE ON FUNCTION public.riallinea_fattura(...) TO service_role;`

## Verifica (sola lettura, nessuna scrittura)

- `pg_get_functiondef` della funzione aggiornata → riportato nel resoconto.
- `has_function_privilege` per anon, authenticated e service_role (deve restare: anon false, authenticated false, service_role true).
- Nessuna chiamata della funzione, nemmeno dentro una transazione annullata.
