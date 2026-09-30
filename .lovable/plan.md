# PDF della fattura con modalità di pagamento, scadenza e IBAN

## Stato verificato prima del piano
`fic-registri/index.ts` (righe 136-141) legge `/info/payment_methods` ma conserva solo `id` e `name`: i `details` vengono scartati. Oggi quindi non è possibile sapere, dal gestionale, se il metodo scelto contiene l'IBAN. Il punto 2 richiede prima una piccola modifica di lettura.

## 1. Flag di stampa (`_shared/fic-fattura.ts`)
Il payload include sempre `show_payment_method: true` e `show_payments: true`, su proforma e fattura.

## 2. Verifica dei details del metodo di pagamento
- In `fic-registri`, nella mappatura dei metodi, aggiungo `dettagli_titoli`: l'elenco dei soli `details[].title` (mai `description`, che contiene l'IBAN). Solo GET, nessuna scrittura su FIC, nessun valore personale nel log.
- Ridistribuisco `fic-registri`, la chiamo e riporto nel resoconto i titoli dei details del metodo con id = `fic_metodo_pagamento_id` (letto da `impostazioni`).
- Esito A: fra i titoli c'è l'IBAN -> nessuna nota, lo dichiaro; FIC lo stampa grazie a `show_payment_method`.
- Esito B: l'IBAN non c'è -> si applica il punto 3.

## 3. Nota IBAN (solo con esito B)
`DatiFattura` usa l'`iban` già presente: se valorizzato (dopo trim) `notes = "IBAN: <iban>"`, altrimenti nessuna chiave `notes`. Vale per proforma e fattura. Con esito A questo punto non si implementa e lo dichiaro.

## 4. Log dopo POST riuscito (`fic-emetti-fattura`)
Nel blocco `salvato` (riga ~415): `show_payment_method` letto dalla risposta, `notes_presenti` sì/no calcolato dalla risposta, mai il testo. Ridistribuzione di `fic-emetti-fattura`.

## 5. Test (`src/test/fic-fattura.test.ts`)
- i due flag presenti e `true` in proforma e invoice;
- esito B: `notes` = "IBAN: IT60..." con IBAN, assente con null/undefined/''/spazi; esito A: `notes` mai presente;
- l'invariante "nessun null o undefined" resta verde.
Esito della suite riportato col numero dei test.

## Verifica
Typecheck, Vitest, registro build, deploy delle due funzioni, aggiornamento `docs/Context.md` (voce payload FIC) e `roadmap.md`, confronto finale col piano.

## Fuori perimetro
Nessuna emissione reale; la conferma sul PDF sarà la prossima fattura emessa dall'operatore. Nessuna migration. `fic-sync-anagrafica` non toccata.
