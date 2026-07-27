## Parte 1 — Scheda persona: navigazione, collasso, no duplicazione

### 1. Torna alla lista con stato preservato — nell'URL, non in navigation state
Motivazione: `Candidature.tsx` legge già `?candidatura` dai query params. Un secondo canale (`location.state`) creerebbe due sorgenti e si perderebbe al reload / tasto indietro.

- `src/pages/admin/Candidature.tsx`: `search`, `filterStato`, `filterStruttura` (se locale), `page` sincronizzati con `useSearchParams` (`?q=…&stato=…&page=…`). Idratazione al mount da query params; ogni cambio filtro fa `setSearchParams(..., { replace: true })`.
- Apertura scheda: `navigate('/admin/studenti/:id?candidatura=…&from=candidature&<queryString>')`.
- `src/pages/admin/Residenti.tsx`: idem per i suoi filtri; apertura scheda con `&from=residenti&<queryString>`.
- `src/pages/admin/StudentePage.tsx`: link "← Torna alla lista" ricostruito dall'URL leggendo `from` e ripropagando i restanti query params (esclusi `candidatura`/`from`). Fallback a `/admin/candidature` se `from` assente.

Reload e tasto indietro funzionano; la lista si riapre esattamente com'era.

### 2. Blocchi candidatura richiudibili
- `src/components/admin/candidatura/CandidaturaDetail.tsx` prende `open: boolean` e `onToggle`. Header collassato: data candidatura, anno accademico, badge di stato e `CandidaturaActions.Buttons`. Dettaglio renderizzato solo quando `open`.
- `StudentePage.tsx`: `openIds: Set<string>` calcolato quando i dati sono disponibili — se `?candidatura=<id>` valido, aperto solo quello; altrimenti solo il più recente. Chevron nell'header alterna il blocco.

### 3. Deduplicazione e rinomina sezione
Rimuovere dalla scheda-candidatura la sezione con email/telefono/nazionalità/data di nascita/CF (già in "Anagrafica" in cima). La sezione superstite contiene solo `indirizzo_residenza` e `documento_identita_n`: rinominarla **"Dichiarazioni per questa candidatura"**.

Risposta al punto 3 — mappatura:
- **Persona (in cima, una volta):** nome, cognome, email, telefono, nazionalità, data di nascita, codice fiscale.
- **Candidatura (nel blocco):** indirizzo di residenza dichiarato, numero documento d'identità dichiarato, snapshot accademici, tipo studente, preferenze, stile di vita (fase 2), garante, stato form, messaggio, dichiarazioni, documenti, cronologia, note admin, azioni.

### Uniformare formati (dettagli visti in schermata)
- `CandidaturaDetail.tsx` Preferenze: `fmtIt(c.periodo_inizio) → fmtIt(c.periodo_fine)` invece del formato ISO.
- `StudentePage.tsx` durata soggiorno: singolare/plurale corretto (`1 giorno` / `N giorni`, `1 mese` / `N mesi`).

## Parte 2 — Registro cambi di stato

### 4. Rimozione della doppia scrittura

Verifica sul file attuale (`src/hooks/useCandidaturaActions.tsx`, righe 64-81 e 258-292):
- La mutazione `updateStato` accetta oggi solo `{ id, stato }` e **non passa alcuna nota** al registro: l'`INSERT` scrive `candidatura_id`, `stato_precedente`, `stato_nuovo`, `cambiato_da` senza `note`.
- Il dialog `statoConfirm` non ha campo nota.
- Quindi rimuovendo l'`INSERT` **non si perde alcuna nota**.

Modifica: in `updateStato` rimuovere il `SELECT stato`, l'`INSERT` in `log_stato_candidature` e la chiamata `auth.getUser()`. Restano solo `UPDATE candidature SET stato = …`. La transizione la scrive il trigger `candidature_log_stato`.

Nessun nuovo campo nota nel dialog: fuori scope. La nota già presente sulla candidatura (`note_admin`) resta l'unico punto di scrittura di annotazioni libere.

Restano invariate le righe evento scritte dalle edge functions (`generate-completion-link`, `send-esito-email`) — non toccate.

### 5. Timeline: nota mostrata testualmente
In `CandidaturaDetail.tsx` (e coerentemente in `StoricoCandidature.tsx`):
- Righe con `stato_precedente = stato_nuovo`: stampare il testo di `note` così com'è nel database. Nessun mapping di stringhe.
- Righe di transizione: "Stato passato da *X* a *Y*" con `formatStato`.
- Se una transizione ha anche una nota, mostrare entrambe: la frase di transizione sopra e il testo della nota sotto.

### 6. Prima riga della cronologia
La prima riga si identifica **per posizione cronologica** all'interno della singola candidatura (elemento con `created_at` più antico), non per assenza di `stato_precedente`. Presentazione:
> "Candidatura ricevuta" (o, se lo stato iniziale registrato non è `ricevuta`: "Candidatura registrata come *{formatStato(stato_nuovo)}*").

Righe **successive** senza `stato_precedente`:
- se hanno `note` non vuota → evento descritto dalla nota (testo letterale).
- altrimenti → registrazione dello stato: "Stato registrato: *{formatStato(stato_nuovo)}*".

### 7. `complete-candidatura` fuori dalla macchina a stati
`supabase/functions/complete-candidatura/index.ts` (riga 194) oggi registra `stato_nuovo: "completata_form"`, valore non presente nella macchina a stati. Correggere in evento: `stato_precedente = cand.stato`, `stato_nuovo = cand.stato`, `note = "Form completo inviato dallo studente"`. Nessun altro cambio.

### 8. Timeline leggibile
Lista verticale (ordine ascending) con pallino/linea, italiano corrente:
- **{data ora}** — Candidatura ricevuta *(prima riga per posizione)*
- **{data ora}** — Stato passato da *Ricevuta* a *Approvata* *(transizione)*
- **{data ora}** — {testo nota letterale} *(evento)*

## Vincoli

- Nessuna modifica a stati, vincoli, trigger, migrazioni.
- Nessuna riga esistente del log cancellata o riscritta.

### File toccati
- `src/pages/admin/StudentePage.tsx` — link ritorno da URL, apertura blocchi, singolare/plurale durata.
- `src/components/admin/candidatura/CandidaturaDetail.tsx` — collassabile, rimozione "Dati studente", rinomina in "Dichiarazioni per questa candidatura", nuova timeline, `fmtIt` sul periodo.
- `src/pages/admin/Candidature.tsx` — filtri/ricerca/pagina in `useSearchParams`; navigate con querystring + `from=candidature`.
- `src/pages/admin/Residenti.tsx` — filtri/ricerca in `useSearchParams`; navigate con querystring + `from=residenti`.
- `src/hooks/useCandidaturaActions.tsx` — `updateStato` scrive solo `UPDATE candidature`, nessun `INSERT` nel log, nessun nuovo campo nel dialog.
- `src/pages/admin/storico/StoricoCandidature.tsx` — presentazione coerente, prima riga per posizione cronologica.
- `supabase/functions/complete-candidatura/index.ts` — log come evento descritto dalla nota.
