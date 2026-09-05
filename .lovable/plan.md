# Piccoli aggiustamenti sicurezza e documentazione

## Obiettivo
Tre correzioni sul modulo Fatture in Cloud e sul presidio documentale del perimetro pubblico.

## 1. REVOKE su `public.fic_log`

Aggiungere una migration additiva che revochi esplicitamente `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE` su `public.fic_log` dai ruoli `anon` e `authenticated`. La RLS blocca già le scritture, ma lo schema `public` concede i privilegi di default: revocarli è la cintura di sicurezza qualcuno incolli inavvertitamente una policy `FOR ALL` copiata dalle tabelle di dominio.

## 2. Token semantico nel componente Fatture in Cloud

In `src/components/admin/impostazioni/FattureInCloudSection.tsx` sostituire `text-emerald-600` con `text-success`, come da regola 9 del §12 del design system. L'icona di errore usa già correttamente `text-destructive`.

## 3. Allineamento di `docs/Context.md` §7

La sezione "Perimetro pubblico" elenca cinque funzioni, ma `supabase/config.toml` ha quattro ulteriori funzioni con `verify_jwt = false`: `open-candidatura-sessione`, `preview-transactional-email`, `handle-email-unsubscribe`, `handle-email-suppression`. Per ciascuna dichiarare come è protetta:

- `open-candidatura-sessione`: accessibile anonimamente, ma richiede un token Cloudflare Turnstile valido oppure un token di completamento candidatura valido.
- `preview-transactional-email`: accessibile senza JWT, ma protetta dalla `LOVABLE_API_KEY`; è chiamata solo dall'API interna Go di Lovable per generare le anteprime dei template.
- `handle-email-unsubscribe`: accessibile anonimamente, ma richiede un token monouso presente in `email_unsubscribe_tokens` (via query param o body).
- `handle-email-suppression`: webhook anonimo che accetta solo richieste firmate tramite HMAC con la `LOVABLE_API_KEY`; rifiuta payload senza firma valida o stale.

## Fuori perimetro

Nessuna modifica funzionale al flusso Fatture in Cloud, nessuna nuova tabella, nessuna modifica ai dati esistenti.

## Dettagli tecnici

- Migration: `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.fic_log FROM anon, authenticated;`. Intervento puramente additivo sui permessi, nessun `DROP` o `ALTER` restrittivo.
- Modifica a `FattureInCloudSection.tsx`: sostituzione di una classe Tailwind hard-coded con il token semantico.
- Aggiornamento paragrafo §7 di `docs/Context.md` per riflettere tutte le funzioni con `verify_jwt = false` e i rispettivi meccanismi di protezione.
