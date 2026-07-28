## Obiettivo

Aggiornare `docs/Context.md` solo per riflettere le modifiche dell'Intervento A. Non toccare le sezioni sul form pubblico e sul form di completamento (in evoluzione in un intervento parallelo).

## Sezioni da toccare

### §3 Ciclo di vita — stati candidatura
Sostituire ovunque il vecchio set (`ricevuta`, `in_completamento`, `completata`, `approvata`, `ritirata`, `sostituita`) con il nuovo dominio:
- `da_valutare` — stato iniziale
- `in_attesa_studente` — link di completamento inviato
- `da_decidere` — form completo ricevuto
- `accolta`, `in_attesa_posto`, `rifiutata` — esiti

Aggiornare le transizioni e l'elenco "Stati possibili". Non toccare la descrizione dei form.

### §4 Modello dati
- `studenti`: aggiungere l'anagrafica fiscale strutturata (`indirizzo_via`, `indirizzo_civico`, `indirizzo_cap`, `indirizzo_comune`, `indirizzo_provincia`, `indirizzo_nazione` default `IT`) e il flag `cf_non_disponibile`.
- `candidature`: aggiungere `priorita` (usata per ordinare la lista d'attesa). Rimuovere `indirizzo_residenza`.
- `assegnazioni`: `data_inizio` ora è `NOT NULL`; aggiunta colonna `motivo_chiusura`; stati ridotti a `attiva` | `conclusa`.
- `camere`: stati manuali ridotti a `disponibile` | `manutenzione` | `non_disponibile`. L'occupazione non è più uno stato: si legge dalle assegnazioni.
- Aggiungere la vista **`v_studenti_stadio`** (stadio corrente della persona: candidato / residente / archiviato) e la funzione **`camere_disponibilita(dal, al, struttura_id)`** che restituisce posti liberi per intervallo temporale.

### §5 Regole di dominio (trigger e vincoli)
- Rimuovere `camere_sync_stato` (lo stato camera è ora manuale).
- `assegnazioni`: nuovo vincolo `EXCLUDE` GIST anti-sovrapposizione temporale su `(camera_id, posto)` per `[data_inizio, data_fine)`; il trigger `assegnazioni_check_overbooking` resta come guardia complementare.
- Rimuovere la frase "non scrivere mai `camere.stato` dal codice" (ora è scrittura legittima).

### §11 Decisioni prese
Aggiungere righe (formato "decisione → motivo"):
- Stato camera manuale, occupazione derivata dalle assegnazioni — separa lo stato fisico (manutenzione, fuori uso) dall'occupazione, che è già ricavabile.
- Vincolo temporale `EXCLUDE` GIST sulle assegnazioni — impedisce a livello DB doppie occupazioni dello stesso posto in periodi sovrapposti, anche storici.
- Anagrafica fiscale strutturata su `studenti` — necessaria per contrattualizzazione, separata dai dati della singola candidatura.
- Dominio stati candidatura ridisegnato sulle decisioni operative reali — allinea il modello al lessico della direzione.
- Vista `v_studenti_stadio` come lettura unificata dello stadio persona — evita di ricomporlo in ogni pagina.

### §12 Regole per chi ci mette mano
- Rimuovere "non scrivere `camere.stato` dal codice".
- Aggiungere: le nuove ricerche di posti liberi per intervallo passano da `camere_disponibilita`, non ricalcolarle a mano.
- Aggiungere: non aggirare il vincolo `EXCLUDE` sulle assegnazioni (niente `session_replication_role`).

### §13 Rilievi archiviati — aggiungere due scelte esplicite
Documentare come **scelte volute**, non bug:
- **`camere_disponibilita` non filtra su `strutture.attiva`.** Le camere appartenenti a strutture disattivate compaiono comunque nei conteggi restituiti dalla funzione. È intenzionale: la disattivazione di una struttura è un flag amministrativo di visibilità, non una rimozione dei posti letto; il filtro per attività, se serve, va applicato dal chiamante.
- **`v_studenti_stadio.struttura_id` per lo stadio `archiviato` ricade sulla struttura preferita dichiarata in candidatura**, non su quella dell'ultima camera occupata. Motivo: le assegnazioni concluse non entrano nel join laterale della vista, quindi per gli archiviati l'unico riferimento disponibile è la preferenza espressa. È accettabile per la UI di storico attuale; se in futuro servisse la sede reale di soggiorno, va aggiunto un join dedicato sulle assegnazioni concluse più recenti.

### Metadati
Aggiornare la data di "Ultimo aggiornamento".

## Fuori scope
- Sezioni sul form pubblico e sul form di completamento (intervento parallelo).
- Qualsiasi modifica a codice, migration, edge function o `design-system.md`.
