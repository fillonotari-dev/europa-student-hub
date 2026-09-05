# Rettifica: due funzioni distinte per i campi mancanti Fatture in Cloud

Il piano approvato per la sincronizzazione anagrafica è confermato nella sua interezza.
Unica correzione: i due consumatori hanno soglie leggermente diverse sull'`email_recapito`.
Si tende quindi `campiMancantiPerFic` come due funzioni distinte nello stesso modulo condiviso `supabase/functions/_shared/fic-anagrafica.ts`.

## 1. Modulo condiviso `supabase/functions/_shared/fic-anagrafica.ts`

- Estrarre la logica comune in una funzione interna `baseCampiMancantiPerFic(a)` che restituisce i campi mancanti indipendentemente dal contesto d'uso:
  - nome/denominazione;
  - via;
  - comune;
  - per Italia: CAP, provincia, almeno un identificativo fiscale (codice fiscale o partita IVA);
  - per estero: nazione.

- Creare due esportazioni pubbliche:
  - `campiMancantiPerFicSync(a)` — usata dall'edge function `fic-sync-anagrafica`. Equivale alla base, **senza** richiedere `email_recapito`: l'email non è necessaria per creare il cliente su Fatture in Cloud.
  - `campiMancantiPerFicContratto(a)` — usata dal dialogo di creazione contratto. Aggiunge il controllo su `email_recapito` (con messaggio "email di recapito"), perché l'avviso serve a segnalare cosa mancherà al momento della fattura; per gli studenti esteri l'email è l'unico recapito possibile, dato che lo SDI non consegna all'estero.

## 2. Aggiornamento consumatori

- `supabase/functions/fic-sync-anagrafica/index.ts`: sostituire l'import e la chiamata con `campiMancantiPerFicSync`.
- `src/components/admin/contratti/ContrattoDialog.tsx`: sostituire l'import e la chiamata con `campiMancantiPerFicContratto`.
- Aggiornare il commento esplicativo vicino all'uso in `ContrattoDialog.tsx` per riflettere la nuova distinzione.

## 3. Documentazione

- In `docs/Context.md`, nella sezione Fatture in Cloud, documentare le due funzioni e la differenza di soglia:
  - sincronizzazione: campi strettamente necessari alla creazione del cliente;
  - dialogo contratto: stessi campi più `email_recapito`, necessaria per l'emissione della fattura.

## 4. Verifica

- Typecheck e build.
- Eventuali test esistenti su `fic-anagrafica.ts` o sul dialogo contratto.
- Nessuna modifica al database, alle policy, ai secret o alle chiamate API esterne.
