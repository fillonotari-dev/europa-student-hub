## Obiettivo

Aggiungere protezione anti-abuso al perimetro pubblico tramite una **sessione di invio autorizzata** (`candidatura_sessioni`), aperta da Turnstile per il form pubblico e dal token di completamento per il form su invito. Il tetto è per sessione, non per IP.

## 1. Database — nuova tabella `candidatura_sessioni`

Migrazione con:

- `temp_id uuid primary key`
- `origine text not null check (origine in ('pubblica','completamento'))`
- `created_at timestamptz not null default now()`
- `upload_count integer not null default 0`
- `consumata_il timestamptz`
- `GRANT ALL ON public.candidatura_sessioni TO service_role;` (nessun grant a `anon`/`authenticated`)
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` senza policy — solo edge function via service_role.

## 2. Nuova edge function `open-candidatura-sessione`

Input JSON: `{ temp_id, turnstile_token? , completamento_token? }`.

Comportamento:
- Valida `temp_id` come UUID; rifiuta se una riga con quel `temp_id` esiste già.
- **Se non è presente né `turnstile_token` né `completamento_token`: rifiuta con 400** (mai creare sessione senza autorizzazione).
- Se `turnstile_token`: POST a `https://challenges.cloudflare.com/turnstile/v0/siteverify` con `secret=TURNSTILE_SECRET_KEY` e `response=turnstile_token`. Se `success !== true`, 400. Inserisce sessione con `origine='pubblica'`.
- Se `completamento_token`: SHA-256 del token, lookup su `candidature.completamento_token_hash`, applica gli stessi controlli di `get-completion-form` (esiste, non completata, non scaduta). Inserisce sessione con `origine='completamento'`.
- Config: `verify_jwt = false` in `supabase/config.toml`.
- CORS standard, messaggi d'errore generici.

## 3. Aggiornamento `upload-candidatura-doc`

Prima dei controlli MIME/dimensione, un'unica istruzione atomica:

```sql
UPDATE candidatura_sessioni
SET upload_count = upload_count + 1
WHERE temp_id = $1
  AND consumata_il IS NULL
  AND created_at > now() - interval '30 minutes'
  AND upload_count < 12
RETURNING temp_id
```

Se non ritorna righe, rifiuta con 400. Tutti i controlli esistenti (10 MB, MIME whitelist, path) restano invariati.

## 4. Aggiornamento `submit-candidatura` e `complete-candidatura`

Entrambe:
- Ricevono `temp_id` nel payload (validato UUID). Frontend deve inviarlo.
- Validano la sessione: esiste, `consumata_il IS NULL`, `created_at` entro 30 min. Rifiutano altrimenti.
- **Controllo prefisso documenti**: per ogni doc del payload — che ha forma `{ tipo, nome_file, url }` — verificare che il campo **`url`** inizi con `pending/{temp_id}/`. Se anche uno solo non corrisponde: 400. Il controllo `STORAGE_PATH_RE` esistente resta.
- Al termine del success path, `UPDATE candidatura_sessioni SET consumata_il = now() WHERE temp_id = $1`.
- In caso di errore business, la sessione resta aperta per permettere retry entro tempo/count.

## 5. Frontend — `src/pages/Candidatura.tsx` (form pubblico)

**Caricamento script Turnstile**: effect one-shot al mount che aggiunge `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer>` se non già presente.

**Ciclo di vita del widget**: effect legato allo step corrente. Quando `stepKey === 'stepDichiarazioni'`:
- Attende `window.turnstile`, poi `render(container, { sitekey: '0x4AAAAAAD-aYq1jX5cywwnC', callback: setTurnstileToken, 'expired-callback': () => setTurnstileToken(''), 'error-callback': () => setTurnstileToken('') })`.
- Conserva l'`id` restituito in una ref.
- **Cleanup**: `window.turnstile.remove(id)` — no duplicazioni tra navigazioni.

**Guardia Turnstile**:
- In `handleSubmit`, **primo controllo prima di generare `temp_id`**: se `!turnstileToken`, toast IT/EN e ritorna. (stepDichiarazioni è l'ultimo step, `validateStep` non viene chiamata dal pulsante finale.)
- In `validateStep()` mantenere anche il check ridondante per `stepDichiarazioni`.

**handleSubmit — reset del widget su qualunque fallimento**:

```text
try {
  guardia Turnstile
  genera temp_id
  open-candidatura-sessione({ temp_id, turnstile_token })
  upload documenti
  submit-candidatura({ ..., temp_id })
  success
} catch (err) {
  window.turnstile.reset(id)
  setTurnstileToken('')
  toast IT/EN con messaggio esplicito:
    "I dati inseriti sono conservati. Completa nuovamente la verifica di sicurezza e ripeti l'invio."
    "Your data is preserved. Please complete the security check again and resubmit."
}
```

I token Turnstile sono monouso: `siteverify` li invalida. Un errore *dopo* l'apertura della sessione lascerebbe l'utente con token consumato in stato — senza reset il retry successivo fallirebbe già all'apertura sessione. Il reset + messaggio esplicito garantiscono retry senza ricompilare.

Il form **non** viene azzerato in nessun percorso di errore. `temp_id` viene rigenerato ad ogni tentativo (la sessione precedente resta orfana entro i 30 min e non blocca nulla).

## 6. Frontend — `src/pages/CandidaturaCompleta.tsx` (form su invito)

- Nessun Turnstile.
- In `handleSubmit`, try/catch attorno al flusso. Dopo aver generato `temp_id`: `open-candidatura-sessione` con `{ temp_id, completamento_token }`. Se qualunque step fallisce: toast IT/EN che invita a riprovare, form conservato, `temp_id` rigenerato al retry. Poi upload e `complete-candidatura` con `temp_id`.

## 7. Traduzioni

Aggiungere in `src/i18n/translations.ts`:
- Errore Turnstile mancante (IT/EN).
- Errore generico con "dati conservati, ripeti l'invio" (IT/EN) — usato in tutti i percorsi di fallimento post-guardia.

## Dettagli tecnici

- Secret `TURNSTILE_SECRET_KEY` già presente.
- Site key Turnstile costante nel codice (pubblica per design).
- Tabella `candidatura_sessioni`: nessun trigger, nessuna FK verso `candidature`.
- Fuori scope: rate limiting per IP, cleanup schedulata sessioni.

## File toccati

```text
supabase/migrations/<new>.sql
supabase/config.toml
supabase/functions/open-candidatura-sessione/index.ts
supabase/functions/upload-candidatura-doc/index.ts
supabase/functions/submit-candidatura/index.ts
supabase/functions/complete-candidatura/index.ts
src/pages/Candidatura.tsx
src/pages/CandidaturaCompleta.tsx
src/i18n/translations.ts
```
