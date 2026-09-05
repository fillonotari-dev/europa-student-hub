# Allineare annulla assegnazione e assegna al percorso manuale

Nessuna modifica al database. Solo `src/hooks/useCandidaturaActions.tsx` e il file di test.

## Verifiche fatte prima di scrivere il piano

- `annullaAssegnazione` (righe 121-161 di `src/hooks/useCandidaturaActions.tsx`) scrive sempre `stato: 'da_decidere'` insieme a `esito_email_inviata_il: null, esito_email_nota: null`; il toast di successo dice «La candidatura torna in "Da decidere"» e il testo dell'AlertDialog (riga 765) ripete la stessa frase.
- `assegnaSoggiorno` (righe 339-420) invoca `send-esito-email` solo per `mode === 'assegna'`; il toast finale dichiara «Email di esito inviata» oppure segnala il fallimento con variante `destructive`.
- Punto 4 — dove viene costruito l'oggetto `CandidaturaLike`, con esito della verifica:
  1. `src/pages/admin/Residenti.tsx:90` `toCandidaturaLike` — `origine: r.origine` presente (riga 95).
  2. `src/pages/admin/Candidature.tsx:28` `toCandidaturaLike` — `origine: r.origine` presente (riga 34).
  3. `src/pages/admin/StudentePage.tsx:131` — la candidatura arriva da `select('*, strutture(nome)')` ed è propagata con spread, quindi `origine` è presente; `candRifDecorata` (riga 182) fa spread di `candRif`, non lo perde.
  Nessun altro punto monta `CandidaturaActions` o chiama `trigger` (verificato con ricerca su tutto `src/`). `origine` è quindi sempre valorizzato nei tre percorsi; nessuna guardia silenziosa.
- `src/lib/studentiQuery.ts` legge `origine` fra le colonne di `candidature` (riga 52) e lo espone su `StadioRow`.

## Cosa faremo

### 1. Annulla assegnazione: stato derivato dall'origine
Nella mutazione, lo stato di ritorno diventa `in_attesa_posto` quando `c.origine === 'inserimento_manuale'`, altrimenti resta `da_decidere` — stessa regola già applicata alla creazione manuale.
Il toast di successo riporta lo stato effettivamente scritto: «La candidatura torna in "Lista d'attesa".» oppure «La candidatura torna in "Da decidere".»
Anche il testo dell'AlertDialog di conferma (riga 765) diventa dipendente dall'origine del target, così l'operatore legge la conseguenza reale prima di confermare.

### 2. Azzeramento dei campi esito
`esito_email_inviata_il` e `esito_email_nota` continuano a essere azzerati per tutti i percorsi. Dichiarazione: per un inserimento manuale sono già nulli (la funzione `crea_persona_manuale` non li scrive e `send-esito-email` non è mai stata invocata per queste candidature), quindi l'`UPDATE` li riscrive con lo stesso valore `null`. Nessun effetto collaterale, nessun trigger su quelle colonne, nessuna riga di log generata. Il codice resta invariato su questo punto.

### 3. Assegna: niente email per gli inserimenti manuali
La chiamata a `send-esito-email` avviene solo se `mode === 'assegna'` **e** `c.origine !== 'inserimento_manuale'`. Il risultato della mutazione distingue tre casi (email inviata, invio fallito, invio non previsto) così il toast può dire: «Nessuna email inviata: la persona è stata inserita dall'amministrazione.» In questo caso il toast non è `destructive`: l'assegnazione è riuscita.

### 4. Test
`src/test/candidatura-actions.test.ts` copre oggi solo `getAvailableActions`, funzione pura. Aggiungiamo:
- una piccola funzione pura esportata da `src/lib/candidaturaActions.ts` — `statoDopoAnnullamento(origine)` — usata dalla mutazione e testata direttamente (`inserimento_manuale` → `in_attesa_posto`, `form_pubblico`/`undefined` → `da_decidere`);
- una guardia pura `deveInviareEsito(mode, origine)` con lo stesso trattamento, testata sui casi assegna/rinnova/nuovo × manuale/pubblico;
- i casi già esistenti su `invia_esito` escluso per origine manuale, se non coperti.
Eseguiamo la suite e riportiamo l'esito.

## Fuori perimetro
Nessuna migration, nessuna modifica a edge function, nessuna voce nuova in Dashboard.
