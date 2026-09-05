# Modificare l'intestazione di fatturazione di un contratto esistente

Oggi il riquadro "Intestazione fattura" nella scheda contratto è di sola lettura: i campi esistono solo dentro il dialogo di creazione (`ContrattoDialog.tsx`, sezione "Intestazione della fattura", righe ~625-695). Questo intervento li rende modificabili anche dopo la creazione del contratto.

## Cosa cambia per chi usa il gestionale

- Nel riquadro "Intestazione fattura" compare un pulsante **Modifica**, sempre disponibile (anche a contratto attivo o chiuso).
- Il dialogo che si apre ha esattamente gli stessi campi della creazione contratto, con la stessa scelta fra **intesta allo studente** e **intesta a un altro soggetto**.
- Se esiste già almeno una mensilità **fatturata o incassata**, in cima al dialogo compare un avviso in evidenza: cambiare l'intestatario ora non modifica le fatture già emesse, che restano intestate a chi erano. È un avviso, non un blocco.
- Se l'intestazione che si sta modificando è usata anche da altri contratti, il dialogo lo dice prima della conferma, indicando quanti.
- Se l'anagrafica era già collegata a Fatture in Cloud e viene modificata, dopo il salvataggio il riquadro invita a risincronizzare, con il pulsante già presente. Nessuna sincronizzazione automatica.
- Passare da "studente" a "altro soggetto" non cancella l'anagrafica dello studente: resta a disposizione dei contratti successivi.

## Come viene realizzato

**1. Estrazione del blocco campi (riuso, non riscrittura).**
La sezione anagrafica di `ContrattoDialog.tsx` è JSX inline, non un componente: non è riusabile così com'è. Viene estratta in `src/components/admin/contratti/AnagraficaFatturazioneFields.tsx`, componente presentazionale definito a livello di modulo (mai dentro un altro componente: regola 2 — altrimenti gli input perdono il focus a ogni carattere). Firma: `{ modalita, onModalitaChange, ana, onAnaChange, mostraNotaAnagraficaEsistente }`. Include il selettore modalità, il tipo soggetto, la griglia dei campi e l'avviso `campiMancantiPerFattura`. Con essa si sposta anche il piccolo `F` (label + campo), oggi già a livello di modulo in `ContrattoDialog.tsx`, in un modulo condiviso interno alla cartella.
Nello stesso file vengono estratti due helper puri oggi duplicati nel corpo del dialogo: `anaVuota()` (stato iniziale), `anaDaRiga(row)` (riga DB → stato del form) e `payloadAnagrafica(ana, modalita, studenteId)` (stato del form → payload DB, con la normalizzazione `nz` e il codice destinatario in maiuscolo). `ContrattoDialog.tsx` li usa al posto del codice attuale: comportamento invariato.

**2. Nuovo dialogo `IntestazioneFatturaDialog.tsx`.**
Props: `open`, `onOpenChange`, `contratto` (con `anagrafiche_fatturazione` già caricata dalla query della pagina), `haFattureEmesse`, `onSaved`. Precompila da `contratto.anagrafiche_fatturazione`, imposta la modalità in base a `studente_id` non nullo, e monta `AnagraficaFatturazioneFields`. Validazione uguale a quella della creazione (nome/cognome o denominazione obbligatori).

**3. Salvataggio, secondo lo schema esistente.**
- Modalità **studente**: se esiste già una riga con quello `studente_id` la si aggiorna (l'indice unico parziale `anagrafiche_fatt_studente_uniq`, migration `20260818221948_...`, ne garantisce l'unicità); se il contratto puntava a un'anagrafica di terzi, si cerca l'anagrafica dello studente e la si aggiorna, altrimenti la si crea, poi si aggiorna `contratti.anagrafica_fatturazione_id`.
- Modalità **altro soggetto**: se l'anagrafica corrente è già di un terzo (`studente_id` nullo) e appartiene a questo contratto, viene aggiornata in loco; se invece il contratto era intestato allo studente, si **inserisce una nuova riga** con `studente_id` nullo e si aggiorna `contratti.anagrafica_fatturazione_id`. L'anagrafica dello studente non viene mai cancellata né svuotata (punto 5 della richiesta).
- Al termine: invalidazione di `['contratti', id]` e toast di conferma.

**4. Avviso mensilità già fatturate.**
`ContrattoPage.tsx` calcola già `(canoni ?? []).filter(c => c.stato === 'fatturato' || c.stato === 'incassato')` (riga ~105). Quel valore viene passato al dialogo come `haFattureEmesse` e produce l'avviso in evidenza in cima al form. Nessun blocco, nessun campo disabilitato.

**5. Avviso "usata anche da altri contratti".**
Il dialogo conta i contratti che puntano allo stesso `anagrafica_fatturazione_id` (`select count`, escluso quello corrente) e, se maggiore di zero, dichiara la conseguenza **prima della conferma**: «questa intestazione è usata anche da N altri contratti: la modifica vale per tutti». Stesso principio già applicato all'annullamento dell'assegnazione e alla sezione posto letto. È un avviso, non un blocco.

**6. Invito a risincronizzare (comodità, non presidio).**
Nessuna chiamata automatica a Fatture in Cloud. Dopo un salvataggio che ha toccato un'anagrafica con `fic_entity_id` valorizzato, la pagina mostra sopra a `FicSyncAnagrafica` una riga di avviso ("dati modificati dopo l'ultimo collegamento: risincronizza"). Il segnale è locale alla pagina (stato React impostato dal callback `onSaved`, azzerato dopo una sincronizzazione riuscita) e **sparisce al ricaricamento**: è una comodità per l'operatore, non una garanzia. Il presidio vero arriva in D2: siccome all'emissione si manda `entity.id`, una fattura emessa su un cliente disallineato uscirebbe con l'intestazione memorizzata su Fatture in Cloud — errore fiscale correggibile solo con nota di credito — quindi `fic-emetti-fattura` risincronizzerà l'anagrafica con lo stesso PUT idempotente **prima** di creare il documento. Nessuna colonna nuova qui.


## Fuori perimetro (dichiarato)

- **Nessuna migration, nessun ALTER, nessun DROP**: l'intervento è solo di interfaccia e di scrittura su tabelle esistenti tramite le policy admin già in vigore.
- **Nessun documento fiscale** viene creato, modificato o annullato; le fatture già emesse restano invariate.
- **Nessuna persistenza del "da risincronizzare"** oltre la sessione della pagina: servirebbe una colonna nuova, esclusa da questo giro.

## Verifiche

Typecheck, build e suite completa. Prova manuale nella scheda contratto: modifica dei dati dello studente, passaggio da studente a terzo (verificando che la riga dello studente resti in `anagrafiche_fatturazione`), e presenza dell'avviso su un contratto con mensilità fatturate.
