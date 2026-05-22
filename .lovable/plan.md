# Modifiche al form di candidatura

## 1. Bug invio candidatura — root cause

L'errore `400: "Tipo documento non riconosciuto"` arriva dalla edge function `upload-candidatura-doc`. Accetta come `tipo` solo `documento_identita` e `certificato_iscrizione` (set `FIXED_TIPI`), oppure chiavi presenti in `form_documenti_custom` con `attivo=true`.

Nel nuovo step Documenti (allineato al PDF) il form carica anche:
- `documento_garante` (opzionale)
- `documento_aggiuntivo` (opzionale)

Queste due chiavi non sono nei fissi né nei custom → upload rifiutato → submit fallisce.

**Fix**: aggiungere `documento_garante` e `documento_aggiuntivo` al set `FIXED_TIPI` in `supabase/functions/upload-candidatura-doc/index.ts`. Nessun altro cambio backend serve (sono già gestite come tipi documento generici lato DB).

## 2. Rimozione step Riepilogo

Oggi gli step finali sono `... → stepDichiarazioni → stepReview` (con eventuale `stepInfoAggiuntive` prima del review). Il riepilogo non mostra tutti i campi nuovi del PDF (residenza, doc identità n., tipo studente, dichiarazioni, ecc.) e duplica solo parzialmente le informazioni.

**Modifica in `src/pages/Candidatura.tsx`**:
- Rimuovere `'stepReview'` da `STEPS` (sia ramo con che senza info extra). Ultimo step diventa `stepDichiarazioni` (o `stepInfoAggiuntive` se attivo, poi `stepDichiarazioni`).
- Rimuovere il blocco JSX `{stepKey === 'stepReview' && (...)}` e i relativi `ReviewSection`.
- Eliminare la funzione `ReviewSection` (non più usata).
- Nello step `stepDichiarazioni`: il pulsante finale diventa "Invia candidatura" (`form.submit`) che chiama direttamente `handleSubmit`, al posto di "Avanti". La logica di navigazione (`if (step < STEPS.length - 1) ...`) gestisce già il caso "ultimo step → submit", basta che `stepDichiarazioni` sia l'ultimo.
- Schermata di successo: già esiste (`success` state con messaggio di conferma). Verificare che il messaggio sia chiaro ("Candidatura inviata correttamente"); altrimenti adeguare la copy.

## 3. File modificati
- `supabase/functions/upload-candidatura-doc/index.ts` — aggiungere le 2 chiavi a `FIXED_TIPI`.
- `src/pages/Candidatura.tsx` — rimuovere step riepilogo + ReviewSection, garantire CTA finale "Invia candidatura" su Dichiarazioni.

## Fuori scope
- Modifiche admin / DB / traduzioni oltre quelle strettamente necessarie.
- Refactor visivo degli step.
