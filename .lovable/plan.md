## Problema

Le email transazionali di candidatura (ricezione, link completamento, esito) falliscono con errore 400 dall'API email di Lovable. Il payload accodato su `transactional_emails` non contiene il campo `idempotency_key`, richiesto per le email applicative (`purpose: 'transactional'`). Senza quel campo — o in alternativa `run_id`, riservato alle email auth — l'API rifiuta la richiesta.

## Modifica

**File:** `supabase/functions/_shared/enqueue-transactional.ts`

Nel payload passato a `supabase.rpc('enqueue_email', ...)`, aggiungere `idempotency_key: messageId` riusando lo stesso `messageId` già generato per il log su `email_send_log`. Nessun'altra modifica al payload: `purpose`, `sender_domain`, `from`, `subject`, `html`, `text`, `label`, `queued_at` restano invariati.

## Deploy

Dopo la modifica, ridistribuire le Edge Functions che importano l'helper: `submit-candidatura`, `generate-completion-link`, `send-esito-email`.

## Verifica

Inviare una candidatura di test dal form pubblico e controllare che la riga corrispondente su `email_send_log` passi da `pending` a `sent` (invece di `failed` con 400).
