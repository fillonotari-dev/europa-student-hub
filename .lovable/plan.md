# Allineamento form candidatura al PDF cliente

Riportare i form pubblici esattamente ai campi del PDF di riferimento, mantenendo separazione tra primo invio (blocchi 1, 2, 3, 6, 7) e completamento (blocchi 4, 5 e ripetizione 6/7 ove serve).

## Mappa finale dei campi

### Primo form pubblico — `/candidatura`
5 step (lo step "Info aggiuntive" appare solo se l'admin attiva campi custom).

1. **Dati personali** (blocco 1) — nome, cognome, data di nascita, nazionalità, codice fiscale, **numero documento identità** (obbligatorio), telefono, email, indirizzo di residenza.
2. **Percorso universitario** (blocco 2) — università/istituto, corso di studi, anno di corso, tipo studente (universitario/erasmus/master/altro+testo), periodo permanenza (dal/al), **data arrivo prevista** (spostata qui dal vecchio step Preferenze).
3. **Preferenze alloggio** (blocco 3) — struttura preferita, tipo camera, preferenze/esigenze particolari (textarea), come ci hai conosciuto.
4. **Documenti** (blocco 6) — Documento identità (obbligatorio), Documentazione universitaria/iscrizione (obbligatoria), Documento garante (opzionale), Ulteriore documentazione (opzionale).
5. **Dichiarazioni** (blocco 7) — 4 checkbox: veridicità, privacy, info struttura, **contatto Direzione** (nuova).
6. *Info aggiuntive* — solo se ci sono campi/documenti custom attivi.
7. **Riepilogo** finale.

**Rimossi dal primo form**: matricola, dipartimento, anno accademico, messaggio libero (non presenti nel PDF). Sezione "Documenti" non avrà più il textarea "messaggio".

### Form di completamento — `/candidatura/completa/:token`
Resta uguale alla struttura attuale ma allineato:
1. **Stile di vita** (blocco 4) — invariato.
2. **Garante** (blocco 5) — invariato.
3. **Documenti aggiuntivi** — solo se mancano dal primo invio (doc garante / ulteriore); altrimenti step saltato automaticamente. Il doc identità non si ricarica.
4. **Dichiarazioni** — ripetute (le 4 del blocco 7), come richiesto.
5. Riepilogo.

## Modifiche tecniche

### `src/pages/Candidatura.tsx`
- Rimuovere dallo state e dalla UI: `dipartimento`, `matricola`, `anno_accademico`, `messaggio`.
- Spostare `data_arrivo_prevista` dallo step Preferenze allo step Academic.
- Rimuovere componenti `DipartimentoField`, `CorsoField` dipartimento-aware → sostituire `CorsoField` con un input testo (o combobox università → corso saltando il dipartimento). Decisione: input testo libero per corso, per fedeltà al PDF e meno friction.
- `validateStep`: aggiornare `requiredByKey` rimuovendo i campi tolti; `documento_identita` + `certificato_iscrizione` restano obbligatori; aggiungere checkbox `contatto` alle dichiarazioni.
- Aggiungere campi opzionali file `documento_garante` e `documento_aggiuntivo` nello step Documenti.
- Step `stepReview`: aggiornare le sezioni mostrate.

### `src/pages/CandidaturaCompleta.tsx`
- Lifestyle e Garante invariati.
- Step `stepDocAggiuntivi`: caricare solo se i corrispondenti documenti non sono già presenti per la candidatura (query a `documenti` via edge function `get-completion-form` esistente — vedi sotto).
- Dichiarazioni: invariate (già 4).

### `src/i18n/translations.ts`
- Rimuovere/non più usate: `dipartimento`, `matricola`, `annoAccademico`, `annoAccademicoHint`, `messaggio*`, `selectDipartimento`.
- Aggiungere: nessun nuovo testo (le 4 dichiarazioni esistono già).

### Edge functions
- `submit-candidatura/index.ts`: rimuovere validazione/persistenza di `dipartimento`, `matricola`, `anno_accademico`, `messaggio` dal payload (mantenere nullable lato DB per dati storici).
- `get-completion-form/index.ts`: estendere la risposta con `documenti_presenti: { documento_garante: bool, documento_aggiuntivo: bool }` così il form di completamento sa quali upload mostrare.
- `complete-candidatura/index.ts`: invariato lato logica documenti; accetta `dichiarazioni` (già fa).

### Database
- **Nessuna migrazione schema**: i campi `matricola_snapshot`, `corso_snapshot`, `anno_corso_snapshot`, `messaggio` su `candidature` restano per i record storici; nuovi inserimenti li lasciano `null`.
- Admin `Candidature.tsx` e `Residenti.tsx`: i campi rimossi continuano a mostrarsi se presenti su record vecchi, ma il default per nuove righe sarà `—`.

### ConfigForm (campi custom)
- Nessuna modifica funzionale: i campi custom restano disponibili. Documentare nel testo introduttivo della pagina che, attivandoli, compariranno come step aggiuntivo nel form pubblico.

## Cose NON incluse
- Refactor visual del form (resta lo stesso layout/componenti).
- Modifica del flusso admin di revisione candidature.
- Cleanup dei dati storici sulle vecchie candidature.

## File da toccare
- `src/pages/Candidatura.tsx`
- `src/pages/CandidaturaCompleta.tsx`
- `src/i18n/translations.ts`
- `supabase/functions/submit-candidatura/index.ts`
- `supabase/functions/get-completion-form/index.ts`
