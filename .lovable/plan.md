# Via le note: l'IBAN sul PDF viene da ei_data

Nota: il messaggio comincia col segnaposto «[Incolla qui le regole di lavoro]»: le regole incollate non sono arrivate. Applico le regole di lavoro già note (dichiarare i punti non implementati, nessun DROP, nessun dato toccato, citare gli ancoraggi).

## Stato verificato prima del piano
- `supabase/functions/_shared/fic-fattura.ts` righe 152–157: `iban` trimmato e `if (iban) data.notes = \`IBAN: ${iban}\`;` — da togliere. `iban` resta usato da `ei_data.bank_iban` (riga 161).
- `src/test/fic-fattura.test.ts` righe 228–240: test «con IBAN mette la nota "IBAN: ..."» e «senza IBAN nessuna chiave notes» — da sostituire.
- `src/pages/admin/Fatturazione.tsx`: `emetti` (righe 234–242) invalida `fatturazione-canoni`, `fatturazione-arretrati`, `fatturazione-fatture` ma NON `fatturazione-canoni-collegati`; `collegata` (riga 295) la invalida già.
- `docs/Context.md` riga 354: voce «IBAN sul documento» che descrive `notes` — da riscrivere.

## 1. `supabase/functions/_shared/fic-fattura.ts`
Tolto il blocco `if (iban) data.notes = ...`: il payload non ha mai `notes`, in nessun caso. Restano `show_payment_method: true`, `show_payments: true` e `ei_data.bank_iban` (solo invoice, solo quando l'IBAN è impostato). Aggiornato il commento del modulo: l'IBAN stampato sul PDF dal riquadro Modalità di pagamento viene da `ei_data.bank_iban` (stessa fonte dell'XML allo SDI, verificata sul PDF della fattura 8/S), non dai `details` del metodo né dalle note.

## 2. `src/test/fic-fattura.test.ts`
- Al posto dei due test su notes: «notes non è mai presente» con e senza IBAN, in proforma e invoice.
- `ei_data.bank_iban` presente solo con IBAN valorizzato: i test esistenti (righe 196–202) restano e coprono già il caso.
- L'invariante «nessun null o undefined» resta verde. Esito della suite riportato.

## 3. `src/pages/admin/Fatturazione.tsx`, fine di `emetti`
Aggiunta `qc.invalidateQueries({ queryKey: ['fatturazione-canoni-collegati'] })` nel `finally` (righe 239–241), come già fa `collegata` (riga 295): senza, una fattura appena creata compare nel pannello Da riconciliare finché la pagina non viene ricaricata.

## 4. `docs/Context.md` (riga 354)
Voce «IBAN sul documento» riscritta: niente `notes`; l'IBAN sul PDF arriva da `ei_data.bank_iban` col riquadro Modalità di pagamento stampato da `show_payment_method`; `fic-registri` continua a restituire `dettagli_titoli` (sola lettura, resta). Aggiornamento anche della voce `salvato` in fic_log se cita `notes_presenti` — controllo e, se tocca, corrispondo al codice reale.

## Verifica
Typecheck (`tsgo --noEmit -p tsconfig.app.json`), suite Vitest con esito riportato, registro build in /tmp/observability, deploy di `fic-emetti-fattura` (il modulo condiviso è incorporato nella funzione), confronto finale col piano.

## Dichiarato fuori perimetro
Nessun documento emesso; `fic_log.notes_presenti` nella funzione resta (dirà sempre «no») e non lo tocco se non dove il punto 4 lo richiede; `fic-registri` intatto.
