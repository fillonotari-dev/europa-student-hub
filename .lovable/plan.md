## Cosa cambia

### 1. Template admin: solo nome + pulsante
File: `supabase/functions/_shared/email-templates/candidatura-nuova-admin.tsx`, `candidatura-completata-admin.tsx`

Riduco entrambi a:
- Frase di apertura ("È arrivata una nuova candidatura." / "Una candidatura è stata completata ed è pronta per la decisione.")
- Riga "Nome: {nome} {cognome}"
- Pulsante "Apri scheda nel gestionale"

Rimuovo: sede preferita, tipo camera, periodo richiesto, data. Aggiorno `previewData` nel registry di conseguenza (solo `nome`, `cognome`, `studenteId`). Le props inutili nei chiamanti (`submit-candidatura`, `complete-candidatura`) restano innocue ma le pulisco per non sporcare il payload.

### 2. Esito approvata senza nota
File: `supabase/functions/_shared/email-templates/candidatura-esito-approvata.tsx`

Rimuovo il blocco `notaAdmin` (titolo + testo + `Hr`), rimuovo la prop dalla firma e la voce `notaTitle` in `COPY`. Il footer generico resta.

File: `supabase/functions/send-esito-email/index.ts`

Non passo più `notaAdmin` al template. La UI admin può continuare a raccogliere la nota per uso interno (log/storico); non entra nella mail. Aggiorno anche `previewData` nel registry rimuovendo `notaAdmin`.

### 3. Contatti che non compaiono nelle mail al candidato
Causa: l'ultima modifica ha svuotato `CONTATTI_PREVIEW` nel registry (`{}`), quindi nel pannello **Cloud → Emails → App emails** l'anteprima mostra template senza recapiti. A runtime `getContatti` legge correttamente `impostazioni` (verificato: email + orari valorizzati) e `ContattiBlock` mostra solo i campi presenti — quindi le mail reali attualmente mostrano email + orari. Il problema segnalato è l'anteprima nel pannello.

Fix: rendo dinamica l'anteprima.

File: `supabase/functions/preview-transactional-email/index.ts`

Prima di iterare i template, leggo `impostazioni` con il service role e costruisco un `contatti` reale. Per ogni template che ha `contatti` nel proprio `previewData` (rilevabile via chiave presente), sostituisco quel campo con i contatti reali. Così l'anteprima nel pannello riflette esattamente ciò che riceve il candidato con le Impostazioni attuali (email + orari), senza inventare telefono/WhatsApp.

File: `supabase/functions/_shared/transactional-email-templates/registry.ts`

Aggiorno `previewData` dei template candidato lasciando `contatti: {}` come segnaposto (per far scattare l'override nel preview endpoint) e rimuovo campi ora non usati (`notaAdmin`, campi extra admin).

### Deploy
Al termine, deploy di: `send-transactional-email`, `preview-transactional-email`, `send-esito-email`, `submit-candidatura`, `complete-candidatura`.

## Note tecniche
- I template admin non usano `ContattiBlock`, quindi nessun impatto sui contatti nel loro caso.
- La nota della Direzione resta salvata nella tabella `log_stato_candidature` (o equivalente flusso attuale) — cambia solo la mail.
- Nessuna migrazione DB necessaria.