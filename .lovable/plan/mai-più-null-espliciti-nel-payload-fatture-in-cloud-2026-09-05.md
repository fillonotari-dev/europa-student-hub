# Mai più `null` espliciti nel payload Fatture in Cloud

## Obiettivo

Fatture in Cloud rifiuta con 422 (`must be a string`) qualunque proprietà stringa inviata come `null` esplicito — verificato sul campo con `certified_email` e `vat_number`, ma la regola vale per **ogni** campo stringa del payload. Senza la correzione fallirebbero tutte le anagrafiche estere (la mappatura azzera `tax_code` di proposito) e tutte le società (`first_name`/`last_name` nulli). La correzione è: **stringa vuota `""` invece di `null`**, non omissione della chiave — su un PUT una chiave assente significa "lascia com'era" e non permetterebbe mai di svuotare un campo (svuotare `tax_code` è esattamente ciò che la mappatura estera deve fare). `""` soddisfa il validatore ed esprime lo svuotamento.

## Modifiche

### 1. `supabase/functions/_shared/fic-anagrafica.ts` — mappatura

- `ClientePayloadFic`: i campi oggi `string | null` (`first_name`, `last_name`, `tax_code`, `vat_number`, `address_street`, `address_postal_code`, `address_city`, `address_province`, `certified_email`, `email`) diventano `string`. Restano `string` anche `type`, `name`, `country_iso`, `ei_code`.
- In `mappaAnagraficaPerFic` la funzione `nz` viene sostituita dalla normalizzazione a stringa vuota: valore assente → `""`, mai `null`. I valori speciali restano invariati: `tax_code = ""` per l'estero, CAP `00000`, provincia `EE`, `vat_number = TAX_ID_EXTRA_UE` per Extra-UE, `vat_number = ""` per UE senza identificativo.
- **`ei_code`**: oggi è `(nz(codice_destinatario) ?? codiceDestinatarioProposto(nazione))`, e `??` ricade solo su `null`/`undefined`. Con la nuova normalizzazione la stringa vuota passerebbe il `??` e si spedirebbe un `ei_code` vuoto, non ammesso sulla fattura elettronica. Il ripiego diventa sul **valore vuoto** (`||` o controllo esplicito sulla stringa non vuota). Verificato con `grep '??'` sul modulo: `ei_code` è l'**unica** occorrenza dello schema `x ?? fallback`; l'altro fallback presente, `s(a.indirizzo_nazione) || 'IT'` in `nazioneDi`, usa già `||` e resta corretto.
- Commento nel modulo che fissa la regola: nessun `null` esplicito verso FIC; `""` svuota il campo anche in PUT. Se in futuro FIC rifiutasse `""` su un campo specifico, per quel campo si ripiega sull'omissione della chiave dichiarandolo nel commento.
- Le soglie (`baseCampiMancantiPerFic`) leggono l'anagrafica DB, non il payload: invariate.


### 2. Test — `src/test/fic-anagrafica.test.ts`

- Adeguare le asserzioni esistenti che oggi attendono `toBeNull()`: `tax_code` estera → `toBe('')`, `vat_number` UE senza identificativo → `toBe('')`.
- Due test su `ei_code` senza codice destinatario: `0000000` per l'Italia, `XXXXXXX` per l'estero.
- Nuovo test di invariante (una sola asserzione che chiude l'intera classe): per un'anagrafica italiana, una estera e una di società, **nessuna proprietà del payload è `null` né `undefined`** — `undefined` va escluso perché `JSON.stringify` elimina quelle proprietà, reintroducendo di nascosto l'omissione della chiave (e quindi il "lascia com'era" su PUT) mentre l'invariante passerebbe:
  ```ts
  for (const a of [baseItalia, baseEstera, baseSocieta]) {
    const { data } = mappaAnagraficaPerFic(a);
    expect(Object.values(data).some(v => v == null)).toBe(false);
  }
  ```


### 3. Documentazione — `docs/Context.md`

Nella sezione FIC: la regola "nessun `null` esplicito, stringa vuota per svuotare", con l'ancoraggio (422 `must be a string` su `certified_email`/`vat_number`, riga `fic_log` del test reale) e il vincolo per D2: `fic-emetti-fattura` eredita la stessa mappatura, nessuna riconversione.

## Verifica

1. `vitest run` — suite completa verde (47 test + adeguamenti + invariante).
2. `tsgo` typecheck pulito.
3. Redeploy di `fic-sync-anagrafica` (importa il modulo condiviso).
4. Test reale: risincronizzare l'anagrafica `9ab3af35-…` che ha fallito con 422; atteso HTTP 200 e riga `fic_log` con `risultato = ok`.

## Confini

- Nessuna migration, nessuna modifica DB o ai dati esistenti.
- Nessuna creazione/modifica di documenti fiscali.
- La diagnostica `campi_inviati` introdotta nel giro precedente (nomi dei campi valorizzati) resta valida: con la nuova mappatura i campi "valorizzati" sono quelli con stringa non vuota.
