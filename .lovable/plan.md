## Diagnosi

L'utente `studentatoeuropa@gmail.com` (id `9449c32f-…`) **esiste e il login riesce** (i log auth mostrano `/token` 200), ma viene subito buttato fuori da `/admin`.

Causa: in `src/pages/admin/AdminLayout.tsx` la sessione viene verificata contro `public.user_roles` cercando `role = 'admin'`. Query sul DB:

```
roles: NULL
```

L'utente non ha alcuna riga in `user_roles`, quindi `AdminLayout` esegue `supabase.auth.signOut()` e rimanda a `/login` — dal punto di vista dell'utente "il sistema non lo fa accedere".

Nota: la tabella `user_roles` ha RLS che permette insert/update **solo agli admin già esistenti**, quindi non è possibile assegnare il ruolo dalla UI a un nuovo admin senza passare dal DB.

## Fix proposto

Inserire il ruolo `admin` per questo utente via migrazione SQL:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('9449c32f-5726-4f01-b1db-686ce7bace29', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

Nessuna modifica al codice applicativo.

## Follow-up opzionale (da confermare)

Se in futuro vorrai creare altri admin senza toccare il DB, posso aggiungere in una UI amministrativa (es. pagina "Utenti") la gestione dei ruoli — fuori scope di questo fix.
