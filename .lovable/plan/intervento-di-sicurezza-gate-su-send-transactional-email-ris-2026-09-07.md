# Intervento di sicurezza: gate su send-transactional-email, risposte pulite in delete-candidatura

Perimetro chiuso: due file, nessuna modifica all'interfaccia, nessun pacchetto nuovo, nessuna modifica a `config.toml`.

## Problema

`send-transactional-email` si affida solo a `verify_jwt = true`, ma la anon key è un JWT valido ed è pubblica nel bundle: chiunque può far partire email firmate DKIM dal nostro dominio con template e destinatario a scelta (incluso `candidatura-link-completamento` con `completionUrl` arbitraria). Il commento "No in-function auth check is needed" è il difetto stesso.

Verificato: nessun file dell'applicazione invoca questa funzione — i flussi reali passano da `enqueueTransactional` (`_shared/enqueue-transactional.ts`). La funzione resta esposta al pannello "App emails", quindi va chiusa, non eliminata.

## 1. Gate di autorizzazione su `send-transactional-email/index.ts`

Subito dopo il preflight CORS e PRIMA del parsing del body, accettare la richiesta solo se vale almeno una di:

- **a.** il Bearer token coincide esattamente con `LOVABLE_API_KEY` — stesso pattern di `preview-transactional-email/index.ts` (righe 16–35): lettura env, 500 se mancante, confronto sul token;
- **b.** il token è un JWT con claim `role` uguale a `service_role` — verifica via `auth.getClaims(token)` e controllo del claim `role`;
- **c.** il token è un JWT utente valido e l'utente è admin — stesso schema di `delete-candidatura/index.ts` (righe 36–49): client anon con l'`Authorization` del chiamante, `getClaims(token)` per `sub`, poi client service-role e `rpc("has_role", { _user_id, _role: "admin" })`.

Esiti:
- header `Authorization` mancante → **401** `{ error: "unauthorized" }`
- presente ma non autorizzato → **403** `{ error: "forbidden" }`, nessun dettaglio diagnostico.

Sostituire il commento "Auth note..." con una nota che spieghi perché `verify_jwt` non è una barriera di autorizzazione (la anon key è un JWT firmato valido e pubblico).

Criterio di accettazione: chiamata con la sola anon key → 403.

## 2. `delete-candidatura/index.ts`: niente dettagli d'errore nelle risposte

- Catch finale (riga 158): `details: e?.message` → `{ error: "errore_interno" }`. Il dettaglio resta in `console.error`.
- Ramo storage (riga 99): `details: rmErr.message` → `{ error: "storage_cleanup_failed" }`. `console.error` resta.
- Il campo `paths` negli altri due rami storage resta com'è.

## Fuori perimetro (esplicito)

- Non toccare `src/lib/exportXlsx.ts`: verificato che SheetJS scrive celle `t="str"` senza elemento `<f>`, Excel non le valuta — non è formula injection.
- Non modificare `config.toml`, le altre edge function, le policy RLS.

## Verifica prima di chiudere

1. Typecheck e suite test esistente passano.
2. Chiamata a `send-transactional-email` con la sola anon key → 403 (test via curl sulla funzione ridistribuita).
3. Flusso candidatura → email di conferma invariato (passa da `enqueueTransactional`, non da questa funzione).
4. Ridistribuzione delle due edge function modificate.

## Dettagli tecnici

File toccati:
- `supabase/functions/send-transactional-email/index.ts` — gate a tre condizioni + nota esplicativa
- `supabase/functions/delete-candidatura/index.ts` — due risposte senza `details`

Nessuna migration, nessun cambio di schema, nessuna modifica al frontend.
