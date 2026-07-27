## Obiettivo

Rimuovere completamente la funzionalità "form configurabile" (campi e documenti extra gestiti da admin) da frontend, edge functions e database. Il form di candidatura torna ad avere un insieme di campi fisso.

## Ordine di esecuzione (importante)

1. Prima: modifiche a **frontend + edge functions** (deploy elimina ogni scrittura su `risposte_custom` e ogni lettura delle tabelle di config).
2. Solo dopo: la **migration** che elimina tabelle, colonna e allinea il CHECK.

Motivo: droppare `risposte_custom` mentre il vecchio codice è ancora online farebbe fallire ogni candidatura inviata nella finestra di deploy.

## 1. Edge Functions

Nuovo modulo condiviso **`supabase/functions/_shared/documenti-tipi.ts`** che esporta l'insieme fisso:

```
documento_identita, certificato_iscrizione, documento_garante, documento_aggiuntivo
```

**`supabase/functions/submit-candidatura/index.ts`**
- Rimuovere `risposte_custom` dallo schema del payload e dall'insert su `candidature`.
- Rimuovere lettura di `form_campi_custom` e `form_documenti_custom`.
- Per ogni documento nel payload:
  - `tipo` deve appartenere all'insieme fisso importato dal modulo condiviso (no regex generica);
  - il segmento tipo estratto dal path (`pending/{temp_id}/{tipo}/...`) deve coincidere con `tipo` dichiarato; altrimenti rifiuto 400 generico.
- Limiti anti-abuso esistenti (lunghezze, numero documenti, ecc.) restano invariati.

**`supabase/functions/complete-candidatura/index.ts`**
- Stessa validazione: `tipo` contro insieme fisso importato dal modulo condiviso, e coincidenza tipo↔path.
- Nessuna dipendenza da tabelle di config (già verificato assente).

**`supabase/functions/upload-candidatura-doc/index.ts`**
- Rimuovere il fallback su `form_documenti_custom`. Importare l'insieme dal modulo condiviso (rimpiazza il `FIXED_TIPI` locale) per evitare la ripetizione in tre file.
- Tutti gli altri controlli (sessione, dimensione, MIME, path) restano identici.

Nessuna modifica a `get-completion-form`, `generate-completion-link` (nessuna dipendenza rilevata).

## 2. Frontend pubblico — `src/pages/Candidatura.tsx`

- Rimuovere le due query React Query verso `form_campi_custom` e `form_documenti_custom` e tutto lo stato `customAnswers` / gestione file custom.
- Rimuovere lo step "Informazioni aggiuntive" (`stepInfoAggiuntive`) dall'array degli step, dalla mappa dei campi validati e dal render (righe 139, 225, 668).
- Rimuovere upload dei documenti custom (mantenere solo i fissi, invariati).
- Rimuovere `risposte_custom` dal payload inviato a `submit-candidatura`.
- Turnstile, sessione, altri step, dichiarazioni, i18n dei campi fissi: invariati.

## 3. i18n — `src/i18n/translations.ts`

Rimuovere le chiavi orfane (usate solo dallo step eliminato): `stepInfoAggiuntive` e `infoAggiuntive` in entrambe le lingue.

## 4. Admin

**`src/pages/admin/ConfigForm.tsx`** — eliminare il file.

**`src/App.tsx`** — rimuovere import e `<Route path="config-form" ...>`.

**`src/components/admin/AdminSidebar.tsx`** — rimuovere la voce "Configurazione form" (e l'icona `SlidersHorizontal` se non usata altrove).

**`src/pages/admin/Candidature.tsx`**
- Rimuovere le due query verso `form_campi_custom` e `form_documenti_custom`.
- Rimuovere dalla scheda dettaglio candidato la sezione che renderizza risposte/documenti custom (~riga 664).
- Rimuovere dall'export XLSX le colonne derivate dai campi custom (~riga 484). Tutte le altre colonne restano identiche.

## 5. Migration (eseguita per ultima)

Verifiche preliminari già svolte tramite `psql`:
- Nessun trigger DB né funzione DB referenzia `form_campi_custom` / `form_documenti_custom` / `risposte_custom`.
- Colonna `documenti.tipo` ha un CHECK `documenti_tipo_check` = `('documento_identita','certificato_iscrizione','altro')` — non allineato al nuovo insieme fisso. Righe esistenti usano solo `documento_identita` e `certificato_iscrizione`, quindi allineamento non violato.

SQL della migration, in ordine:

1. `DROP TABLE public.form_campi_custom;` — **senza CASCADE**. Se fallisce per dipendenze, fermare e investigare, non forzare.
2. `DROP TABLE public.form_documenti_custom;` — stessa regola.
3. `ALTER TABLE public.candidature DROP COLUMN risposte_custom;`
4. `ALTER TABLE public.documenti DROP CONSTRAINT documenti_tipo_check;`
5. `ALTER TABLE public.documenti ADD CONSTRAINT documenti_tipo_check CHECK (tipo IN ('documento_identita','certificato_iscrizione','documento_garante','documento_aggiuntivo'));` — nessuna riga esistente viene modificata.

## 6. Tipi generati

`src/integrations/supabase/types.ts` viene rigenerato automaticamente dopo la migration; nessuna modifica manuale.

## 7. Verifica finale

- `tsgo` per confermare che non restano riferimenti a `risposte_custom`, `form_campi_custom`, `form_documenti_custom`, `stepInfoAggiuntive`, `infoAggiuntive`.
- `supabase--linter` dopo la migration.

## File toccati (riepilogo)

Nuovi:
- `supabase/functions/_shared/documenti-tipi.ts`
- `supabase/migrations/<timestamp>_drop_form_custom.sql`

Modificati:
- `supabase/functions/submit-candidatura/index.ts`
- `supabase/functions/complete-candidatura/index.ts`
- `supabase/functions/upload-candidatura-doc/index.ts`
- `src/pages/Candidatura.tsx`
- `src/pages/admin/Candidature.tsx`
- `src/components/admin/AdminSidebar.tsx`
- `src/App.tsx`
- `src/i18n/translations.ts`

Eliminati:
- `src/pages/admin/ConfigForm.tsx`
