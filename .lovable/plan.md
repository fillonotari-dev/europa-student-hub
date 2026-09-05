# 400/422 Fatture in Cloud: registrare la spiegazione del rifiuto

## Problema

Quando Fatture in Cloud risponde 400 o 422, `fic-sync-anagrafica` e
`fic-test-connection` scartano `lastBody`, l'unico posto dove l'API spiega cosa
ha rifiutato. L'operatore vede un messaggio generico e il registro `fic_log` non
dice il motivo: la riparazione richiede tentativi alla cieca.

## Soluzione

Nel ramo `!res.ok` per status 400/422, fare il parse di `lastBody` (in
`try/catch`: la risposta potrebbe non essere JSON) ed estrarre **solo**:

- `error.message`
- `error.validation_result`

che vengono aggiunti al `payload_ridotto` scritto in `fic_log`, insieme a:

- `campi_inviati`: l'elenco delle **chiavi** del payload spedito
  (`Object.keys(mappatura.data)` nella sync; assente nella test-connection,
  che è una GET senza body) — solo nomi, mai valori.

Non viene mai copiato il corpo grezzo della risposta né il payload inviato:
contengono dati personali dell'intestatario. Il messaggio mostrato
all'operatore resta generico come oggi; la spiegazione vive solo nel registro.

### Struttura del payload_ridotto nel ramo 400/422

```json
{
  "anagrafica_id": "...",
  "campi_inviati": ["type", "name", "tax_code", "address_street", "..."],
  "fic_error_message": "...",
  "fic_validation_result": { "...": "..." },
  "quota_ora": "...", "quota_mese": "..."
}
```

Chiavi assenti se il parse fallisce o i campi non esistono nella risposta.

## File toccati

1. `supabase/functions/fic-sync-anagrafica/index.ts` — ramo 400/422: parse di
   `lastBody`, estrazione di `error.message` e `error.validation_result`,
   `campi_inviati` da `mappatura.data`; messaggio operatore invariato.
2. `supabase/functions/fic-test-connection/index.ts` — stessa estrazione nel
   ramo 400/422 per uniformità (nessun `campi_inviati`: è una GET).
3. `docs/Context.md` — una riga: gli errori 400/422 FIC vengono registrati in
   `fic_log` con messaggio e risultato di validazione; nota per
   **fic-emetti-fattura** (D2) di adottare lo stesso meccanismo, perché lì un
   422 senza spiegazione bloccherebbe un'emissione senza modo di ripararla.

## Non toccato

- La mappatura (`_shared/fic-anagrafica.ts`): nessuna modifica finché non
  sappiamo cosa contesta FIC. Verificato che `ClientType` ammette `company` e
  `person` e che tutte le proprietà di `Client` sono nullable: `type` non è il
  problema.
- Nessuna migration, nessuna modifica ai dati, nessun cambiamento dei messaggi
  mostrati all'operatore.
- Deploy delle due funzioni aggiornate.

## Verifica

- Typecheck.
- Test reale: risincronizzare l'anagrafica che ha ricevuto 422 e leggere la
  nuova riga in `fic_log` con la spiegazione.
