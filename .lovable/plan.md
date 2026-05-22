# Audit flusso candidature

## Stato attuale (cosa fa il sistema oggi)

### Form pubblico semplice — `src/pages/Candidatura.tsx`
- Step: Personale → Accademico → Preferenze → Documenti → (Info extra) → Dichiarazioni.
- Step Documenti carica 4 file: `documento_identita`, `certificato_iscrizione`, **`documento_garante`**, **`documento_aggiuntivo`**.
- Submit via `submit-candidatura` → crea/aggiorna `studenti`, crea `candidature` con `versione_form='pre_screening'` + dichiarazioni firmate.

### Form completo — `src/pages/CandidaturaCompleta.tsx`
- Token-based. Step: Lifestyle → Garante → Doc aggiuntivi → Dichiarazioni → Review.
- `stepDocAggiuntivi` mostra l'upload **solo** per i documenti garante/aggiuntivo non già presenti (lookup `get-completion-form`).
- Submit via `complete-candidatura` → setta `versione_form='completa'`, salva lifestyle/garante/dichiarazioni e inserisce eventuali nuovi documenti.

### Dettaglio admin — `src/pages/admin/Candidature.tsx`
- Mostra: Dati studente, Dati accademici, Preferenze, Messaggio, Info aggiuntive (custom), Documenti, Azioni, Note admin.
- `TIPO_DOC_LABELS` ha label solo per `documento_identita` e `certificato_iscrizione`.

## Buchi individuati

1. **Overlap docs semplice ↔ completo.** Il form semplice raccoglie `documento_garante` e `documento_aggiuntivo` (blocco 5 del PDF cliente), che dovrebbero essere esclusivi del form completo (blocchi 1,2,3,6,7 nel semplice). Conseguenze:
   - Lo studente carica i doc del garante nel semplice ma il form completo poi gli chiede comunque i **dati anagrafici** del garante, dando la sensazione di "ripetere informazioni già inserite".
   - Se i doc sono stati caricati nel semplice, il completo **salta** lo step Doc aggiuntivi → lo studente non può sostituirli.

2. **Dati non visibili nel dettaglio admin.** Diversi campi salvati su `candidature` non vengono mai mostrati:
   - Pre-screening esteso: `indirizzo_residenza`, `documento_identita_n`, `tipo_studente` (+ altro), `data_arrivo_prevista`, `come_conosciuto` (+ altro), `preferenze_note`.
   - Form completo (lifestyle): `lingue_parlate`, `orari`, `personalita` (+ altro), `ordine_pulizia`, `fumatore`, `presentazione`.
   - Garante: `garante_nome`, `garante_relazione`, `garante_telefono`, `garante_email`.
   - Stato form: `versione_form` (badge tabella sì, dettaglio no), `completata_il`, `dichiarazioni.firmate_il`.

3. **Documenti garante/aggiuntivo senza label nel dettaglio admin.** `TIPO_DOC_LABELS` non include queste chiavi, quindi nella riga documento appare la chiave tecnica grezza (`documento_garante`). Il download tecnicamente funziona ma il documento non è identificabile a colpo d'occhio → l'admin "non lo vede".

4. **Export XLSX incompleto.** L'export candidature non include i campi del punto 2 (utili per il workflow operativo).

## Modifiche proposte

### A. Form semplice — `src/pages/Candidatura.tsx`
- Rimuovere dallo step Documenti gli upload `documento_garante` e `documento_aggiuntivo` (restano solo i 2 obbligatori del blocco 6).
- Pulire lo stato `files`, `fileErrors` e i tipi/handler relativi.

### B. Form completo — `src/pages/CandidaturaCompleta.tsx`
- `stepDocAggiuntivi` sempre presente (i doc garante/aggiuntivo non arrivano più dal semplice). Garante obbligatorio (coerente con blocco 5 del PDF), aggiuntivo opzionale. Rimuovere la logica condizionale basata su `docsPresent`.

### C. Backend
- `supabase/functions/get-completion-form/index.ts`: rimuovere il lookup `documenti_presenti` (non serve più al frontend).
- `supabase/functions/upload-candidatura-doc/index.ts`: lasciare `documento_garante`/`documento_aggiuntivo` in `FIXED_TIPI` (già fatto): vengono usati dal form completo.

### D. Dettaglio admin — `src/pages/admin/Candidature.tsx`
- Aggiungere `TIPO_DOC_LABELS` per `documento_garante` ("Documento garante") e `documento_aggiuntivo` ("Documento aggiuntivo").
- Estendere il Dialog di dettaglio con nuove sezioni mostrate condizionalmente:
  1. **Dati studente**: aggiungere `indirizzo_residenza`, `documento_identita_n` (da candidatura), `data_nascita`, `codice_fiscale`.
  2. **Dati accademici**: aggiungere `tipo_studente` (con label leggibile + `tipo_studente_altro`).
  3. **Preferenze**: aggiungere `preferenze_note`, `data_arrivo_prevista`, `come_conosciuto` (+ altro).
  4. **Stile di vita** (solo se `versione_form='completa'`): lingue, orari, personalità, ordine/pulizia, fumatore, presentazione.
  5. **Garante** (solo se presente): nome, relazione, telefono, email.
  6. **Stato form**: badge "Pre-screening"/"Completa", data completamento, data firma dichiarazioni.
- La query `candidature` già fa `select('*')`, ma i campi su `studenti` vanno estesi (`data_nascita, codice_fiscale`) — aggiungerli al select.

### E. Export XLSX
- Aggiungere all'oggetto `base` dell'ExportButton i nuovi campi pre-screening, lifestyle e garante.

## File coinvolti
- `src/pages/Candidatura.tsx`
- `src/pages/CandidaturaCompleta.tsx`
- `src/pages/admin/Candidature.tsx`
- `supabase/functions/get-completion-form/index.ts`

## Fuori scope
- Cambi DB / RLS (nessuno richiesto: i campi esistono già).
- Refactor visivo degli step pubblici.
- Traduzioni di etichette nuove nel form (le etichette interne admin sono solo IT come da memoria).
