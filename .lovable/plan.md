## Obiettivo
Stringere i limiti di upload documenti e allineare client/server.

## Modifiche

### 1. Migration DB — `consume_candidatura_upload_slot`
Ridichiarare la funzione partendo dalla definizione attuale (riletta dal file di migration esistente), cambiando **solo** il numero `12` → `4`. Restano identici:
- `SECURITY DEFINER`, `SET search_path = public`, `LANGUAGE plpgsql`
- tutte e tre le condizioni nel `WHERE`: `consumata_il IS NULL`, `created_at > now() - interval '30 minutes'`, `upload_count < N`
- singola `UPDATE ... RETURNING temp_id INTO updated_id` con esito verificato sulla riga modificata (proprietà che garantisce atomicità contro richieste simultanee)
- grant: `REVOKE ALL ... FROM PUBLIC, anon, authenticated;` e `GRANT EXECUTE ... TO service_role;`

### 2. Edge function `upload-candidatura-doc/index.ts`
- `MAX_BYTES = 5 * 1024 * 1024` (era 10).
- Rimuovere `"image/webp"` da `ALLOWED_MIME`.
- Aggiornare messaggi errore: "File troppo grande (max 5 MB)" e "Tipo file non supportato (PDF, JPG, PNG)".

### 3. Edge functions `submit-candidatura` e `complete-candidatura`
Cambiare il limite `documenti.length > 20` → `documenti.length > 4` (coerente con i 4 slot per sessione). Nessun'altra modifica alle validazioni.

### 4. Costante condivisa lato client
Nuovo `src/lib/uploads.ts`:
```ts
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_UPLOAD_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
```
Aggiornare `src/pages/Candidatura.tsx` e `src/pages/CandidaturaCompleta.tsx` rimuovendo le costanti locali `MAX_SIZE` / `ACCEPTED_TYPES` e importando da `@/lib/uploads`.

### 5. Traduzioni
`src/i18n/translations.ts` riporta già "max 5 MB" in IT/EN. Nessun'altra stringa "10 MB" presente.

## Vincoli rispettati
- Nessuna modifica a Turnstile, `open-candidatura-sessione`, schema/TTL/atomicità di `candidatura_sessioni`.
- Nessuna modifica alla validazione dei tipi documento (`DOCUMENTO_TIPI_SET`).
- Nessuna modifica ad altre policy o funzioni DB.

## File modificati/creati
- `supabase/migrations/<timestamp>_tighten_upload_slot_limit.sql` (nuovo)
- `supabase/functions/upload-candidatura-doc/index.ts`
- `supabase/functions/submit-candidatura/index.ts`
- `supabase/functions/complete-candidatura/index.ts`
- `src/lib/uploads.ts` (nuovo)
- `src/pages/Candidatura.tsx`
- `src/pages/CandidaturaCompleta.tsx`
