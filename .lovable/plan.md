# Partita IVA extra-UE e sblocco di «Annulla assegnazione»

Due correzioni indipendenti. Nessuna migration, nessuna modifica al database o ai dati, nessuna chiamata reale a Fatture in Cloud.

## 1. Partita IVA degli extra-UE

**Perché:** Fatture in Cloud rifiuta con 409 un secondo cliente con la stessa partita IVA, quindi dal secondo studente extra-UE la sincronizzazione fallisce sempre. Verificato a mano che un cliente estero senza partita IVA viene salvato senza problemi.

**Modifica in `supabase/functions/_shared/fic-anagrafica.ts`** (`mappaAnagraficaPerFic`, righe 163-171):

- Tolta la costante `TAX_ID_EXTRA_UE` (`'OO99999999999'`, righe 29-31) e il ramo `!isUe(nazione)` che la inviava.
- Nuova regola, uguale per UE ed extra-UE: se la partita IVA è compilata si invia (nota «identificativo estero inviato nel campo partita IVA (…)»), altrimenti il campo parte vuoto con la sola nota **«partita IVA non inviata»** — senza affermazioni su cosa farà Fatture in Cloud (l'attuale nota «Fatture in Cloud scrive codice paese ed ESTERO», riga 170, sparisce).
- Se dopo la modifica `isUe` non ha più usi, viene rimossa; altrimenti resta.
- Commento di `baseCampiMancantiPerFic` (riga 70) adeguato per coerenza.
- Invariati: CAP 00000, provincia EE, codice destinatario XXXXXXX, codice fiscale omesso per le estere.

**Test in `src/test/fic-anagrafica.test.ts`:**

- Il test «usa la partita IVA convenzionale per un paese Extra-UE» (righe 71-74) diventa: paese extra-UE senza partita IVA → `vat_number === ''`; con partita IVA compilata → inviata.
- Tolto l'import di `TAX_ID_EXTRA_UE`.

**Ridistribuzione** delle edge function che importano il modulo: `fic-sync-anagrafica` e `fic-emetti-fattura`.

**Documentazione:** `docs/Context.md` riga 386 cita ancora `OO99999999999` per gli extra-UE — va aggiornata alla nuova regola. Verifica con `rg` che il codice convenzionale non compaia altrove.

## 2. Annulla assegnazione

**Perché:** da P12 la bozza di contratto referenzia l'assegnazione (`contratti_assegnazione_id_fkey`) e la cancellazione fallisce con l'errore del vincolo.

**Modifica in `src/hooks/useCandidaturaActions.tsx`**, mutazione `annullaAssegnazione` (righe 124-166): dopo il controllo «soggiorno già iniziato» (resta com'è) e prima di eliminare l'assegnazione:

1. Lettura dei contratti collegati all'assegnazione (`id`, `stato`, `file_firmato_path`).
2. Se anche un solo contratto **non è in bozza**: nessuna eliminazione e messaggio comprensibile, distinto per stato (mai suggerire di chiudere il contratto: un contratto chiuso resta collegato all'assegnazione e non può più tornare in bozza, quindi l'annullamento resterebbe bloccato per sempre):
   - contratto **attivo** → «C'è un contratto attivo collegato a questa assegnazione: riportalo in bozza dalla pagina del contratto, poi riprova.»
   - contratto in uno **stato di chiusura** (risolto, scaduto, rinnovato) → «Questa assegnazione non può essere annullata perché ha un contratto già chiuso.»
3. Se ci sono solo **bozze**: eliminate una a una con `eliminaContrattoBozza` (`src/lib/contrattoDelete.ts`), la stessa regola già usata per eliminare una bozza — prima il PDF firmato dallo storage, poi la riga; se lo storage fallisce ci si ferma. I canoni spariscono in cascata.
4. Poi eliminazione dell'assegnazione e ritorno della candidatura allo stato di oggi (`statoDopoAnnullamento`), invariato.

**Dialogo di conferma** (righe 777-800): il testo dice che insieme all'assegnazione verrà eliminata anche la bozza di contratto collegata.

**Cache:** `onSuccess` invalida anche `['contratti']`, `['assegnazioni-senza-contratto']` e `['studente-contratti']` (oggi `invalidateAll` non le copre), così l'avviso «bozze mancanti» e l'elenco contratti si aggiornano.

**Dichiarazione esplicita:** per il punto 2 non aggiungo test unitari — la logica è orchestrazione di chiamate al database dentro la mutazione, non una funzione pura. I test nuovi riguardano solo il punto 1.

## Verifica finale

- `vitest` su tutta la suite e typecheck.
- Deploy di `fic-sync-anagrafica` e `fic-emetti-fattura`.
- Resoconto con l'elenco dei file toccati e l'esito dei test.
- Nessuna prova che scriva sui dati: «Annulla assegnazione» non viene premuto nel browser; la prima prova vera è la vostra.
