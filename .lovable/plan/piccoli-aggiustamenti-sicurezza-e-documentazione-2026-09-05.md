# Piccoli aggiustamenti sicurezza e documentazione

## Obiettivo
Tre correzioni sul modulo Fatture in Cloud e sul presidio documentale del perimetro pubblico.

## 1. REVOKE su `public.fic_log`

Aggiungere una migration additiva che revochi esplicitamente `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE` su `public.fic_log` dai ruoli `anon` e `authenticated`. La RLS blocca già le scritture, ma lo schema `public` concede i privilegi di default: revocarli è la cintura di sicurezza qualcuno incolli inavvertitamente una policy `FOR ALL` copiata dalle tabelle di dominio.

## 2. Token semantico nel componente Fatture in Cloud

In `src/components/admin/impostazioni/FattureInCloudSection.tsx` sostituire `text-emerald-600` con `text-success`, come da regola 9 del §12 del design system. L'icona di errore usa già correttamente `text-destructive`.

## 3. Allineamento di `docs/Context.md` §7

La sezione "Perimetro pubblico" elenca cinque funzioni, ma il perimetro reale è più ampio. Riscrivere il paragrafo così:

**Premessa sul default.** `supabase/config.toml` **non è la fonte di verità completa**: contiene solo le funzioni con un'impostazione esplicita. Le funzioni assenti dal file (`submit-candidatura`, `complete-candidatura`, `get-completion-form`, `upload-candidatura-doc`) risultano raggiungibili senza JWT in produzione, quindi il controllo `verify_jwt` si applica solo alle funzioni dichiarate. In §7 va scritto esplicitamente che l'elenco completo del perimetro pubblico è quello del documento, non quello di config.toml.

**Elenco completo delle funzioni pubbliche (9), una riga ciascuna con ancoraggio meccanismo + file:**

- `submit-candidatura` — pubblica per default del gateway (assente da `config.toml`); valida server-side ogni campo e richiede una sessione candidatura attiva (`supabase/functions/submit-candidatura/index.ts`).
- `complete-candidatura` — default del gateway; richiede token di completamento valido confrontato con l'hash salvato (`complete-candidatura/index.ts`).
- `get-completion-form` — default del gateway; stessa validazione del token (`get-completion-form/index.ts`).
- `upload-candidatura-doc` — default del gateway; richiede sessione attiva con slot di upload consumato atomicamente via RPC `consume_candidatura_upload_slot` (`upload-candidatura-doc/index.ts`).
- `auth-email-hook` — `verify_jwt = false`; webhook firmato HMAC con `LOVABLE_API_KEY` tramite `verifyWebhookRequest` (`auth-email-hook/index.ts`).
- `open-candidatura-sessione` — `verify_jwt = false`; richiede token Cloudflare Turnstile valido **oppure** token di completamento valido, e rifiuta un `temp_id` già esistente con "Sessione già esistente" (`open-candidatura-sessione/index.ts`, righe 51–58).
- `preview-transactional-email` — `verify_jwt = false`; protetta da bearer check su `LOVABLE_API_KEY`, chiamata solo dall'API Go interna (`preview-transactional-email/index.ts`, righe 27–35).
- `handle-email-unsubscribe` — `verify_jwt = false`; richiede token monouso di `email_unsubscribe_tokens`. **GET valida soltanto il token senza consumarlo; POST lo consuma con check-and-update atomico** (`.update({ used_at }).eq('token').is('used_at', null)`, righe 89–95). I due metodi sono separati perché i filtri antispam precaricano i link delle email: se anche GET consumasse il token, gli studenti verrebbero disiscritti dalla sola apertura del messaggio.
- `handle-email-suppression` — `verify_jwt = false`; webhook che accetta solo richieste firmate HMAC con `LOVABLE_API_KEY` via `verifyWebhookRequest` di `@lovable.dev/webhooks-js` (righe 49–56), con rifiuto di firma invalida e timestamp stale.

## Fuori perimetro

Nessuna modifica funzionale al flusso Fatture in Cloud, nessuna nuova tabella, nessuna modifica ai dati esistenti.

## Dettagli tecnici

- Migration: `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.fic_log FROM anon, authenticated;`. Intervento puramente additivo sui permessi, nessun `DROP` o `ALTER` restrittivo.
- Modifica a `FattureInCloudSection.tsx`: sostituzione di una classe Tailwind hard-coded con il token semantico.
- Aggiornamento paragrafo §7 di `docs/Context.md` per riflettere tutte le funzioni con `verify_jwt = false` e i rispettivi meccanismi di protezione.
