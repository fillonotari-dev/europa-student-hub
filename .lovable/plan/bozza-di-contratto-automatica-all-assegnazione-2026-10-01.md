# Bozza di contratto automatica all'assegnazione

## Decisioni prese
- Listino mancante: la bozza nasce con canone 0 (il vincolo NOT NULL su contratti.canone_mensile resta). La scheda mostra «Canone da inserire» e l'attivazione è bloccata finché il canone vale 0.
- Studente senza intestazione: creo un'intestazione intestata allo studente con i dati della sua scheda, come fa già ContrattoDialog quando salva (ContrattoDialog.tsx:336-343).

## 1. Modulo condiviso di precompilazione
- Nuovo `src/lib/precompilaContratto.ts`:
  - funzioni pure: `scegliAssegnazione` (stessa regola di ContrattoDialog.tsx:119-121), `campiDaAssegnazione`, `garanteDaCandidatura`, `canoneDaListino` (lordo oppure 0 con `listinoMancante: true`);
  - funzione asincrona `caricaPrecompilazione(studenteId, assegnazioneId?)`, con le stesse letture di ContrattoDialog.tsx:101-115 e 216-227.
- ContrattoDialog usa il modulo al posto della logica che ha dentro (righe 96-246). Il comportamento resta identico, sostituzione compresa.
- `creaBozzaDaAssegnazione(assegnazioneId)`: se esiste già un contratto (bozza o attivo) con quell'`assegnazione_id`, non fa nulla. Altrimenti crea l'intestazione quando manca e inserisce il contratto in stato bozza (giorno di scadenza 1, aliquota 10, come i valori predefiniti del dialogo). Non attiva mai il contratto.
- Test puri in `src/test/precompila-contratto.test.ts`.

## 2. Aggancio ad assegna e inserimento manuale
- In useCandidaturaActions.tsx, dopo che l'assegnazione è stata inserita (riga ~384, modo assegna): chiamo `creaBozzaDaAssegnazione`. Se fallisce, l'assegnazione resta valida e compare un avviso.
- In AggiungiPersonaDialog, dopo `crea_persona_manuale`, quando c'è un'assegnazione.
- Dialogo di esito: «Bozza di contratto creata», con i pulsanti «Verifica e attiva il contratto» (porta alla pagina del contratto) e «Più tardi».

## 3. Avviso nella scheda del residente
- In StudentePage, in testa: un avviso fisso quando la persona ha un'assegnazione attiva ma nessun contratto attivo. Il pulsante dice «Crea il contratto» (apre ContrattoDialog) se non c'è nemmeno una bozza, «Verifica e attiva» se la bozza c'è.

## 4. Pagina contratto in bozza = schermata di verifica
- In testa i fatti chiave: persona, periodo, sede e camera, canone lordo con l'indicazione «da listino», «personalizzato» o «canone da inserire», deposito, intestazione della fattura.
- Sotto, lo scadenzario proposto (l'anteprima attuale), modificabile riga per riga. Il primo e l'ultimo mese portano il segno «mese parziale: correggi l'importo» quando non sono interi, calcolato con coperturaMese.
- Il controllo dell'intestazione riusa campiMancantiPerFattura così com'è. Se manca qualcosa, compare «La fattura verrà rifiutata finché: …» con il link «Modifica intestazione». L'attivazione resta comunque permessa.
- Conferma dell'attivazione: quando il canone è diverso dal listino, compare «Canone personalizzato: X € (listino Y €)» e la nota sul canone diventa obbligatoria se è vuota (viene salvata in canone_note prima della chiamata alla RPC). La RPC attiva_contratto non cambia.

## 5. Documentazione
- docs/Context.md: ciclo di vita del contratto (la bozza nasce con l'assegnazione, l'attivazione resta manuale), con file e riga.
- docs/design-system.md: il nuovo avviso fisso in testa alla scheda, se diventa un pattern nuovo.
- roadmap.md.

## Note e scostamenti
- Una correzione al contesto: campiMancantiPerFattura è già usata anche nel modulo dell'intestazione (AnagraficaFatturazioneFields.tsx:144), non solo nell'anteprima di Fatturazione.
- «Canone nullo» diventa «canone 0», per la tua scelta.
- Nessuna migration, nessuna modifica alla RPC, nessuna prova che scriva sui dati. Le 20 assegnazioni già esistenti non ricevono bozze automatiche: le regolarizzate a mano con l'avviso del punto 3.
- Verifica: typecheck, test, controllo nel browser in sola lettura sulle schede esistenti.
