## Obiettivo

Sbloccare l'invio delle email transazionali di candidatura aggiungendo l'`unsubscribe_token` mancante nel payload verso l'API email.

## Modifica

In `supabase/functions/_shared/enqueue-transactional.ts`, prima di accodare l'email:

1. Cercare in `email_unsubscribe_tokens` un token esistente per l'indirizzo destinatario.
2. Se assente, generarne uno sicuro (UUID) e inserirlo nella tabella.
3. Includere `unsubscribe_token` nel payload passato a `enqueue_email`, accanto a `message_id` e `idempotency_key` già presenti.

## Deploy

Ridistribuire le tre funzioni che usano l'helper condiviso:
- `submit-candidatura`
- `generate-completion-link`
- `send-esito-email`

`process-email-queue` non richiede redeploy: inoltra già il campo all'API.

## Cosa non cambia

Nessuna nuova tabella, nessuna migrazione, nessuna modifica ai flussi applicativi o ai template.

## Verifica

Inviare una nuova candidatura di test dopo il deploy e verificare che la riga in `email_send_log` risulti `sent`. Le righe `failed`/`dlq` precedenti restano storiche (la DLQ non ritenta automaticamente).