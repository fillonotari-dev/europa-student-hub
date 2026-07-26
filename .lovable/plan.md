## Funzioni interessate

Il linter segnala 6 funzioni `SECURITY DEFINER` nello schema `public` eseguibili da `anon` (e `authenticated`), tutte parte dell'infrastruttura interna della coda email — nessuna è chiamata dal frontend o da utenti finali:

- `public.enqueue_email(text, jsonb)`
- `public.read_email_batch(text, int, int)`
- `public.delete_email(text, bigint)`
- `public.move_to_dlq(text, text, bigint, jsonb)`
- `public.email_queue_dispatch()`
- `public.email_queue_wake()`

Queste vengono invocate solo da:

- Trigger interni (`email_queue_wake`)
- Cron job Postgres (`email_queue_dispatch`)
- Edge Functions con `service_role` (`process-email-queue`, helper `enqueue-transactional`)

`public.has_role` è invece correttamente ristretta ad `authenticated` + `service_role` e non risulta nel problema.

## Fix

Migrazione unica che revoca `EXECUTE` da `PUBLIC`, `anon`, `authenticated` (e `sandbox_exec`) su tutte e 6 le funzioni, mantenendo l'accesso a `service_role` e `postgres`. Nessun cambio applicativo necessario: le Edge Functions usano già `service_role`, i trigger/cron girano come `postgres`.

Estendi la migrazione includendo anche il fix del finding "Function Search Path Mutable", ma **solo** su queste quattro funzioni, che risultano prive di `search_path`:  
`enqueue_email(text, jsonb)`, `read_email_batch(text, integer, integer)`, `delete_email(text, bigint)`, `move_to_dlq(text, text, bigint, jsonb)`.  
Usa `SET search_path = ''`: tutte e quattro qualificano già esplicitamente le chiamate a `pgmq`.  
**Non toccare `email_queue_dispatch()` ed `email_queue_wake()**`: hanno già `search_path = ''` impostato, verificato via `pg_proc.proconfig`. Sovrascriverlo sarebbe una regressione.

Dopo la migrazione: rirun linter per confermare la risoluzione e marcare la finding come fixed.