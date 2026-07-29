## Obiettivo

Portare le email applicative del progetto sul sistema standard di Lovable ("app emails") così che i template compaiano e siano ispezionabili in **Cloud → Emails → App emails**, senza cambiare comportamento funzionale.

## Perché oggi non le vede

Il pannello "App emails" elenca solo i template registrati nel registry standard `supabase/functions/_shared/transactional-email-templates/registry.ts` e inviati via `send-transactional-email`. I nostri template stanno in `_shared/email-templates/` e vengono inviati con `enqueueTransactional` custom → non compaiono.

## Cosa faccio

### 1. Scaffold del sistema standard
Chiamo `email_domain--scaffold_transactional_email`. Crea:
- `supabase/functions/send-transactional-email/` (funzione di invio ufficiale, integrata col pannello)
- `supabase/functions/handle-email-unsubscribe/`
- `supabase/functions/handle-email-suppression/`
- `supabase/functions/_shared/transactional-email-templates/registry.ts`
- template di esempio (che rimuovo subito)

### 2. Migrazione dei nostri 6 template candidato/admin
Sposto e adatto sotto `_shared/transactional-email-templates/`:
- `candidatura-ricevuta`
- `candidatura-link-completamento`
- `candidatura-esito-approvata`
- `candidatura-esito-rifiutata`
- `candidatura-nuova-admin`
- `candidatura-completata-admin`

Ogni file esporta l'oggetto `template` con `component`, `subject`, `displayName`, `previewData` come richiesto dal registry. Il blocco contatti condiviso resta un helper.

Registrati tutti in `registry.ts` con nomi kebab-case.

### 3. Sostituzione del canale di invio
Refactor di:
- `supabase/functions/submit-candidatura/index.ts`
- `supabase/functions/complete-candidatura/index.ts`
- `supabase/functions/send-esito-email/index.ts`
- `supabase/functions/generate-completion-link/index.ts`

Sostituisco le chiamate a `enqueueTransactional(...)` con `supabase.functions.invoke('send-transactional-email', { body: { templateName, recipientEmail, idempotencyKey, templateData } })`. Stessi payload logici, stessi trigger, stesse `idempotencyKey` già in uso.

Il vecchio helper `_shared/enqueue-transactional.ts` resta solo se ancora usato dai template Auth; altrimenti lo rimuovo.

### 4. Cosa NON tocco
- Auth email hook (`auth-email-hook` + template signup/recovery/…): restano dove sono, non vanno nel registry app.
- Coda `auth_emails` e `process-email-queue`: continuano a servire l'auth.
- Tabella `impostazioni`, `getContatti`, blocco contatti nei template: invariati.
- UI admin, form pubblico, DB schema: invariati.

### 5. Deploy e verifica
Deploy di: `send-transactional-email`, `handle-email-unsubscribe`, `handle-email-suppression`, `submit-candidatura`, `complete-candidatura`, `send-esito-email`, `generate-completion-link`.

Verifica: aprire Cloud → Emails → App emails e confermare che i 6 template appaiano con nome/oggetto/preview.

## Rischi e nota

- L'infrastruttura di coda pgmq è già presente (`setup_email_infra` fatto in passato), quindi lo scaffold non ricrea nulla di distruttivo.
- `send-transactional-email` verifica `suppressed_emails` prima di inviare: identico comportamento a oggi.
- Cambio contenuto in un solo turno; se qualcosa fallisse in produzione, rollback = ripristinare le vecchie chiamate `enqueueTransactional` (i file restano in git history).

Confermi e procedo?
