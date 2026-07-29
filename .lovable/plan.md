## Problema
Nel form pubblico di candidatura (`src/pages/Candidatura.tsx`), quando l'utente seleziona una nazione di residenza diversa da Italia:
- il campo Provincia viene svuotato e disabilitato (comportamento corretto);
- ma resta nell'elenco dei campi obbligatori di `validateStep`, quindi il form blocca il "Continua" senza mostrare un errore utile.

Il server è già coerente: `submit-candidatura` richiede la provincia solo se `nazione === 'IT'`.

## Fix
`src/pages/Candidatura.tsx`, funzione `validateStep` (righe ~173-185):

Rendere `indirizzo_provincia` condizionalmente obbligatorio invece di sempre obbligatorio. Costruire l'array `stepPersonal` in modo dinamico:

- Includere `indirizzo_provincia` solo quando `form.indirizzo_nazione === 'IT'`.
- Tutti gli altri campi restano invariati.

Nessuna altra modifica: la UI già disabilita il campo e lo resetta al cambio nazione (righe 580-591), e il server già accetta provincia nulla per nazioni non-IT.

## Verifica
- Selezionare una nazione diversa da IT nel blocco residenza → il tasto "Continua" deve procedere senza errore "campo obbligatorio".
- Selezionare Italia → provincia torna richiesta (asterisco + blocco avanzamento se vuota).
- Invio finale di una candidatura con nazione estera → accettato dal server, salvato con `indirizzo_provincia = null`.
