# Cambio intestatario: ricaricare i campi e contare la riga giusta

Tre correzioni al dialogo di modifica dell'intestazione fattura e alla creazione contratto. Nessuna modifica al database, nessuna policy, nessun documento fiscale.

## 1. Il cambio di modalità ricarica i campi (bloccante)

Oggi il selettore "studente / altro soggetto" cambia solo il tipo di soggetto e lascia in pagina i dati precedenti: passando da società a studente restano partita IVA, indirizzo, PEC ed email della società e al salvataggio finiscono sopra l'anagrafica dello studente, condivisa fra tutti i suoi contratti e spinta su Fatture in Cloud se collegata. Nell'altra direzione il codice fiscale dello studente finisce sulla riga della società.

Nuovo comportamento, identico nei due dialoghi:

- **verso "studente"**: si ricaricano i dati dall'anagrafica dello studente se esiste; se non esiste si precompila dalla scheda dello studente (nome, cognome, codice fiscale, indirizzo, codice destinatario proposto, email di fatturazione), esattamente come fa già la creazione del contratto.
- **verso "altro soggetto"**: i campi identificativi vengono svuotati (denominazione, nome, cognome, codice fiscale, partita IVA, indirizzo, PEC, email di recapito, codice destinatario), tipo iniziale "società o ente", nazione Italia.

Mentre il ricaricamento è in corso i campi restano in sola lettura per un istante, così non si salva uno stato intermedio.

## 2. L'avviso "usata anche da N altri contratti" conta la riga che verrà scritta

Il conteggio non guarda più l'intestazione attualmente collegata, ma quella che il salvataggio toccherà davvero:

- modalità "studente": si contano i contratti collegati all'anagrafica dello studente (zero se quell'anagrafica non esiste ancora);
- si resta su "altro soggetto" partendo da un altro soggetto: si contano i contratti collegati a quella riga;
- si passa da "studente" a "altro soggetto": viene creata una riga nuova, quindi zero.

Il conteggio si aggiorna al cambio di modalità, non solo all'apertura.

La scelta della riga di destinazione diventa una funzione pura, coperta da quattro test (uno per esito): studente con anagrafica esistente → si aggiorna quella riga; studente senza anagrafica → riga nuova; altro soggetto partendo da altro soggetto → si aggiorna quella riga; da studente a altro soggetto → riga nuova. La stessa funzione alimenta sia l'avviso sia il salvataggio.

## 3. La nota "esiste già un'anagrafica per questa persona"

Viene mostrata solo quando la ricerca ha effettivamente trovato l'anagrafica dello studente, come già fa la creazione contratto.

## Se il ricaricamento fallisce

Se la lettura dei dati dello studente non riesce, la modalità torna a quella di partenza, i campi restano quelli di prima e viene mostrato un messaggio d'errore: non si resta mai su "studente" con i dati della società in pagina.

In creazione contratto, se la modalità viene cambiata prima di aver scelto uno studente, il passaggio a "studente" svuota i campi identificativi e non tenta alcun caricamento; i dati vengono precompilati appena lo studente viene selezionato, come già avviene oggi.

## Dettagli tecnici


- Nuovo modulo `src/components/admin/contratti/anagraficaStudente.ts` con `caricaAnaStudente(studenteId)`: cerca la riga in `anagrafiche_fatturazione` per `studente_id`, altrimenti costruisce lo stato dai campi di `studenti`; restituisce `{ id, ana }`. Usato dai due dialoghi e dal precompilamento esistente di `ContrattoDialog`, così la regola vive in un punto solo.
- `AnagraficaFatturazioneFields.tsx`: il selettore smette di modificare `tipo` da sé e delega tutto a `onModalitaChange`; si aggiunge `anaTerzoVuota()` accanto ad `anaVuota()`/`anaDaRiga()`. Nuova prop opzionale `disabilitato` per il breve caricamento.
- `IntestazioneFatturaDialog.tsx`: nuovo stato `anagraficaStudenteId`, handler `cambiaModalita` asincrono, conteggio ricalcolato su `idRigaDestinazione` (derivato da modalità + `anagraficaStudenteId` + `anaCorrente`), riuso dello stesso id nel salvataggio invece di rifare la query, `mostraNotaAnagraficaEsistente={modalita === 'studente' && !!anagraficaStudenteId}`.
- `ContrattoDialog.tsx`: stesso handler `cambiaModalita`, che aggiorna anche `anagraficaEsistenteId` (già usato dal salvataggio) — così il difetto simmetrico preesistente sparisce anche in creazione.
- Verifiche: tipi, build e suite completa; nessun test nuovo previsto perché la logica è di caricamento dati, non pura — se durante l'implementazione emerge una funzione pura sul calcolo della riga di destinazione, la copro con un test.
