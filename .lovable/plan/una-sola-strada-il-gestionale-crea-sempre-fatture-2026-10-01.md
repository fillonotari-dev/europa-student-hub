# Una sola strada: il gestionale crea sempre fatture

Vocabolario in ogni testo: il gestionale CREA la fattura su Fatture in Cloud; l'EMISSIONE è la trasmissione allo SDI, manuale da FIC. Restano invariati: guardia doppioni (esisteFatturaDaRiconciliare), guardia fic_ei_metodo_pagamento, rifiutoDefinitivoFic, diagnostica 4xx, oggiRoma, scrittura in due fasi.

## 1. `_shared/fic-fattura.ts`
- Eliminati `TipoDocumento`, `tipoDocumentoDa`, `scrittureLocaliAttive`; `DatiFattura` perde `tipo`.
- Payload sempre `type: 'invoice'`, `e_invoice: true`, `ei_data` (payment_method + bank_iban solo se IBAN). Commenti aggiornati.
- `src/test/fic-fattura.test.ts`: tolti i test proforma/tipo; verificato type invoice, e_invoice, ei_data in ogni caso; invariante null/undefined verde. Test puri.

## 2. `fic-emetti-fattura/index.ts`
- Eliminati import dei tre simboli, `TIPO`, `SCRITTURE`, `passiSaltati`, `fic_emette_fatture` dalla select (riga 135) e ogni ramo che salta la scrittura locale. Due fasi come unico percorso, ordine e unica UPDATE su canoni invariati.
- Messaggi: "prima di emettere" -> "prima di creare la fattura"; "Non ripetere l'emissione" -> "Non ripetere la creazione"; per coerenza col vocabolario anche "emissione fermata" (riga 315), "prima dell'emissione" (340), "Fattura emessa e registrata" (474), "Fattura emessa su Fatture in Cloud" (482) diventano forme con "creare/creata". Lo stato DB `'emessa'` e il nome della funzione restano (identificatori, non testi).
- Ridistribuzione della funzione.

## 3. `src/pages/admin/Fatturazione.tsx`
- Rimossi query `['fatturazione-modo']`, `tipoDocumento`, etichetta condizionale, import di TipoDocumento.
- Testi fissi: "Crea le fatture selezionate"; "Esito della creazione: N riuscite"; aria-label "Seleziona tutte le pronte"; "Pronta" al posto di "Emettibile"; "Collega fattura esistente" (anche in `CollegaFatturaDialog.tsx`); pannello "Fatture create su Fatture in Cloud senza una mensilità collegata"; "Nessuna fattura creata".
- Riquadro informativo in due frasi: creata su FIC e modificabile lì finché non emessa (trasmessa allo SDI, da FIC); nel gestionale la mensilità passa subito a fatturato e non torna indietro (trg_canoni_protect_fatturati), quindi un errore si corregge su FIC.
- Elenco di ogni testo toccato con file e riga nel resoconto.

## 4. `EmettiFatturaDialog.tsx`
- Rimossi prop `tipoDocumento`, `Anteprima.tipo_documento` e rami relativi.
- Titolo "Crea 1 fattura su Fatture in Cloud" / "Crea N fatture su Fatture in Cloud"; descrizione senza "Modo in vigore"; pulsante "Conferma e crea"; avviso con la distinzione del punto 3 + frase SDI manuale.
- Tabella con due colonne in più per riga: Data documento e Scadenza pagamento (`data_emissione`, `scadenza`).
- Nome del file/componente invariato (identificatore).

## 5. `FattureInCloudSection.tsx`
- Rimosso l'interruttore "Emetti fatture reali" e `fic_emette_fatture` da tipo, VUOTE, select, setForm, patch.
- Testi: frase sola lettura -> "Il gestionale crea le fatture su Fatture in Cloud; l'emissione (trasmissione allo SDI) si fa da Fatture in Cloud"; "Da questa pagina non si crea nessun documento"; "la creazione si fermerà"; "Esiste già almeno una fattura creata".
- Nessun DROP COLUMN: `rg fic_emette_fatture src supabase/functions` (escluso types.ts autogenerato e migration) riportato nel resoconto a dimostrare che nessun file la legge.

## 6. Documentazione
- `docs/Context.md`: corrette le voci sul doppio modo (~145, ~340, ~363-364, ~374); regola del vocabolario crea/emetti scritta una volta; documentati gli interventi 30/09-01/10 (registra_fattura_esistente, fic-collega-fattura, esisteFatturaDaRiconciliare, rifiutoDefinitivoFic, diagnostica 4xx, oggiRoma, ei_data.payment_method/bank_iban, show_payment_method, IBAN sul PDF da ei_data, invalidazione fatturazione-canoni-collegati).
- `roadmap.md`: rimossa la voce 46cd973d (riga 3c1a1922 portata a errore il 30/09).
- File e riga per ogni modifica nel resoconto.

## Verifica
Test vitest, typecheck, build log, deploy fic-emetti-fattura, confronto col piano e scostamenti dichiarati. Nessuna migration, nessun dato modificato. Nessuna fattura reale creata dall'agente.

## Integrazioni approvate (01/10)
1. Dialogo: niente colonna data per riga; la riga riassuntiva "Data di emissione" diventa "Data del documento". Per riga solo la colonna "Scadenza del pagamento" da `dati.scadenza` dell'anteprima.
2. Fatturazione.tsx: via `passi_saltati` dal tipo Esito, `Riepilogo.passiSaltati` e il paragrafo "Passi saltati". fic-emetti-fattura: via `tipo_documento` e `scritture_locali` da risposta ed esiti.
3. Riquadro informativo neutro (`border-border bg-muted/40`), non destructive.
4. Vocabolario: "Non sarà più modificabile dopo la prima fattura creata" (FattureInCloudSection); IntestazioneFatturaDialog e ContrattoPage solo dove il senso è la creazione, con file/riga/prima/dopo. Commento di testata di fic-emetti-fattura aggiornato. "Giorno di emissione" NON toccato.
5. Resoconto: test prima/dopo (123 prima) ed esito di `rg -n "proforma|tipoDocumento|TipoDocumento|passiSaltati|fic_emette_fatture" src supabase/functions` escluso types.ts.

## Nota
In modalità piano è già stata applicata per errore una parte del punto 2 a `fic-emetti-fattura/index.ts` (rimozione di TIPO/SCRITTURE/passiSaltati, testi, testata): non ridistribuita. Resta da togliere `passi_saltati` dalla risposta finale; il resto si completa in modalità costruzione.
