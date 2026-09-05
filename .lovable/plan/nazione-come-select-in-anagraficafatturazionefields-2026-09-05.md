# Nazione come Select in AnagraficaFatturazioneFields

## Contesto
`indirizzo_nazione` decide la mappatura estera (`isUe`, `tax_code` svuotato, `OO99999999999`), l'appartenenza UE e il codice destinatario proposto. Oggi è un Input libero di 2 caratteri: un refuso tra due codici validi (es. `IE` per `IT`) passa ogni validazione e produce una fattura formalmente valida e sostanzialmente sbagliata, senza alcun errore.

## Verifica preliminare (già eseguita)
- Tutti i 27 codici di `EU_COUNTRY_CODES` (`supabase/functions/_shared/fic-anagrafica.ts:25-28`) sono presenti in `COUNTRIES` (`supabase/functions/_shared/countries.ts`): il Select non renderà irraggiungibile alcun ramo della mappatura.
- `AggiungiPersonaDialog.tsx` (righe 230-236) usa già il pattern di riferimento: `Select` popolato da `COUNTRIES` con `c.it` come etichetta.

## Modifica
In `src/components/admin/contratti/AnagraficaFatturazioneFields.tsx` (riga 190), il campo **Nazione**:

1. Sostituire l'`Input` con lo stesso `Select` di `AggiungiPersonaDialog`: opzioni da `COUNTRIES` (`@shared/countries`), etichetta `c.it`, valore `c.code`.
2. Al cambio nazione, comportarsi come `AggiungiPersonaDialog`: azzerare `indirizzo_provincia` (una provincia italiana non ha senso su nazione estera, e viceversa). Il codice destinatario viene già riproposto automaticamente dall'`useEffect` esistente su `codiceDestinatarioProposto` (righe 131-139) — nessuna modifica lì.
3. Il componente è condiviso da `ContrattoDialog` e `IntestazioneFatturaDialog`: la modifica vale per entrambi senza toccare i chiamanti.
4. Valori legacy: le righe esistenti hanno codici ISO a 2 lettere maiuscole, tutti coperti da `COUNTRIES`; nessuna migrazione dati necessaria. Se una riga avesse un codice assente dall'elenco, il Select mostrerebbe il placeholder invece di un valore falso — comportamento accettabile e visibile, dichiarato qui.

## Fuori scope
- Nessuna modifica a database, edge function, mappatura FIC o validazioni server.
- Il campo Provincia resta com'è (Input a 2 caratteri): non richiesto dalla segnalazione.

## Verifica
- `tsc` pulito.
- Test manuali sul dialogo: cambio nazione → provincia azzerata e codice destinatario riproposto; apertura su anagrafica esistente → nazione corretta selezionata.
- Riporto l'esito dei controlli eseguiti.
