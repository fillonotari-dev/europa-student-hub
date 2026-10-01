# Bug v_campi in riallinea_fattura + messaggio RPC in fic_log

## Contesto verificato
In `riallinea_fattura` le otto aggiunte a `v_campi` usano `v_campi || 'numero'` (migration `0003_riallinea_fattura_parametri_mancanti.sql`, righe 60-69): il letterale viene interpretato come array e ogni campo diverso solleva «malformed array literal». Le fatture invariate passano perché non aggiungono nulla. In `fic-riallinea/index.ts:227` il fallimento della RPC registra solo il codice (`codiceErroreRpc`), non il messaggio.

## Interventi

### 1. Migration: CREATE OR REPLACE di riallinea_fattura
- Le otto aggiunte riscritte come `v_campi := array_append(v_campi, 'numero'::text)` (e così per `numerazione`, `data`, `imponibile`, `iva`, `totale`, `ei_status`, `url_documento`).
- Nient'altro cambia: stessa logica, stessa intestazione, stessi privilegi (SECURITY DEFINER, SET search_path = public, EXECUTE solo a service_role), segnale `app.riallineamento` acceso/spento come oggi.
- Nessun dato modificato, nessuna chiamata della funzione.

### 2. fic-riallinea: messaggio RPC nel log
Quando la RPC `riallinea_fattura` fallisce (riga 227), `payload_ridotto` dell'anomalia include anche `messaggio_rpc`: `error.message` troncato a 300 caratteri, oltre al `codice` già presente.

## Verifiche (nessuna scrittura sui dati)
- `pg_get_functiondef` di `riallinea_fattura` dopo la migration, riportato nel resoconto.
- `has_function_privilege` per anon / authenticated / service_role (atteso: false, false, true).
- Test, typecheck, build. Deploy di fic-riallinea.
- Nessuna prova nel browser che apra Fatturazione (avvierebbe un giro vero).

## Resoconto
Nuovo pg_get_functiondef, esito privilegi, test/typecheck/build, scostamenti dichiarati.
