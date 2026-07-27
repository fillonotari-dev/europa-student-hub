## Obiettivo

I documenti delle candidature completate con successo devono essere spostati dalla cartella temporanea `pending/{temp_id}/…` a una posizione definitiva legata alla candidatura: `candidature/{candidatura_id}/{tipo}/{nome_file}` nello stesso bucket privato `documenti_studenti`. Così la cartella `pending` conterrà solo file abbandonati, che potranno essere ripuliti in sicurezza.

## Cosa NON cambia

- Il flusso di upload (`upload-candidatura-doc`) continua a scrivere in `pending/{temp_id}/{tipo}/{nome_file}`, perché all'atto del caricamento la candidatura non esiste ancora.
- La regex `STORAGE_PATH_RE` (`pending/...`) usata per validare l'input dal client in `submit-candidatura` e `complete-candidatura` resta invariata: è un contratto sull'input.
- `_shared/documenti-tipi.ts` (inclusa `extractTipoFromPath` che parla di `pending/...`) resta invariata.
- Sessione di candidatura, token, Turnstile, RLS e policy di storage non vengono toccati. Nessun nuovo bucket, nessuna policy di lettura pubblica.
- La pagina admin `src/pages/admin/Candidature.tsx` — funzione `extractStoragePath` — è già compatibile con `candidature/...` e `pending/...`. Lasciata così finché non elimineremo i vecchi path.

## Cosa cambia

### 1. Helper condiviso `supabase/functions/_shared/move-documenti.ts` (nuovo)

Funzione `moveDocumentToFinal(supabase, { tempPath, candidaturaId, tipo })`:

- Estrae `filename` come **ultimo segmento di `tempPath`** (già sanificato lato server all'upload). Nessun fallback su `nome_file`.
- Calcola `finalPath = candidature/{candidaturaId}/{tipo}/{filename}`.
- Se `tempPath === finalPath`, ritorna `{ path: finalPath, moved: true }` (idempotenza).
- Chiama `supabase.storage.from('documenti_studenti').move(tempPath, finalPath)`.
- Successo → `{ path: finalPath, moved: true }`.
- Errore → `console.error` con dettagli e `{ path: tempPath, moved: false, error }`; il chiamante userà il path originale.

### 2. `supabase/functions/submit-candidatura/index.ts`

Dopo la `INSERT` in `candidature` e prima del loop di `INSERT` in `documenti`, per ogni elemento in `docsIn` chiamare `moveDocumentToFinal`. Registrare nella tabella il path restituito. Nessun errore restituito al client.

### 3. `supabase/functions/complete-candidatura/index.ts`

Stessa logica: dopo aver aggiornato la candidatura e prima di inserire i `documenti`, spostare i file con `moveDocumentToFinal(cand.id, …)` e persistere il path risultante.

### 4. Migrazione una tantum: edge function `migrate-pending-docs`

Nuova funzione `supabase/functions/migrate-pending-docs/index.ts`. In testa al file, commento chiaro:

```
// TEMPORANEA — utility di migrazione one-shot da eliminare dopo
// che tutti i path 'pending/...' nella tabella documenti sono stati
// spostati a 'candidature/...'. Non fa parte del sistema runtime.
```

Comportamento:

- `verify_jwt = true` e verifica in codice che il chiamante abbia ruolo `admin` via `has_role`.
- Idempotente e ripetibile: opera solo su righe `documenti` con `url LIKE 'pending/%'` e `candidatura_id NOT NULL`.
- Supporta `?dry_run=true` per contare senza spostare, e `?limit=N` (default 500) per paginare.
- Per ogni riga:
  1. Estrae `filename` come **ultimo segmento di `url`** (nessun fallback su `nome_file`).
  2. Calcola `finalPath = candidature/{candidatura_id}/{tipo}/{filename}`.
  3. Verifica esistenza del file d'origine con `storage.list` sul prefisso della cartella.
  4. Se non esiste → salta, `skipped_missing++`, riga invariata.
  5. Altrimenti `storage.move`. Se fallisce per conflitto di destinazione → `skipped_conflict++`.
  6. Solo dopo `move` riuscita, `UPDATE documenti SET url = finalPath WHERE id = ...`.
- Ritorna JSON: `{ scanned, moved, skipped_missing, skipped_conflict, failed, errors: [...] }`.
- Nessuna scrittura diretta alle tabelle interne dello storage.

### 5. Come si lancia la migrazione

Occorre un access token admin valido:

1. Nel browser, autenticati nell'area admin dell'app.
2. Apri DevTools → Application → Local Storage → l'origin del sito.
3. Trova la chiave che **inizia con `sb-`** e **termina con `-auth-token`**.
4. Il valore è JSON: copia il campo `access_token`.
5. Il token ha validità limitata: se scade fra un batch e l'altro, rigenerarlo ripetendo i passi (basta ricaricare l'area admin).

Poi:

```bash
# dry run
curl -X POST "https://<project>.supabase.co/functions/v1/migrate-pending-docs?dry_run=true" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"

# esecuzione reale (ripetibile finché ritorna moved > 0)
curl -X POST "https://<project>.supabase.co/functions/v1/migrate-pending-docs" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

Il resoconto JSON indica se serve un'altra esecuzione.

Al termine, dopo aver verificato che non restino righe con `url LIKE 'pending/%'`, l'intera cartella `supabase/functions/migrate-pending-docs/` va eliminata.

## File toccati

- `supabase/functions/_shared/move-documenti.ts` — nuovo helper.
- `supabase/functions/submit-candidatura/index.ts` — sposta file dopo insert candidatura.
- `supabase/functions/complete-candidatura/index.ts` — sposta file dopo update candidatura.
- `supabase/functions/migrate-pending-docs/index.ts` — nuova funzione admin-only, **temporanea**.
- `supabase/config.toml` — registra la nuova funzione temporanea.

Nessuna modifica a `upload-candidatura-doc`, `_shared/documenti-tipi.ts`, `src/pages/admin/Candidature.tsx`, o al DB.

## Note tecniche

- `storage.move` mantiene metadata senza rileggere il contenuto.
- Ordine (move → insert del path) garantisce coerenza: se `move` fallisce, in tabella resta il path `pending` reale, che il codice admin sa già leggere.
- Idempotente: rieseguirla dopo un run completo scansiona 0 righe.
