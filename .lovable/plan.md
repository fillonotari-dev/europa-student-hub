## Obiettivo

Rimuovere completamente la utility one-shot `migrate-pending-docs` ora che non c'è più nulla da migrare. Lo spostamento automatico a runtime (`_shared/move-documenti.ts` usato da `submit-candidatura` e `complete-candidatura`) resta invariato.

## Cosa cambia

1. **Eliminare** la cartella `supabase/functions/migrate-pending-docs/` (contiene solo `index.ts`).
2. **Aggiornare** `supabase/config.toml` rimuovendo il blocco:
   ```toml
   [functions.migrate-pending-docs]
     verify_jwt = true
   ```

## Cosa NON cambia

- `supabase/functions/_shared/move-documenti.ts`
- `supabase/functions/submit-candidatura/index.ts`
- `supabase/functions/complete-candidatura/index.ts`
- Nessuna modifica al DB, storage, RLS, sidebar admin.

## Nota

Non risulta alcun pannello di manutenzione nell'area admin che invocasse la funzione (verificato: gli unici riferimenti a `migrate-pending-docs` sono nel file della funzione stessa e in `config.toml`). Quindi nulla da rimuovere lato frontend.
