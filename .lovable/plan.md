## Obiettivo

Attivare le tre email previste dal preventivo — **conferma ricezione**, **link form completo**, **esito valutazione** — riusando l'infrastruttura email già in produzione per le auth email (coda `transactional_emails`, RPC `enqueue_email`, log su `email_send_log`, mittente `updates.app.studentatoeuropa.it`).

Conferma ricezione e link completamento partono automaticamente. L'esito è sempre a conferma manuale dell'admin, con nota libera opzionale accodata al template.

## Modifiche

### 1. Migration DB

Su `candidature`:

- `lingua` text ('it' | 'en'), default 'it' — usato per scegliere template IT/EN.
- `esito_email_stato` text ('da_inviare' | 'inviata' | null), default null.
- `esito_email_nota` text nullable.
- `esito_email_inviata_il` timestamptz nullable.

Nuovo trigger `candidature_flag_esito_email` AFTER UPDATE OF `stato`:

- Se `NEW.stato IN ('approvata','rifiutata')` e diverso da `OLD.stato`, setta `esito_email_stato = 'da_inviare'` e azzera nota + timestamp precedenti.
- Idempotente sulle ri-decisioni: sovrascrive, non somma.

### 2. Template email (React Email in `supabase/functions/_shared/email-templates/`)

Un componente per template, con prop `lang: 'it' | 'en'` che seleziona i testi (stesso stile dei template auth già presenti — navy #003b6b, Plus Jakarta Sans):

- `candidatura-ricevuta.tsx`
- `candidatura-link-completamento.tsx`
- `candidatura-esito-approvata.tsx`
- `candidatura-esito-rifiutata.tsx`

Ognuno accetta anche `notaAdmin?: string` (usato solo dai template esito, mostrato in blocco separato dopo il testo standard).

### 3. Form pubblico (`src/pages/Candidatura.tsx` + `submit-candidatura`)

- Il form gestisce già la lingua lato client: passarla nel payload della submit.
- `submit-candidatura` valida `lingua` (whitelist `it`/`en`), la salva su `candidature.lingua`, e dopo l'insert riuscito di candidatura + documenti fa render del template `candidatura-ricevuta` nella lingua giusta e accoda su `transactional_emails` con lo stesso pattern di `auth-email-hook` (log pending → `enqueue_email` con `message_id` univoco). Fallimento email non deve rollbackare la candidatura: viene solo loggato.

### 4. Link form completo (`generate-completion-link`)

- Estendere la query esistente per recuperare anche `studenti(email, nome, cognome)` e `candidature.lingua`.
- Dopo l'update del token, render del template `candidatura-link-completamento` con URL `${origin}/candidatura/completa/${token}` e accodare l'email (stesso pattern).
- Il pulsante "Apri client email" nel frontend admin resta come fallback.

### 5. Esito — nuova edge function `send-esito-email`

Stesso schema di verifica admin di `generate-completion-link` (Authorization Bearer → `auth.getUser` → RPC `has_role('admin')`).

Input: `{ candidatura_id: uuid, nota?: string (<=2000 char) }`.

Comportamento:

1. Legge candidatura + studente + lingua; verifica `esito_email_stato = 'da_inviare'` e `stato IN ('approvata','rifiutata')`.
2. Sceglie template `candidatura-esito-approvata` o `candidatura-esito-rifiutata` in base a `stato`, lingua in base a `candidature.lingua`, passa `notaAdmin` se presente.
3. Log pending + `enqueue_email` su `transactional_emails`.
4. Update `candidature`: `esito_email_stato='inviata'`, `esito_email_nota=<nota>`, `esito_email_inviata_il=now()`.
5. Riga in `log_stato_candidature` con `note` = "Comunicazione esito inviata" (+ prime N char della nota).

### 6. UI admin

- **Dashboard** (`src/pages/admin/Dashboard.tsx`): nuovo item nella sezione "Task" — "Esiti da comunicare" con count di candidature `esito_email_stato = 'da_inviare'`, click → `/admin/candidature?esito_da_inviare=1`.
- **Candidature** (`src/pages/admin/Candidature.tsx`):
  - Nuova azione di riga "Invia comunicazione esito" visibile solo quando `esito_email_stato = 'da_inviare'`.
  - Apre un dialog (pattern identico alla nota di manutenzione in `Camere.tsx`) con textarea nota opzionale + preview del template scelto (approvata/rifiutata) + tasto Conferma → chiama `send-esito-email`.
  - Nel dettaglio candidatura: badge "Esito da comunicare" / "Esito inviato il …" + nota visibile se presente.
  - Filtro rapido via query param `esito_da_inviare=1`.

### 7. Idempotency

Stesso schema `auth-email-hook`: `message_id = crypto.randomUUID()` generato prima dell'enqueue, insert `email_send_log` con `status='pending'` prima di `enqueue_email`. Nessuna doppia coda per lo stesso evento: la conferma ricezione è legata a un singolo insert candidatura, il link completamento a una singola generazione token, l'esito è protetto dal check `esito_email_stato='da_inviare'` che viene subito flippato.

## Note tecniche

- Nessuna migration sull'infrastruttura email: già presente.
- Il trigger esito scatta anche sulle ri-decisioni (approvata → in_valutazione → rifiutata): sovrascrive `esito_email_stato`, azzera nota/timestamp precedenti — comportamento voluto.
- Fallback per candidature esistenti prima della migration: `lingua` default 'it', `esito_email_stato` null (non appariranno come "da comunicare" retroattivamente).
- Deploy delle edge function modificate/nuove: `submit-candidatura`, `generate-completion-link`, `send-esito-email`.