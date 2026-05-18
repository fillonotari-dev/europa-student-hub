## Problema

Il bucket `documenti_studenti` è **già privato** (`public: false`), ma:

1. Il form pubblico chiama `getPublicUrl()` e salva quell'URL in `documenti.url`. Se per errore il bucket venisse messo "public" in futuro, tutti i documenti diventerebbero accessibili a chiunque conosca l'URL. È fragile.
2. La policy di INSERT per `anon` è troppo permissiva: chiunque su internet può caricare qualsiasi file (di qualsiasi peso/tipo) in qualsiasi path del bucket. È un vettore di abuso (storage flooding, upload di file arbitrari).

Lato admin va già bene: usa `createSignedUrl()` con scadenza 60s.

## Soluzione

Spostare l'upload dei documenti **dentro una edge function** che gira con la `service_role` e fa da gatekeeper. Il browser non parla più direttamente con Storage: invia il file alla function, che valida (tipo MIME, dimensione, chiave documento), salva sotto un path controllato e ritorna il path al client. Poi `submit-candidatura` salva quel path in `documenti.url`. Gli admin continuano a generare signed URL on-demand.

Vantaggi:
- Eliminiamo del tutto la policy INSERT per `anon` su Storage → la finding "Unrestricted Storage Upload" è risolta.
- Nessun `getPublicUrl()` viene più chiamato → la finding "Public Bucket" è risolta anche nel caso peggiore (bucket toggle umano).
- Validazione server-side reale (tipo file, dimensione max, chiave documento valida — solo `documento_identita`, `certificato_iscrizione` o una chiave presente in `form_documenti_custom` attiva).

## Piano

### 1. Nuova edge function `upload-candidatura-doc`

`supabase/functions/upload-candidatura-doc/index.ts`

- Accetta `multipart/form-data` con `file`, `tipo` (chiave documento), `temp_id` (UUID generato dal client per raggruppare i file della stessa candidatura).
- Validazione:
  - `temp_id` deve essere un UUID valido.
  - `tipo` ∈ {`documento_identita`, `certificato_iscrizione`} oppure presente in `form_documenti_custom` con `attivo = true`.
  - `file.size` ≤ 10 MB.
  - `file.type` ∈ {`application/pdf`, `image/jpeg`, `image/png`, `image/webp`}.
- Salva con la `service_role` su path `pending/{temp_id}/{tipo}/{nome_file_sanificato}`.
- Ritorna `{ path, nome_file }`.
- CORS aperto (form pubblico). Nessun JWT richiesto (`verify_jwt = false`).

### 2. `src/pages/Candidatura.tsx`

- Rimuovere le due chiamate a `supabase.storage.from(...).upload()` + `getPublicUrl()`.
- Sostituirle con `fetch` (o `supabase.functions.invoke` con `FormData`) verso `upload-candidatura-doc`.
- `uploadedDocs` ora contiene `{ tipo, nome_file, url: path }` — `url` diventa il **path interno** al bucket, non più un URL.

### 3. `src/pages/admin/Candidature.tsx`

- `extractStoragePath()` viene semplificato (o reso retro-compatibile): se `doc.url` non contiene `/documenti_studenti/`, lo trattiamo già come path. Manteniamo la compat per i record storici.
- Nessun'altra modifica: `createSignedUrl(path, 60)` continua a funzionare.

### 4. Migration: stringere le RLS di Storage

```sql
DROP POLICY "Public upload documenti" ON storage.objects;
DROP POLICY "Auth upload documenti" ON storage.objects;
```

Nessuna policy INSERT resta per `anon`/`authenticated`: solo la `service_role` (bypassa RLS) potrà scrivere, ed è esattamente quello che fa la nuova edge function. Le policy SELECT/DELETE admin restano invariate.

### 5. (Opzionale, consigliato) Backfill dati storici

Per le candidature già esistenti, `documenti.url` contiene URL pubblici come `https://…/object/public/documenti_studenti/<path>`. La funzione `extractStoragePath` li gestisce già, quindi gli admin riescono comunque ad aprirli via signed URL. Nessuna migration dati richiesta.

### File toccati

```text
NEW  supabase/functions/upload-candidatura-doc/index.ts
NEW  migration: drop delle 2 policy INSERT anon/auth su storage.objects
EDIT src/pages/Candidatura.tsx                 (upload via edge function, salva path)
EDIT src/pages/admin/Candidature.tsx           (extractStoragePath retro-compat con path puro)
```

### Cosa NON cambia

- Bucket resta privato (già lo è).
- Flusso UX per lo studente identico: stessa progress bar di upload, stessi messaggi di errore.
- Vista admin identica: stesso bottone "apri/scarica" con signed URL 60s.
