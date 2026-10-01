# Segreto del job generato nel database + etichette SDI mancanti

## 1. Segreto senza passaggi manuali

**Migration (additiva)**
- `CREATE EXTENSION IF NOT EXISTS pgcrypto` (se non già presente) per `gen_random_bytes`.
- Genera e salva il segreto solo se non esiste già:
  `vault.create_secret(encode(gen_random_bytes(32),'hex'), 'fic_riallinea_cron_secret')` dentro un blocco `DO` con `IF NOT EXISTS (select 1 from vault.secrets where name = ...)`. Il valore non compare mai in chiaro: né nella migration, né in tabelle, log, resoconto o chat.
- Nuova funzione `public.verifica_segreto_riallinea(p_segreto text) RETURNS boolean`, SECURITY DEFINER, `SET search_path = public`: false se `p_segreto` è nullo o vuoto, altrimenti confronta col valore in `vault.decrypted_secrets`. Il confronto avviene sugli hash `digest(..., 'sha256')`, così la lunghezza non conta. `REVOKE ALL ... FROM PUBLIC, anon, authenticated`; `GRANT EXECUTE ... TO service_role`.

**fic-riallinea/index.ts** (oggi righe 19, 41-42, 79-80 leggono `FIC_RIALLINEA_CRON_SECRET` e confrontano con crypto.subtle)
- Il modo (b) legge `x-riallinea-secret` e chiama `rpc('verifica_segreto_riallinea')` con il client service_role. Se l'intestazione manca, la funzione risponde 403 senza chiamare il database; risponde 403 anche se il segreto è sbagliato o la chiamata RPC dà errore.
- Tolgo il confronto via crypto.subtle e ogni riferimento a `FIC_RIALLINEA_CRON_SECRET`, che non va creato. Aggiorno il commento in testata. Poi ridistribuisco la funzione.

**Job** (con run_sql, non migration, come lo schema email, dopo la migration)
- `cron.schedule('fic-riallinea-giornaliero', '0 5,6 * * *', ...)`: il comando chiama `net.http_post` verso fic-riallinea solo se `extract(hour from now() at time zone 'Europe/Rome') = 7`. Le intestazioni sono `Content-Type`, `apikey` (anon) e `x-riallinea-secret`, che legge il segreto con una sottoquery su `vault.decrypted_secrets` al momento dell'esecuzione. Il valore non compare nel comando del job.

**Verifiche, tutte in sola lettura, da riportare nel resoconto**
- `has_function_privilege` su verifica_segreto_riallinea per anon, authenticated e service_role.
- Chiamata con segreto sbagliato → 403. Chiamata senza intestazione → 403.
- Riga del job in `cron.job`, con lo schedule e senza il valore del segreto.
- Esistenza del segreto nel Vault: solo il nome, mai il valore.
- Non lancio nessun giro vero con il segreto giusto: il primo giro parte domani alle 07:00.

## 2. Etichette SDI mancanti (src/lib/statiFatturazione.ts, etichettaSdi)
- rejected → "Rifiutata dal destinatario: va riemessa" (errore)
- manual_rejected → "Rifiutata (esito manuale): va riemessa" (errore)
- no_response → "Emessa, nessuna risposta dal destinatario" (successo)
- manual_accepted → "Emessa e consegnata (esito manuale)" (successo)
- missing → "Stato non disponibile" (neutro)

**Avviso di Fatturazione** (AvvisiFatturazione.tsx:40 oggi considera solo discarded ed error): aggiungo rejected e manual_rejected tramite un insieme esportato `SDI_DA_RIEMETTERE` in statiFatturazione.ts.

**Test** (src/test/etichetta-sdi.test.ts)
- Sostituisco il test alla riga 43, che oggi si aspetta per rejected il valore grezzo.
- Aggiungo i cinque nuovi casi con etichetta e classi, più un test di `SDI_DA_RIEMETTERE`.

## Documentazione
- docs/Context.md, sezione "Riallineamento automatico (P5b)": il segreto viene generato nel database e la verifica passa dalla RPC; nuove etichette.
- roadmap.md: chiudo la voce del job.

## Scostamenti previsti
- In `riallinea_fattura` lo stato `missing` resta non definitivo, quindi quelle fatture continuano a essere ricontrollate a ogni giro. Non cambio quella regola.
