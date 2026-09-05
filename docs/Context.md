# Studentato Europa — Gestionale: contesto e funzionamento

**Destinazione:** sezione `/docs` dell'applicazione
**Ultimo aggiornamento:** 29 luglio 2026
**Natura del documento:** riferimento unico sul funzionamento del sistema. Serve a chi ci mette mano — sviluppatore, agente AI, o chi subentra fra sei mesi — per capire cosa fa il sistema, perché è fatto così, e cosa non deve fare.

Le affermazioni in questo documento sono verificate nel codice sorgente salvo dove indicato diversamente.

---

## 1. Cosa è

Il gestionale è la piattaforma operativa dello Studentato Europa, residenza universitaria privata di Reggio Emilia gestita da **Navona S.r.l.** (P.IVA 02769680352), collegata all'Hotel Europa.

Vive su `app.studentatoeuropa.it`, sottodominio separato dal sito vetrina WordPress `studentatoeuropa.it`. Il sito porta traffico, l'app raccoglie e gestisce le candidature. Il passaggio fra i due avviene tramite il pulsante "candidati ora" che punta a `app.studentatoeuropa.it/candidatura`.

Due sedi:

| Sede | Indirizzo | Posti | Composizione |
|---|---|---|---|
| Turri | Via Turri 69, Reggio Emilia | 58 | 29 camere doppie |
| Pieve | Via Fratelli Cervi 87, Reggio Emilia | 24 | 10 doppie + 4 singole |

L'edificio di Turri ha quattro piani: primo e quarto sono uffici, secondo e terzo sono lo studentato. Spazi comuni: cucina, lavanderia, sala studio, sala TV.

Tariffe pubblicate sul sito vetrina: doppia 350 €/mese, singola 450 €/mese, tariffa agevolata DSU 250 €/mese su entrambe le sedi. **Le tariffe non sono presenti nel gestionale**: oggi il sistema non tratta importi.

---

## 2. Gli attori

**Il candidato.** Studente universitario, italiano o internazionale, che compila il form pubblico. Non ha un account. Non fa login. Non può rientrare a vedere la propria candidatura. Questa è una scelta di design, non una lacuna — ha conseguenze importanti sul modello di sicurezza descritte al §7.

**L'amministratore.** La direzione della struttura. Accede con email e password a `/admin`. Ha visibilità e controllo completi su tutto. Oggi il ruolo è pensato per uno o due operatori.

**Il garante.** Genitore, tutore o altro referente indicato dal candidato nella seconda fase. **Non interagisce mai con il sistema**, ma i suoi dati personali — nome, relazione, telefono, email, documento d'identità — vengono caricati dallo studente. È un soggetto terzo il cui trattamento va gestito con attenzione (vedi §9).

---

## 3. Il ciclo di vita di una candidatura

Il flusso è **a due fasi**, per esplicita richiesta della direzione: serve un filtro iniziale prima di chiedere allo studente l'intera documentazione. Non semplificarlo in un passaggio unico senza riaprire la questione con la committenza.

### Fase 1 — Candidatura base (pubblica, senza autenticazione)

Lo studente compila il form su `/candidatura`, articolato in cinque step: anagrafica → dati accademici → preferenze → documenti → dichiarazioni. Non esiste uno step di riepilogo: l'invio parte dallo step dichiarazioni, disponibile solo quando tutte e quattro le spunte sono attive. Raccoglie:

- **Anagrafica:** nome, cognome, email, telefono, data di nascita, nazionalità, codice fiscale, indirizzo di residenza, numero documento d'identità
- **Dati accademici:** università, dipartimento, corso di studi, anno di corso, tipologia (universitario / Erasmus / master / altro)
- **Preferenze:** struttura, tipo camera, periodo inizio e fine, data di arrivo prevista, note
- **Documenti:** documento d'identità, certificato di iscrizione
- **Attribuzione:** come ha conosciuto lo Studentato Europa
- **Dichiarazioni:** veridicità, privacy, presa visione informazioni struttura, autorizzazione al contatto — tutte e quattro obbligatorie

I file passano da `upload-candidatura-doc`, che li deposita in `pending/{temp_id}/{tipo}/{nome_file}`. Il record viene poi creato da `submit-candidatura`, che collega i documenti già caricati.

Stato risultante: **`da_valutare`**. Parte in automatico l'email di conferma ricezione.

### Fase 2 — Completamento (su invito, con token)

Se il candidato supera il filtro iniziale, l'amministratore genera un link di completamento da `/admin/candidature`. `generate-completion-link` produce un token casuale da 32 byte, ne salva **solo l'hash SHA-256** sul record, imposta una scadenza a 21 giorni e invia in automatico l'email con il link.

Il candidato apre `/candidatura/completa/{token}` e compila un modulo in quattro step: stile di vita → garante → documenti aggiuntivi → dichiarazioni. Come nella fase 1, non esiste uno step di riepilogo: l'invio parte dallo step dichiarazioni.

Sono **obbligatori**: lingue parlate, orari prevalenti, personalità (con testo libero se "altro"), abitudini di ordine e pulizia, indicazione esplicita se fumatore, presentazione personale, tutti i campi del garante (nome, relazione, telefono, email), documento d'identità del garante e tutte e quattro le dichiarazioni. La documentazione ulteriore resta facoltativa.

Il token viene validato da `get-completion-form` prima di mostrare il modulo e di nuovo da `complete-candidatura` al momento dell'invio. È monouso: dopo il completamento il link restituisce `410`.

All'invio del link di completamento la candidatura passa a **`in_attesa_studente`**; alla ricezione del form completo passa a **`da_decidere`**. Le due transizioni sono calcolate dalle funzioni pure `statoDopoLinkGenerato` e `statoDopoCompletamento` (`supabase/functions/_shared/stato-candidatura.ts`, coperte da test in `src/test/stato-candidatura.test.ts`) e applicate nello stesso update della candidatura: la riga di transizione la scrive il trigger `candidature_log_stato` (regola 11), quindi le edge function inseriscono una riga evento manuale **solo** quando lo stato resta invariato.

Le funzioni non retrocedono mai una candidatura già decisa: da `accolta`, `rifiutata` o `in_attesa_posto` lo stato resta invariato. Inoltre `generate-completion-link` **rifiuta** la generazione del link se la candidatura è `accolta` o `rifiutata`. `in_attesa_posto` resta consentito: è una lista d'attesa, non un esito, e ci si arriva anche direttamente da `da_valutare` — serve poter chiedere la documentazione completa a un candidato in lista prima di assegnargli un posto che si libera; il candidato compila il form restando in lista.

### Fase 3 — Valutazione e assegnazione

L'amministratore decide l'esito. L'azione è disponibile sia da `da_valutare` (candidatura arrivata ma senza il blocco completo) sia da `da_decidere` (candidatura con anche stile di vita, garante e documenti del garante). Gli esiti possibili sono tre: **`accolta`** (candidato ammesso con posto pronto), **`in_attesa_posto`** (candidato ammesso ma senza posto immediatamente disponibile, entra nella lista d'attesa ordinata per `candidature.priorita`), **`rifiutata`**. La marcatura "esito da comunicare" si legge da `esito_email_inviata_il IS NULL` sulle candidature in stato `accolta` o `rifiutata` e vive in due punti del codice: il badge "Esito da comunicare" in `src/components/admin/candidatura/CandidaturaBadges.tsx` e l'azione `invia_esito` in `src/lib/candidaturaActions.ts`. La Dashboard **non** la usa. Le candidature con `origine = 'inserimento_manuale'` sono escluse da entrambi: non hanno un esito da comunicare.

Da `accolta`, `in_attesa_posto` o `rifiutata` è possibile **riaprire** la candidatura: torna a `da_decidere` se esiste un form completo, altrimenti a `da_valutare` (logica in `reopenStato`, `src/lib/candidaturaActions.ts`). La riapertura non è possibile se esiste già un'assegnazione attiva, per garanzia del trigger `candidature_check_stato_vs_assegnazione`.

L'invio dell'email di esito è **manuale**, non automatico: l'amministratore la conferma dalla scheda candidatura e può aggiungere una nota libera. Scelta deliberata — l'esito di una candidatura è una comunicazione che merita una rilettura umana.

Al candidato approvato viene poi assegnato un posto in una camera specifica. Nasce un record in `assegnazioni`, che è l'oggetto che rappresenta il soggiorno.

### Stati possibili

**Candidature:** `da_valutare` → `in_attesa_studente` → `da_decidere` → `accolta` | `in_attesa_posto` | `rifiutata`. Approvazione e rifiuto possono avvenire anche direttamente da `da_valutare` quando la valutazione non richiede il form completo.

**Camere:** `disponibile`, `manutenzione`, `non_disponibile`. Sono **stati manuali** che descrivono lo stato fisico del posto letto. L'occupazione **non è più uno stato**: si legge dalle assegnazioni attive nel periodo.

**Assegnazioni:** `attiva`, `conclusa`. La chiusura richiede un `motivo_chiusura` fra `fine_naturale`, `partenza_anticipata`, `mai_arrivato`, `allontanato`, `trasferimento` (vincolato dal CHECK `assegnazioni_motivo_chiusura_chk`). `trasferimento` è riservato al flusso di cambio camera in Residenti.

---

## 4. Modello dati

### Tabelle di dominio

| Tabella | Contenuto |
|---|---|
| `strutture` | Le due sedi. Unica tabella con lettura pubblica (solo se `attiva = true`) |
| `camere` | Camere per struttura: numero, piano, tipo, posti, stato manuale (`disponibile` / `manutenzione` / `non_disponibile`) |
| `studenti` | Anagrafica della persona, separata dalla candidatura. Email univoca. Include l'anagrafica fiscale strutturata (`indirizzo_via`, `indirizzo_civico`, `indirizzo_cap`, `indirizzo_comune`, `indirizzo_provincia`, `indirizzo_nazione` con default `IT`) e il flag `cf_non_disponibile` per i candidati senza codice fiscale italiano |
| `candidature` | La richiesta: stato, preferenze, dati accademici in snapshot, dichiarazioni, token di completamento, campi di gestione email. `priorita` ordina la lista d'attesa (`in_attesa_posto`). La colonna `origine` (migration `20260905122830`) distingue `form_pubblico` (candidatura arrivata dal sito) da `inserimento_manuale` (persona registrata dall'amministrazione via `crea_persona_manuale`); vincolo `candidature_origine_chk` |
| `assegnazioni` | Il soggiorno: studente, candidatura, camera, posto (1 o 2), `data_inizio` (`NOT NULL`), `data_fine`, `stato` (`attiva` / `conclusa`), `motivo_chiusura` |
| `documenti` | Metadati dei file caricati, con riferimento al path in storage |
| `log_stato_candidature` | Traccia automatica di ogni cambio di stato |
| `user_roles` | Ruoli applicativi. Tabella separata da `auth.users` per scelta di sicurezza |

**Perché `studenti` è separata da `candidature`:** una persona può candidarsi più volte, o candidarsi e poi diventare residente. Tenere l'identità separata dalla richiesta evita duplicazioni e permette di ricostruire la storia di una persona.

**Perché i dati accademici sono anche in snapshot su `candidature`:** i campi `universita_snapshot`, `corso_snapshot`, `anno_corso_snapshot` congelano la situazione al momento della candidatura. Se lo studente cambia corso, la candidatura resta leggibile com'era.

### Tabelle contratti, scadenzario e fatturazione

| Tabella | Contenuto |
|---|---|
| `anagrafiche_fatturazione` | L'intestatario del documento fiscale: di norma lo studente, ma può essere un soggetto terzo (società sportiva, azienda, genitore con partita IVA). `tipo` fra `persona_fisica` (richiede nome e cognome) e `soggetto_giuridico` (richiede denominazione), dati fiscali, indirizzo completo (`indirizzo_nazione` default `IT`), `codice_destinatario` vincolato a 7 caratteri `[A-Z0-9]`, PEC, email di recapito, `studente_id` opzionale, `fic_entity_id` per il collegamento futuro a Fatture in Cloud. Indice **unico parziale** su `studente_id` quando valorizzato: un solo record per studente, mentre le anagrafiche intestate a terzi (con `studente_id` nullo) restano libere |
| `contratti` | Il contratto di ospitalità: `studente_id`, `struttura_id` e `anagrafica_fatturazione_id` obbligatori, `assegnazione_id` opzionale (per caricare contratti firmati fuori dal sistema), periodo, `giorno_scadenza` (1-28, default 1: il giorno del mese in cui scade ogni mensilità; il limite a 28 evita il problema di febbraio), `canone_mensile` con `canone_note`, `aliquota_iva` (default 10.00), dati garante tutti nullable, `stato` fra `bozza`, `attivo`, `scaduto`, `risolto`, `rinnovato`, `contratto_precedente_id` per i rinnovi, `file_firmato_path`. Include l'intero ciclo del **deposito cauzionale** (`deposito_richiesto`, `deposito_importo`, `deposito_motivo_esenzione`, `deposito_stato`, `deposito_data_incasso`, `deposito_modalita`, `deposito_importo_restituito`, `deposito_motivo_trattenuta`). **Non esiste più la colonna `tipo`** (`breve` / `lunga`): serviva solo a scegliere quale modello precompilare in PDF, e la generazione del contratto da modello è fuori perimetro — il sistema archivia il firmato, non lo genera |
| `canoni` | Lo scadenzario: una riga per mensilità, `competenza` vincolata al primo giorno del mese, `imponibile`, `aliquota_iva`, `totale` come colonna **generata** dal database, `scadenza`, `stato` fra `da_fatturare`, `fatturato`, `incassato`, `annullato`. Unica per (`contratto_id`, `competenza`), cancellazione a cascata dal contratto |
| `listini` | Tariffe per (`struttura_id`, `tipo_camera`) con periodo di validità. Servono **solo a proporre** il canone alla creazione del contratto: il prezzo che vale è quello scritto sul contratto. Vincolo `EXCLUDE USING gist` che vieta periodi sovrapposti per la stessa coppia sede/tipo camera, perché due listini contemporanei renderebbero ambiguo il valore proposto |
| `fatture` | Il registro locale dei documenti emessi su Fatture in Cloud: `contratto_id` obbligatorio, `fic_document_id`, `numero`, `numerazione`, `data`, `imponibile`/`iva`/`totale` **NOT NULL** con CHECK `totale = imponibile + iva`, `ei_status` e `url_documento` (che su Fatture in Cloud cambiano dopo l'emissione), `stato` fra `in_invio`, `emessa`, `errore`, `messaggio_errore`. Indice **unico parziale** su `fic_document_id` quando valorizzato: mai due righe locali per lo stesso documento remoto. `UNIQUE (id, contratto_id)` esiste come bersaglio della FK composta di `canoni` |


**Il deposito sta su `contratti`, non in una tabella dedicata:** il rapporto è uno-a-uno rigido e un importo duplicato in due tabelle prima o poi diverge. Un unico CHECK garantisce la coerenza: se `deposito_richiesto` è vero servono importo maggiore di zero e stato valorizzato senza motivo di esenzione; se è falso, importo e stato restano nulli ed è obbligatorio il motivo di esenzione.

**Prezzi IVA inclusa in interfaccia, imponibile sul database.** I prezzi concordati con gli studenti (350 € doppia, 450 € singola) sono comprensivi di IVA. L'operatore digita e legge sempre l'importo **IVA inclusa**; il database conserva l'**imponibile** (`contratti.canone_mensile`, `canoni.imponibile`) e `canoni.totale` resta la colonna generata `round(imponibile * (1 + aliquota_iva/100), 2)`. L'unica colonna già lorda è `listini.importo_mensile_lordo` (rinominata da `importo_mensile` nella migration `20260905164805`, valori invariati: erano già lordi). La conversione vive in `src/lib/iva.ts` e lavora **su centesimi interi**, non su numeri con la virgola: l'oracolo dei test (`src/test/iva.test.ts`, verifica di proprietà su ogni importo da 1 a 1000 € al 10%) è la formula effettiva della colonna generata, letta da `information_schema`, non `imponibile + round(iva, 2)` — le due non coincidono sempre. La conversione **non è idempotente e non deve esserlo**: 500,00 € lordi danno imponibile 454,55 € e totale 500,01 €. In quel caso l'interfaccia lo dichiara — avviso nel dialogo di creazione contratto e nel messaggio di conferma dopo la correzione manuale di una mensilità — invece di nascondere lo scostamento. Restano volutamente sull'imponibile `src/lib/canoniRicalcolo.ts`, `aggiorna_canone_contratto` e `generaScadenzario`: la base di calcolo non cambia, cambia solo ciò che l'operatore digita e vede. Nessun export XLSX né modello email mostra un canone (verificato con ricerca su `src/lib/exportXlsx.ts` e `supabase/functions/_shared/*email-templates*`), quindi non c'era altro da adeguare.

**`canoni.imponibile` e `canoni.aliquota_iva` sono uno snapshot deliberato** dei corrispondenti campi del contratto al momento della generazione della mensilità, non una denormalizzazione da correggere. Se il canone del contratto cambia, le mensilità già generate devono restare quelle che erano. È lo stesso principio dei campi `*_snapshot` su `candidature`.

**Canone intero sui mesi parziali — regola provvisoria, da confermare con la direzione.** Lo scadenzario genera una riga per ogni mese di calendario toccato dal periodo, con canone **intero** anche sul primo e sull'ultimo mese se parziali. Il rateo sui giorni non è stato deciso: finché non lo è, l'operatore corregge a mano la singola mensilità finché resta `da_fatturare`. La regola vive in una funzione pura, `generaScadenzario` (`src/lib/scadenzario.ts`), coperta da `src/test/scadenzario.test.ts`.

**`canoni.totale` è `GENERATED ALWAYS STORED`:** Postgres rifiuta l'intera scrittura se le si assegna un valore. Il generatore di tipi la espone come scrivibile in `Insert` e `Update`, ma non lo è: non passarla mai nei payload.

**Vincoli e regole di dominio nel database** (§5: le regole stanno nel database, non nel frontend):

- `contratti_durata_max_chk`: `data_fine <= data_inizio + 12 mesi - 1 giorno`. È il limite legale del contratto di ospitalità studentesca e vive nello schema, non solo nell'interfaccia.
- **a. Canoni non riscrivibili** (`canoni_protect_fatturati`, trigger `BEFORE UPDATE OR DELETE`): una riga in stato `fatturato` o `incassato` non può essere cancellata né modificata. Le uniche eccezioni sono la transizione `fatturato` → `incassato` e l'aggiornamento di `note` (più `updated_at`). Qualsiasi variazione di importo, aliquota, competenza, scadenza o contratto viene rifiutata: una mensilità fatturata corrisponde a un documento fiscale emesso. Con stato `da_fatturare` o `annullato` nessuna restrizione.
- **b. Contratti cancellabili solo in bozza** (`contratti_protect_delete`, trigger `BEFORE DELETE`): il rifiuto scatta se lo stato non è `bozza`. Il `CASCADE` sui canoni è comodo per scartare una bozza, pericoloso su un contratto reale; per chiudere un contratto vero si usa uno stato di chiusura (`risolto`, `scaduto`).

Entrambe le funzioni trigger sono `SECURITY INVOKER` con `SET search_path TO 'public'`, come tutte le altre funzioni trigger del progetto: la regola 4 del §12 riguarda le funzioni RPC invocabili dal client, non i trigger.

Le quattro tabelle hanno RLS attiva con un'unica policy `FOR ALL TO authenticated` su `has_role(auth.uid(), 'admin')`. Nessun accesso `anon`.

### Viste e funzioni di lettura

- **Vista `v_studenti_stadio`**: per ogni studente riassume lo **stadio corrente** — `da_valutare`, `in_attesa_studente`, `da_decidere`, `in_attesa_posto`, `assegnato` (candidatura accolta con un posto pre-arrivo), `in_casa` (soggiorno in corso), `archiviato` — insieme alla struttura di riferimento. È la sorgente unica dello stadio persona: non ricomporlo per pagina. Per gli studenti in stadio `archiviato` la colonna `struttura_id` ricade sulla **struttura preferita dichiarata in candidatura** e non sulla sede dell'ultima camera occupata (vedi §13, scelta esplicita).
- **Funzione `camere_disponibilita(p_dal date, p_al date, p_struttura_id uuid)`**: restituisce, per ogni camera nel perimetro, i posti liberi nell'intervallo **chiuso** `[p_dal, p_al]` (estremi inclusi, coerentemente con il vincolo `EXCLUDE` GIST che confronta `daterange(data_inizio, data_fine, '[]')`) calcolando le assegnazioni attive che si sovrappongono al periodo. È l'API da usare per qualsiasi ricerca di posti liberi per intervallo: non ricalcolarla a mano nel client. La funzione **non filtra su `strutture.attiva`** (vedi §13, scelta esplicita).
- **Funzione `crea_persona_manuale(p_studente jsonb, p_candidatura jsonb, p_assegnazione jsonb DEFAULT NULL)`** (migration `20260905122830`, validazioni camera/posto in migration successiva del 05/09/2026, stato derivato nella migration del 05/09/2026 ore 13): registra dall'amministrazione una persona mai passata dal form pubblico, in un'unica transazione — riga in `studenti`, candidatura con `origine = 'inserimento_manuale'` imposta dalla funzione (mai dal payload; `versione_form` è forzato a `pre_screening` per non far comparire il badge "Form completo" in admin, visto che `CandidaturaBadges.tsx` lo mostra solo su `versione_form = 'completa'`), e facoltativamente l'assegnazione attiva al posto letto. Lo **stato è derivato**: `accolta` se `p_assegnazione` è presente, `in_attesa_posto` se assente — senza questa derivazione `v_studenti_stadio` classificherebbe `archiviato` una persona senza posto letto, facendola sparire dalle liste. Scrive la riga di creazione in `log_stato_candidature` con `stato_nuovo` pari allo stato effettivamente scritto (`stato_precedente` nullo, nota "Persona inserita manualmente dall'amministrazione"). Non verifica la disponibilità del posto in anticipo: si appoggia al vincolo `assegnazioni_no_overlap` e al trigger `assegnazioni_check_overbooking`, traducendo gli errori in italiano (`esiste_gia_persona`, `posto_occupato`, `camera_mancante`, `posto_mancante`, `data_inizio_mancante`). `SECURITY INVOKER`, `EXECUTE` solo ad `authenticated` (le policy "Admins full access" fanno il resto). La UI di ingresso è il pulsante "Aggiungi persona" nella toolbar di `/admin/residenti` (`src/components/admin/AggiungiPersonaDialog.tsx`).

### Tabella di sessione candidatura

`candidatura_sessioni` registra ogni apertura del form pubblico: `temp_id` (UUID generato dal client), `origine` (`pubblica` o `completamento`), `upload_count`, `consumata_il`. Serve a due cose: dimostrare che chi carica un documento ha effettivamente aperto il form (validazione Cloudflare Turnstile per il form pubblico, token di completamento per quello su invito) e limitare il numero di upload per sessione.

La tabella è scritta esclusivamente da funzioni `SECURITY DEFINER` (`check_candidatura_sessione`, `consume_candidatura_upload_slot`, `consume_candidatura_sessione`) invocate dalle edge function pubbliche. Ha **RLS attiva e zero policy**: è la configurazione più restrittiva possibile e l'accesso passa solo dal ruolo `service_role`, che non è soggetto alle policy. Non aggiungere policy: una policy scritta larga la aprirebbe invece di chiuderla (vedi §"Rilievi di sicurezza archiviati").

### Tabelle di infrastruttura email

`email_send_log`, `suppressed_emails`, `email_unsubscribe_tokens`, più le code `pgmq`. Accessibili unicamente dal ruolo `service_role`: nessun accesso applicativo, per design.

---

## 5. Le regole di dominio stanno nel database

Questa è la scelta architetturale più importante del sistema, e va rispettata: **le invarianti di dominio sono applicate da trigger PostgreSQL, non dal frontend.** Il frontend può essere aggirato, il database no.

| Trigger / vincolo | Cosa garantisce |
|---|---|
| `camere_check_posti` | Non si può ridurre il numero di posti sotto il numero di occupanti attivi |
| `assegnazioni_check_overbooking` | Nessun overbooking, nessuna assegnazione su camera in manutenzione, posto entro il range |
| `EXCLUDE` GIST su `assegnazioni` | Impedisce sovrapposizioni temporali su `(camera_id, posto)` per il periodo **chiuso** `[data_inizio, data_fine]` (estremi inclusi), anche fra assegnazioni storiche. Il trigger di overbooking resta come guardia complementare. In un trasferimento, la vecchia assegnazione va chiusa con `data_fine = nuovo_inizio − 1 giorno` (calcolo UTC-safe) per non violare il vincolo |
| `candidature_check_stato_vs_assegnazione` | Non si può togliere l'approvazione a una candidatura con assegnazione attiva |
| `candidature_log_stato` | Ogni cambio di stato viene tracciato automaticamente |

**Conseguenza pratica:** lo stato di `camere` è **manuale** (`disponibile` / `manutenzione` / `non_disponibile`) e descrive la disponibilità fisica del posto letto; l'occupazione è invece derivata dalle assegnazioni. Non aggirare il vincolo `EXCLUDE` sulle assegnazioni con `session_replication_role` o simili trucchi: se serve modificare periodi sovrapposti, chiudere prima l'assegnazione confliggente.

### Registro dei cambi di stato: transizioni vs eventi

Le righe di `log_stato_candidature` sono di due tipi:

- **Righe di transizione** (`stato_precedente` ≠ `stato_nuovo`): scritte **esclusivamente** dal trigger `candidature_log_stato` a ogni `UPDATE` di `candidature.stato`. Il codice applicativo non deve mai inserire righe di transizione: farebbe duplicati e/o incoerenze rispetto allo stato reale della candidatura.
- **Righe di evento** (`stato_precedente = stato_nuovo`, con `note`): scritte dalle funzioni server per lasciare traccia di azioni che non cambiano lo stato ma sono rilevanti nella cronologia. Oggi l'unico caso è `complete-candidatura`, che inserisce una riga di evento con nota "Form completo inviato dallo studente" quando il candidato invia la fase 2. Caso a parte la riga di **creazione**: all'inserimento della candidatura (`submit-candidatura`, `crea_persona_manuale`) viene scritta una riga con `stato_precedente` nullo e `stato_nuovo` pari allo stato iniziale, perché non esiste uno stato precedente.

La scheda persona (§ Area amministrativa) presenta le due categorie in una timeline narrativa unica.

---

## 6. Comunicazioni email

Tre comunicazioni verso il candidato:

| Comunicazione | Quando | Modalità |
|---|---|---|
| Conferma ricezione | All'invio della candidatura base | Automatica |
| Link di completamento | Alla generazione del link da parte dell'admin | Automatica |
| Esito | Alla conferma manuale dell'admin | **Manuale**, con nota libera opzionale |

Tutti i template esistono in italiano e inglese. La lingua è scelta in base al campo `candidature.lingua`, valorizzato dalla lingua del form al momento della compilazione.

**Architettura:** le email non partono in modo sincrono. L'helper condiviso `enqueue-transactional.ts` renderizza il template React Email e mette il messaggio in una coda `pgmq`, da cui `process-email-queue` lo preleva e lo spedisce. L'invio non blocca mai la risposta all'utente: se la mail fallisce, la candidatura viene comunque registrata.

Dominio mittente: `updates.app.studentatoeuropa.it`.

Ogni messaggio porta un `idempotency_key` e un `unsubscribe_token` (recuperato o creato in `email_unsubscribe_tokens`). Entrambi sono obbligatori per l'API di invio: la loro assenza è stata la causa di due bug di invio già risolti. Se si aggiunge un nuovo punto di invio, passare **sempre** da `enqueue-transactional.ts` e non ricostruire il payload a mano.

**Limite noto:** non esiste oggi alcun modo, dall'interfaccia admin, di sapere se un'email è fallita. Il log esiste ma è leggibile solo da `service_role`.

---

## 7. Modello di sicurezza

### Autenticazione

Solo gli amministratori si autenticano. `AdminLayout` verifica a ogni caricamento che l'utente abbia il ruolo `admin` in `user_roles`; se non ce l'ha, esegue il logout e reindirizza al login. Il controllo di ruolo passa dalla funzione `has_role`, usata anche dentro tutte le policy RLS.

**I ruoli stanno in una tabella dedicata, non nei metadati dell'utente.** I metadati sono modificabili dal client: un ruolo scritto lì sarebbe una escalation di privilegi mascherata da campo. Non spostare mai il ruolo altrove.

### Row Level Security

RLS è attiva su tutte le tabelle. Il modello è semplice per una ragione precisa: **non esistendo un'area studente, l'unica policy sensata è "solo admin"**.

Uno scanner di sicurezza segnalerà a ripetizione che "gli studenti non possono vedere le proprie candidature / camere / documenti / assegnazioni / profilo". **Queste segnalazioni sono corrette da ignorare oggi**, perché gli studenti non hanno un account con cui essere identificati.

> **Precondizione per la Fase 2.** Nel momento in cui viene introdotta una qualunque funzionalità lato studente — vedere il proprio contratto, la propria fattura, lo stato del deposito cauzionale — tutte queste giustificazioni decadono contemporaneamente, e non esiste alcuna baseline RLS basata sulla proprietà del dato su cui appoggiarsi. Va progettata da zero **prima** di aprire qualsiasi accesso studente, non dopo.

### Perimetro pubblico

**Attenzione: `supabase/config.toml` non è la fonte di verità completa del perimetro pubblico.** Il file contiene solo le funzioni con un'impostazione esplicita di `verify_jwt`; le funzioni assenti dal file non ricevono il controllo JWT del gateway e risultano raggiungibili senza autenticazione (è il caso in produzione di `submit-candidatura`, `complete-candidatura`, `get-completion-form`, `upload-candidatura-doc`). L'elenco completo delle funzioni pubbliche è quello qui sotto, non quello di `config.toml`.

Nove edge function sono raggiungibili senza autenticazione JWT. Per ciascuna, il meccanismo che la protegge:

- `submit-candidatura` — pubblica per default del gateway (assente da `config.toml`); valida server-side ogni campo e richiede una sessione candidatura attiva (`supabase/functions/submit-candidatura/index.ts`).
- `complete-candidatura` — default del gateway; richiede un token di completamento valido, confrontato con l'hash salvato sulla candidatura (`complete-candidatura/index.ts`).
- `get-completion-form` — default del gateway; stessa validazione del token di completamento (`get-completion-form/index.ts`).
- `upload-candidatura-doc` — default del gateway; richiede una sessione attiva e consuma uno slot di upload in modo atomico via RPC `consume_candidatura_upload_slot` (`upload-candidatura-doc/index.ts`).
- `auth-email-hook` — `verify_jwt = false` in `config.toml`; webhook che accetta solo richieste firmate HMAC verificate con `verifyWebhookRequest` e `LOVABLE_API_KEY` (`auth-email-hook/index.ts`).
- `open-candidatura-sessione` — `verify_jwt = false`; richiede un token Cloudflare Turnstile valido **oppure** un token di completamento valido, e rifiuta un `temp_id` già esistente con "Sessione già esistente" (`open-candidatura-sessione/index.ts`, righe 51–58).
- `preview-transactional-email` — `verify_jwt = false`; protetta da bearer check su `LOVABLE_API_KEY`, chiamata solo dall'API Go interna per le anteprime dei template (`preview-transactional-email/index.ts`, righe 27–35).
- `handle-email-unsubscribe` — `verify_jwt = false`; richiede un token monouso di `email_unsubscribe_tokens`. **GET valida soltanto il token senza consumarlo; POST lo consuma con check-and-update atomico** (`.update({ used_at }).eq('token', token).is('used_at', null)`, righe 89–95). I due metodi sono separati perché i filtri antispam precaricano i link nelle email: se anche GET consumasse il token, gli studenti verrebbero disiscritti dalla sola apertura del messaggio.
- `handle-email-suppression` — `verify_jwt = false`; webhook che accetta solo richieste firmate HMAC con `LOVABLE_API_KEY` via `verifyWebhookRequest` di `@lovable.dev/webhooks-js` (righe 49–56), con rifiuto di firma invalida e timestamp stale.

Tutte validano server-side: tipi, lunghezze massime, regex su email e date, formato UUID, formato dei path di storage. La validazione lato client esiste per l'esperienza d'uso, non per la sicurezza.

I messaggi di errore verso l'utente sono generici, il dettaglio finisce nei log lato server. Non introdurre messaggi che espongano nomi di tabella o struttura delle query.

### Documenti e storage

Il bucket `documenti_studenti` è privato: gli amministratori leggono tramite signed URL a scadenza breve, nessuna lettura pubblica.

Il bucket **`contratti`** è anch'esso privato e contiene i contratti firmati, con path `{contratto_id}/{nome_file}`. È **separato da `documenti_studenti` per scelta**: quest'ultimo viene ripulito dalla edge function `delete-candidatura`, che cancella tutti i path legati a una candidatura, e un contratto firmato non deve poter finire in una cancellazione pensata per i documenti di un candidato. Le policy su `storage.objects` consentono lettura, caricamento, sostituzione ed eliminazione solo agli amministratori autenticati (`has_role(auth.uid(), 'admin')`), nessun accesso anonimo; la policy di scrittura ammette **solo file con estensione `pdf`**. Il limite di 10 MB è applicato lato client. La lettura passa da signed URL a scadenza breve.

I file dei candidati vivono in due posizioni distinte:

- **Cartella temporanea `pending/{temp_id}/{tipo}/{filename}`**: dove `upload-candidatura-doc` deposita ogni file caricato dal form. `temp_id` è l'UUID della sessione di candidatura, non della candidatura definitiva (che ancora non esiste al momento dell'upload).
- **Cartella definitiva `candidature/{candidatura_id}/{tipo}/{filename}`**: destinazione finale, legata alla candidatura reale.

Lo spostamento avviene al momento dell'invio andato a buon fine, tramite l'helper condiviso `moveDocumentToFinal` (`supabase/functions/_shared/move-documenti.ts`), chiamato da `submit-candidatura` (fase 1) e da `complete-candidatura` (fase 2). Se lo spostamento fallisce, il file **resta nella cartella temporanea** e nel record `documenti` viene salvato il path originale: la candidatura si registra comunque, l'errore viene loggato lato server e il file resta accessibile.

**Tipi documento accettati.** Un insieme fisso: `documento_identita`, `certificato_iscrizione`, `documento_garante`, `documento_aggiuntivo`. La definizione unica è in `supabase/functions/_shared/documenti-tipi.ts` e viene applicata sia dalle edge function di upload/submit sia dal vincolo `documenti_tipo_check` sulla tabella `documenti`. Non riscrivere l'elenco altrove.

**Limiti di caricamento**:

| Limite | Valore | Dove |
|---|---|---|
| Dimensione massima per file | 5 MB | `MAX_BYTES` in `upload-candidatura-doc/index.ts` (server) e `MAX_UPLOAD_BYTES` in `src/lib/uploads.ts` (client) |
| Formati accettati | PDF, JPG, PNG | Allowlist MIME server + `ACCEPTED_UPLOAD_MIME` client |
| Caricamenti per sessione | 4 | Funzione atomica `consume_candidatura_upload_slot` (RPC), che incrementa `candidatura_sessioni.upload_count` solo se `< 4` e la sessione non è consumata |

---

## 8. Multi-struttura

Il sistema nasce multi-sede. Non esiste più un filtro sede globale nella top bar: ogni pagina che ne ha bisogno espone un proprio selettore locale (query param `sede`) e la Dashboard mostra le due sedi in parallelo. La top bar ospita invece la **ricerca globale** su nome/cognome/email.

Attenzione a una distinzione che ha già causato un bug: `candidature.struttura_preferita_id` è una **preferenza espressa dal candidato**, non un'occupazione. L'occupazione reale si legge dalle assegnazioni attive risalendo alla struttura della camera. Le metriche di occupazione devono usare la seconda, mai la prima.

---

## 8bis. Area amministrativa

L'area `/admin` è organizzata attorno a `AdminLayout`, che fornisce:

- una **sidebar** con le voci principali (Dashboard, Candidature, Residenti, Contratti, Camere, Strutture). Non esiste più la sezione "Storico": gli archiviati vivono nelle liste principali via filtro `stadio=archiviato`.
- una **top bar globale** con titolo della pagina corrente e ricerca globale persone.

Le pagine sotto `/admin` **non** stampano più un proprio titolo o sottotitolo: iniziano direttamente dalla toolbar filtri o dal contenuto. Il titolo mostrato in top bar è risolto in ordine da un override esplicito (`usePageTitle(label)` per rotte con parametri variabili, es. `"Rossi Mario"` sulla pagina persona) oppure da una mappa statica `rotta → label` per le rotte fisse.

### Contratti

`/admin/contratti` elenca i contratti — studente (link alla scheda persona), struttura, periodo, canone, stato, deposito (importo o "non richiesto"), presenza del PDF firmato — con filtro stato, filtro sede, ricerca per nome e paginazione, tutti nei query param.

Il contratto si crea da due punti: "Crea contratto" nella scheda persona per gli stadi `assegnato` e `in_casa`, e "Nuovo contratto" nella lista per i casi manuali. Il modulo precompila studente, assegnazione attiva o futura, struttura, date, aliquota 10.00 e dati garante dalla candidatura più recente; tutto resta modificabile e il garante resta facoltativo. L'anagrafica di fatturazione si intesta allo studente (riusando quella esistente, che l'indice unico parziale rende unica) oppure a un altro soggetto con `studente_id` nullo. Il codice destinatario è proposto a `0000000` per l'Italia e `XXXXXXX` per l'estero. Codice fiscale, partita IVA, codice destinatario ed email di recapito **non bloccano** la creazione: esiste già in produzione uno studente senza codice fiscale italiano, e un avviso non bloccante elenca ciò che mancherà al momento della fattura. Il contratto nasce in `bozza`.

**Proposta del canone.** La ricerca del listino dipende **solo** dalla coppia (struttura, tipo camera), non dall'esistenza di un'assegnazione: prima viveva dentro il ramo che leggeva la camera dell'assegnazione, quindi senza assegnazione il modulo dichiarava "nessun listino valido" senza aver mai interrogato la tabella. Il tipo camera e' un campo del modulo — precompilato dalla camera dell'assegnazione quando esiste, altrimenti scelto dall'operatore — e **non viene salvato** sul contratto: serve solo a scegliere il prezzo. Il canone proposto non sovrascrive un importo digitato: si aggiorna solo se il campo e' vuoto o contiene ancora esattamente l'ultimo valore proposto. I messaggi sono tre e distinti: coppia incompleta, ricerca eseguita senza risultato, listino applicato (importo, sede, tipo camera, decorrenza). In **sostituzione** il listino viene cercato e mostrato ma **non applicato** — il canone precedente puo' essere un prezzo negoziato e sovrascriverlo in silenzio lo farebbe sparire; compare un pulsante "Usa il prezzo di listino", reso piu' evidente se sede o tipo camera sono cambiati rispetto al contratto sostituito.

**Listini in Impostazioni.** `/admin/impostazioni` ha una sezione "Listini": tabella dei prezzi per sede e tipo camera (importo, decorrenza, periodo di validita') con la riga in vigore oggi distinta dallo storico, e un modulo "Nuovo prezzo" che prima della conferma dichiara quale listino verra' chiuso e da quale data. Non esiste modifica in riga ne' cancellazione: un prezzo gia' applicato a un contratto e' un fatto storico, i listini **non si modificano, si succedono nel tempo**.

La scrittura passa da `imposta_listino(p_struttura_id, p_tipo_camera, p_importo, p_valido_dal)` (l'importo è **IVA inclusa** e finisce in `listini.importo_mensile_lordo`) (`SECURITY INVOKER`, `EXECUTE` revocato a PUBLIC e ad `anon`, concesso ad `authenticated`). Esiste perche' il vincolo `EXCLUDE USING gist` `listini_no_overlap` rifiuta due listini validi contemporaneamente per la stessa coppia: un semplice inserimento fallisce sempre finche' il precedente e' aperto. In un'unica transazione la funzione valida tipo camera e importo, rifiuta una decorrenza non successiva a un listino gia' presente (chiuderlo prima della sua stessa decorrenza violerebbe `listini_validita_chk`), chiude il listino aperto a `p_valido_dal - 1`, verifica con la stessa espressione del vincolo che nessun periodo residuo — anche di un listino gia' chiuso — si sovrapponga, e restituisce l'id del nuovo listino. L'errore in italiano indica le date del listino in conflitto invece di lasciar uscire quello grezzo del vincolo.

L'azione **"Attiva contratto"** porta a `attivo` e solo in quel momento genera i canoni, dopo un'anteprima delle mensilità (mese, importo, scadenza, totale complessivo) da confermare. L'attivazione passa dalla funzione `attiva_contratto(p_contratto_id, p_righe)`: inserimento delle mensilità e cambio di stato avvengono **in un'unica transazione**, così non può restare un contratto attivo senza scadenzario né uno scadenzario appeso a una bozza. Allo stesso modo l'aggiornamento del canone passa da `aggiorna_canone_contratto(p_contratto_id, p_canone)`, che scrive il nuovo canone e ricalcola le mensilità future nella stessa transazione e restituisce quante ne ha toccate. Il ricalcolo tocca solo le mensilità `da_fatturare` con competenza dal mese corrente in poi **e imponibile ancora uguale al canone precedente**: una riga corretta a mano dall'operatore è deliberatamente diversa e non viene riscritta. Limite noto e accettato: una correzione manuale che riporti l'imponibile esattamente al canone precedente rende la riga indistinguibile da una standard e la espone di nuovo al ricalcolo. Lo stesso criterio vive lato interfaccia nella funzione pura `partizionaMensilitaPerCambioCanone` (`src/lib/canoniRicalcolo.ts`), così il conteggio mostrato nel dialogo di conferma coincide con ciò che la RPC farà davvero. Entrambe sono `SECURITY INVOKER`: le policy RLS di sola competenza admin restano in vigore.

Una bozza resta liberamente modificabile e cancellabile: **"Elimina contratto"** è disponibile sia nella scheda del contratto sia nel menu di riga della lista, solo per lo stato `bozza` (il trigger `contratti_protect_delete` è la rete di sicurezza). L'ordine è vincolante — prima il PDF dallo storage, poi la riga: se lo storage fallisce ci si ferma, per non lasciare file orfani nel bucket. I canoni cadono in cascata; l'anagrafica di fatturazione **non** viene toccata, perché appartiene alla persona e serve ai contratti successivi. Il **giorno di scadenza** è modificabile in riga finché il contratto è in bozza, perché cambia le date di tutto lo scadenzario ancora da generare.

Se il canone cambia su un contratto già attivo, l'interfaccia mostra quante mensilità verranno ricalcolate — solo `da_fatturare` con competenza corrente o futura — e quante restano intoccate perché già `fatturato` o `incassato`, e chiede conferma: il rifiuto del trigger `canoni_protect_fatturati` è la rete di sicurezza, non la logica applicativa.

`/admin/contratti/:id` mostra contratto, intestazione fattura, garante, deposito **in sola lettura** e lo scadenzario, con modifica in riga di imponibile, scadenza e note per le sole righe `da_fatturare`; imponibile e scadenza sono validati prima della scrittura (importo numerico ≥ 0, data valida). Da qui si carica, si sostituisce e si apre (signed URL) il **PDF firmato**, salvato nel bucket `contratti`, limitato lato bucket a 10 MB e ai soli `application/pdf`.

La scheda persona mostra una sezione **Contratti** con periodo, struttura, canone, stato e link alla scheda; se esiste già un contratto attivo, "Crea contratto" perde rilievo (diventa un'azione secondaria) invece di sparire, perché rinnovi e secondi contratti restano legittimi.

#### Chiusura del contratto

Un contratto attivo ha tre vie d'uscita, distinte dagli **stati di chiusura**: `scaduto` (il contratto è arrivato al suo termine), `risolto` (si è interrotto prima del termine, per partenza anticipata o per risoluzione) e `rinnovato` (è stato sostituito da un contratto successivo). La colonna `motivo_chiusura` registra il perché — `fine_naturale`, `partenza_anticipata`, `risoluzione`, `sostituzione` — ed è vincolata dal CHECK `contratti_motivo_chiusura_chk`, sullo stesso modello di quello già presente su `assegnazioni`: obbligatoria negli stati di chiusura, necessariamente nulla in `bozza` e `attivo`.

La **regola meccanica** che separa le due strade è una sola: se il contratto ha prodotto anche un solo fatto economico — una mensilità `fatturato` o `incassato`, oppure un deposito già incassato — può solo essere **chiuso**, perché la sua storia esiste ed è documentata. Se non ne ha prodotto nessuno, è un contratto attivato per errore e va **riportato in bozza**, non archiviato: archiviarlo lascerebbe per sempre nella storia della persona un rapporto che non è mai esistito.

**`chiudi_contratto(p_contratto_id, p_data_fine, p_motivo)`** esegue la chiusura in un'unica transazione. Lo stato **non** è un parametro: si deriva dal motivo con una mappa totale (`fine_naturale → scaduto`, `partenza_anticipata → risolto`, `risoluzione → risolto`, `sostituzione → rinnovato`), così il chiamante non può passare una coppia motivo/stato incoerente che il CHECK accetterebbe. La funzione **riscrive `data_fine`** con la data effettiva di chiusura — il periodo contrattuale registrato diventa quello realmente vissuto — e porta ad `annullato` le sole mensilità `da_fatturare` con competenza **successiva al mese** di chiusura: il mese in cui il contratto si chiude resta dovuto per intero, coerentemente con la regola provvisoria del canone intero sui mesi parziali. Le mensilità `fatturato` e `incassato` non vengono toccate: `canoni_protect_fatturati` è la rete di sicurezza, non la logica. Rifiuta con messaggio esplicito una `p_data_fine` pari o precedente a `data_inizio`: un contratto non può chiudersi prima di cominciare, e per quel caso la strada è "Riporta in bozza" seguita dall'eliminazione.

**`riporta_contratto_in_bozza(p_contratto_id)`** esiste per il contratto attivato per errore. Rifiuta se il contratto non è `attivo`, se esiste anche una sola mensilità `fatturato` o `incassato`, o se `deposito_stato` è diverso da NULL e da `atteso`. Cancella **tutte** le mensilità — passaggio necessario, non cosmetico: `attiva_contratto` rifiuta l'attivazione se ne esistono già, quindi senza cancellarle il contratto non sarebbe più riattivabile — e riporta lo stato a `bozza` azzerando `motivo_chiusura`. Entrambe le funzioni sono `SECURITY INVOKER`, con `EXECUTE` revocato a PUBLIC e concesso ai soli `authenticated`, come `attiva_contratto`.

Nella scheda contratto le azioni compaiono solo per lo stato `attivo`: "Chiudi contratto" (data effettiva precompilata a oggi, motivo fra fine naturale, partenza anticipata e risoluzione, anteprima di quante mensilità verranno annullate e quante restano intoccate) e "Riporta in bozza", visibile **solo** quando le condizioni sono soddisfatte; altrimenti al suo posto un testo spiega che il contratto ha già prodotto documenti fiscali e può solo essere chiuso. I contratti `scaduto`, `risolto` e `rinnovato` non offrono nessuna azione: sono chiusi.

#### Sostituzione e rinnovo

"Sostituisci contratto" copre il cambio in corso d'opera (camera diversa, canone diverso, prolungamento) e il rinnovo annuale, che è lo stesso gesto. L'ordine è **prima creare, poi chiudere**: si apre `ContrattoDialog` precompilato dal contratto in corso, che chiede anche la data di fine da applicare al vecchio; alla conferma nasce il nuovo contratto in `bozza` con `contratto_precedente_id` valorizzato, e **solo dopo** viene chiuso il vecchio con motivo `sostituzione`. L'ordine inverso lascerebbe, in caso di abbandono del dialogo, un contratto `rinnovato` senza successore e irrecuperabile, perché sia `chiudi_contratto` sia `riporta_contratto_in_bozza` pretendono lo stato `attivo`. Se fallisce la chiusura, il nuovo contratto resta una bozza eliminabile. La scheda mostra i due link di catena: "Sostituisce il contratto del …" e, sul vecchio, il rimando al successore.

#### Conclusione del soggiorno e contratto collegato

Concludere un soggiorno da Residenti non chiudeva il contratto collegato, che continuava a produrre mensilità per mesi inesistenti. Oggi, dopo la conclusione di un'assegnazione con un contratto `attivo` collegato (`contratti.assegnazione_id`), il sistema **propone** la chiusura — non la impone: si può rifiutare. La data è precompilata con quella di chiusura del soggiorno e il motivo è suggerito dal motivo dell'assegnazione: `fine_naturale → fine_naturale`, `partenza_anticipata` e `mai_arrivato → partenza_anticipata`, `allontanato → risoluzione`. Con motivo `trasferimento` non viene proposto nulla, perché il contratto sopravvive al cambio di camera. Se la data proposta è pari o precedente alla `data_inizio` del contratto — caso tipico del "mai arrivato", ma la condizione è generale — la chiusura non viene proposta: il dialogo spiega che il contratto non può chiudersi prima di cominciare e rimanda a "Riporta in bozza" nella sua scheda.

### Collegamento a Fatture in Cloud (nessun documento fiscale)

Il gestionale è collegato a Fatture in Cloud per la futura emissione dei documenti fiscali. In questa fase si leggono i dati dell'azienda e si allineano le **anagrafiche cliente**: nessun documento fiscale viene creato, modificato o inviato, e non esistono webhook.

- **Credenziali**: `FIC_ACCESS_TOKEN` e `FIC_COMPANY_ID` vivono solo nei secret del backend; non compaiono in tabelle, nel frontend o nei log.
- **`fic-test-connection`**: edge function riservata agli amministratori (`verify_jwt = true` più controllo `has_role` in apertura; **non** è nel perimetro pubblico del §7). Esegue una sola chiamata, `GET /c/{company_id}/company/info` (specifica OpenAPI ufficiale), che conferma token e azienda restituendo il nome dell'azienda. `/user/companies` non viene mai interrogata: esporrebbe token di accesso, e la partita IVA che restituirebbe non serve perché i dati del cedente li scrive Fatture in Cloud sul documento. Su `429` o `403` da superamento quota rispetta `Retry-After` e riprova al massimo due volte con attesa crescente, poi restituisce l'errore.
- **`fic_log`**: registro di ogni chiamata (operazione, metodo, endpoint, stato HTTP, esito, messaggio, `payload_ridotto` con campi selezionati esplicitamente — mai il token). È un **registro**, non una tabella di dominio: l'applicazione ha solo `GRANT SELECT` con policy admin, la scrittura è appannaggio esclusivo del `service_role`. Sarà il primo posto dove guardare quando una fattura non partirà. Su un rifiuto **400/422** il registro conserva la spiegazione di Fatture in Cloud (`fic_error_message`, `fic_validation_result`; se il corpo non è JSON, i primi 500 caratteri in `fic_error_raw`) e, nella sync, `campi_inviati` con i soli **nomi** dei campi valorizzati — mai i valori, che sono dati personali. Il messaggio all'operatore resta volutamente generico. **`fic-emetti-fattura` (D2) dovrà adottare lo stesso meccanismo**: lì un 422 senza spiegazione bloccherebbe un'emissione senza modo di ripararla.
- **Interfaccia**: sezione "Fatture in Cloud" in `/admin/impostazioni`, sotto Listini, con il solo comando "Verifica connessione" (`src/components/admin/impostazioni/FattureInCloudSection.tsx`).

#### Sincronizzazione dell'anagrafica cliente

- **`fic-sync-anagrafica`** (`supabase/functions/fic-sync-anagrafica/index.ts`): edge function riservata agli amministratori (`verify_jwt = true` in `supabase/config.toml` più controllo `has_role` in apertura; **non** è nel perimetro pubblico del §7). Riceve un solo `anagrafica_id`, rilegge la riga con il `service_role` e allinea il cliente su Fatture in Cloud. Con `fic_entity_id` nullo esegue `POST /c/{company_id}/entities/clients` e **salva l'id restituito**; con `fic_entity_id` valorizzato esegue `PUT /c/{company_id}/entities/clients/{client_id}`. Non esiste alcun percorso che crei una seconda volta un cliente già collegato: sarebbe un doppione nel registro fiscale del cliente. Stessa politica di retry di `fic-test-connection` (`Retry-After`, due tentativi) e stessa scrittura in `fic_log`, qui con `operazione = 'sync_anagrafica'`.
- **Se il `PUT` risponde `404`** — il cliente è stato cancellato dentro Fatture in Cloud — `fic_entity_id` viene azzerato, l'evento è registrato in `fic_log` e la cosa è **detta all'operatore**, che decide se ricreare il cliente ripetendo il comando. Non si ricrea da soli: la cancellazione può essere stata voluta.
- **Regole di mappatura**: vivono in un **unico modulo condiviso**, `supabase/functions/_shared/fic-anagrafica.ts`, importato sia dall'edge function sia dal frontend tramite l'alias `@shared` (`vite.config.ts`, `tsconfig.app.json`). `tipo = 'persona_fisica' → type: 'person'`, `soggetto_giuridico → 'company'` (l'enum ufficiale ammette anche `pa` e `condo`, non usati). `codiceDestinatarioProposto` — `0000000` per l'Italia, `XXXXXXX` per l'estero — è la stessa funzione che precompila il campo in `ContrattoDialog.tsx`: la regola era duplicata a mano in due punti del file, ora non più. **Mai un `null` esplicito nel payload**: Fatture in Cloud risponde `422 "must be a string"` a qualunque proprietà stringa inviata come `null` (verificato sul campo con `certified_email` e `vat_number`, riga `fic_log` del 05/09/2026), quindi ogni campo assente parte come **stringa vuota** — non come chiave omessa, perché su un `PUT` la chiave assente significa "lascia com'era" e non svuoterebbe mai il campo remoto (svuotare `tax_code` è esattamente ciò che serve per l'estero). Se in futuro FIC rifiutasse `""` su un campo specifico, per quel campo si ripiega sull'omissione dichiarandolo nel commento del modulo. Di conseguenza `ei_code` ripiega sul **valore vuoto** (`||`), non sul nullo (`??`): con la normalizzazione a `""` un `??` lascerebbe passare la stringa vuota e spedirebbe un `ei_code` vuoto, non ammesso sulla fattura elettronica. L'invariante "nessuna proprietà del payload è `null` né `undefined`" (undefined ometterebbe la chiave) è fissata da `src/test/fic-anagrafica.test.ts`, e **`fic-emetti-fattura` (D2) eredita la stessa mappatura senza riconversioni**.
- **Anagrafiche estere** (`indirizzo_nazione ≠ IT`): il codice fiscale non viene inviato; `address_postal_code` è `00000` e il CAP reale è accodato all'indirizzo; la provincia diventa `EE` se assente; per i paesi **Extra-UE** la partita IVA inviata è `OO99999999999`, mentre per i paesi UE si invia l'identificativo estero se presente e si lascia vuoto altrimenti. L'elenco dei 27 codici UE sta nello stesso modulo condiviso. La scheda contratto riepiloga a video tutte le trasformazioni applicate, così l'operatore vede cosa parte davvero.
- **Guardia sui dati incompleti** (due funzioni distinte in `fic-anagrafica.ts`, con base comune `baseCampiMancantiPerFic`): l'Italia richiede nome/denominazione, via, comune, CAP, provincia e almeno un identificativo fiscale; l'estero richiede solo nome/denominazione, via, comune e nazione, perché CAP e provincia sono comunque sostituiti dalla mappatura. La lista è **nostra, non dell'API**: nello schema OpenAPI ufficiale (`fattureincloud/openapi-fattureincloud`, `models/schemas/Client.yaml`) non esiste alcun campo `required` e ogni proprietà è nullable — serve a impedire fatture inintestabili, e senza questa nota qualcuno la allineerà allo schema e la svuoterà. `campiMancantiPerFicSync` è la soglia di `fic-sync-anagrafica` (blocca la chiamata prima di toccare l'API) e **non** richiede l'email di recapito, che non serve a creare il cliente. `campiMancantiPerFattura` risponde a "cosa manca per emettere": stessa base **più l'email di recapito**, perché al momento della fattura serve un recapito e per gli esteri l'email è l'unico possibile (lo SDI non consegna all'estero); in `ContrattoDialog.tsx` produce l'avviso non bloccante e in D2 sarà riusata prima dell'emissione — il nome descrive la domanda, non il chiamante. Le regole sono fissate dalla suite `src/test/fic-anagrafica.test.ts`.
- **Interfaccia**: riquadro "Intestazione fattura" in `/admin/contratti/:id`, con stato del collegamento, id remoto e comando "Sincronizza con Fatture in Cloud" (`src/components/admin/contratti/FicSyncAnagrafica.tsx`).
- **Modifica dell'intestazione dopo la creazione** (`src/components/admin/contratti/IntestazioneFatturaDialog.tsx`, aperto dal pulsante "Modifica" del riquadro): riusa i campi di creazione, estratti in `AnagraficaFatturazioneFields.tsx` insieme agli helper puri `anaVuota`, `anaDaRiga`, `payloadAnagrafica`, `erroreAnagrafica` e al campo `F` (a livello di modulo: annidarlo farebbe perdere il focus agli input). Regole:
  - se esistono mensilità `fatturato` o `incassato`, avviso in evidenza — le fatture già emesse restano intestate a chi erano — ma **nessun blocco**: cambiare intestatario a metà contratto è legittimo;
  - il conteggio "usata anche da N altri contratti" è calcolato sulla **riga che verrà scritta**, non su quella attualmente collegata: la decisione è la funzione pura `rigaDestinazioneAnagrafica` (`src/lib/anagraficaFatturazione.ts`, test `src/test/anagrafica-fatturazione.test.ts`), che alimenta sia l'avviso sia il salvataggio;
  - modalità "studente": si aggiorna l'unica anagrafica dello studente (indice unico parziale `anagrafiche_fatt_studente_uniq`) o la si crea; modalità "altro soggetto" partendo da un'intestazione allo studente: si **inserisce una nuova riga** con `studente_id` nullo e si aggiorna `contratti.anagrafica_fatturazione_id`. L'anagrafica dello studente non viene mai cancellata: appartiene alla persona e serve ai contratti successivi.
  - **il cambio di modalità ricarica i campi** (`caricaAnaStudente` in `src/components/admin/contratti/anagraficaStudente.ts`, usata anche dalla precompilazione di `ContrattoDialog.tsx`): verso "studente" si legge l'anagrafica dello studente o si precompila da `studenti`; verso "altro soggetto" si svuotano i campi identificativi (`anaTerzoVuota`). Senza questo, i dati della società finirebbero sull'anagrafica dello studente — condivisa e spinta su Fatture in Cloud — e il codice fiscale dello studente sulla riga della società. Se il caricamento fallisce la modalità **resta quella di partenza** e l'errore viene mostrato; in `ContrattoDialog` senza studente selezionato il passaggio a "studente" svuota i campi e non carica nulla.

  - dopo un salvataggio su un'anagrafica con `fic_entity_id`, la pagina invita a risincronizzare. **È una comodità, non un presidio**: lo stato è locale e sparisce al ricaricamento. Poiché all'emissione si manda `entity.id`, un cliente disallineato produrrebbe una fattura con l'intestazione memorizzata su Fatture in Cloud, correggibile solo con nota di credito: il presidio vero è in D2, dove `fic-emetti-fattura` risincronizzerà con lo stesso PUT idempotente **prima** di creare il documento.


### Pagina persona

La finestra modale di dettaglio candidatura è sostituita da una pagina dedicata: `/admin/studenti/:id` (`src/pages/admin/StudentePage.tsx`). Contiene, nell'ordine:

1. anagrafica della persona, mostrata una sola volta in alto;
2. i **blocchi delle sue candidature**, collassabili singolarmente (aperto solo quello indicato nell'URL o, in assenza, il più recente), ciascuno con le dichiarazioni congelate a quella candidatura, i documenti caricati, la timeline dei cambi di stato e le note admin;
3. lo **storico dei soggiorni**.

Le liste (Candidature, Residenti) sono costruite sulla vista `v_studenti_stadio` tramite l'helper `fetchStadi` (`src/lib/studentiQuery.ts`) e navigano alla scheda preservando i filtri correnti tramite query string: il tasto "Torna alla lista" ricostruisce l'URL di partenza. Le azioni disponibili nel menu di riga e nella scheda persona sono lette dalla stessa definizione condivisa (`getAvailableActions` in `src/lib/candidaturaActions.ts`) e decidono in base allo **stadio persona**, non allo stato candidatura: lista e scheda non possono divergere.

**Ripartizione delle liste per stadio:**

- **Candidature** (`/admin/candidature`): mostra `da_valutare`, `in_attesa_studente`, `da_decidere`, `in_attesa_posto`. Il filtro stadio consente anche `archiviato`.
- **Residenti** (`/admin/residenti`): mostra `assegnato` (candidatura accolta con posto pre-arrivo) e `in_casa` (soggiorno in corso). Include anche `archiviato` come filtro opt-in.

**Azioni per stadio (sintesi):** `da_valutare` → invia form completo · assegna posto · lista d'attesa · rifiuta. `in_attesa_studente` → invia/rigenera link (principale) · assegna posto · lista d'attesa · rifiuta. `da_decidere` → assegna posto · lista d'attesa · rifiuta. `in_attesa_posto` → assegna posto · aggiorna priorità · rifiuta. `assegnato` → comunica esito · annulla assegnazione. `in_casa` → azioni da Residenti (trasferisci, concludi). `archiviato` → solo contatta/elimina.

**Eliminazione candidatura:** `elimina` è offerta sugli stadi non ancora "in casa" — `da_valutare`, `in_attesa_studente`, `da_decidere`, `in_attesa_posto`, `archiviato` — e solo se la persona non ha mai avuto un'assegnazione. Gli stadi `assegnato` e `in_casa` non la offrono mai. La guardia definitiva è lato server: `delete-candidatura` rifiuta con `409` se esiste una qualsiasi assegnazione collegata.

"Assegna posto" naviga a `/admin/camere?candidatura=…` che apre il flusso di assegnazione; alla conferma la candidatura passa contestualmente a `accolta`. "Annulla assegnazione" cancella la riga di assegnazione (solo pre-arrivo) e riporta la candidatura a `da_decidere` azzerando `esito_email_inviata_il`; se il soggiorno è già iniziato bisogna usare "Concludi" da Residenti.

---

## 9. Vincoli esterni

### Finanziamento PNRR

Le due sedi sono finanziate nell'ambito del **PNRR Missione 4 Componente 1** (Ministero dell'Università e della Ricerca), con due codici CUP distinti. È probabilmente l'origine della tariffa DSU agevolata a 250 €/mese.

**Punto aperto:** non è stato verificato se il finanziamento comporti obblighi di rendicontazione che richiedano di tracciare quali posti letto sono assegnati a tariffa agevolata. Oggi il sistema non distingue in alcun modo i posti DSU dagli altri. Da chiarire prima della Fase 2.

### Protezione dei dati

L'informativa pubblicata è su `studentatoeuropa.it/privacy-policy`. Titolare: Navona S.r.l.

La spunta privacy del form di candidatura è formulata come **presa visione** ("Dichiaro di aver preso visione dell'informativa privacy") e rimanda al documento pubblicato tramite `PRIVACY_POLICY_URL` (`src/lib/privacy.ts`). La formulazione è coerente con la base giuridica dichiarata nell'informativa, che non poggia sul consenso.

**L'informativa non copre adeguatamente ciò che l'app raccoglie.** I rilievi seguenti risultano tutti aperti:

- Due segnaposto non compilati sono pubblicati sulla pagina live: l'indirizzo della sede legale e il nome del fornitore del gestionale (quest'ultimo compare due volte)
- Il §2.2 descrive un modulo di contatto con nome, email, telefono e messaggio. L'app raccoglie molto di più: codice fiscale, numero e scansione del documento d'identità, indirizzo di residenza, certificato di iscrizione, dati accademici, informazioni sullo stile di vita e una presentazione personale
- Il §2.3 copre gli studenti **che hanno sottoscritto un contratto**. I candidati respinti o mai contrattualizzati non sono coperti da nessuna sezione, e non esiste un periodo di conservazione dichiarato per le loro candidature
- **Il garante non è menzionato.** I suoi dati e il suo documento d'identità sono caricati da un terzo, e lui non ha mai visitato il sito. È una raccolta indiretta che richiede un'informativa dedicata
- Non sono menzionati il sottodominio `app.studentatoeuropa.it`, i sub-responsabili infrastrutturali, né la localizzazione dei dati

### Fiscalità

Aperto e propedeutico alla Fase 2: la classificazione fiscale del rapporto (prestazione di servizi contro locazione residenziale, con IVA probabilmente al 10%) va validata dal commercialista di Daniela, insieme alla scelta della piattaforma di fatturazione.

---

## 10. Cosa il sistema NON fa

Perimetro della Fase 1. Tutto quanto segue è **fuori scopo** e non va costruito senza una decisione esplicita:

- Non gestisce contratti di locazione né la loro registrazione
- Non emette fatture e non dialoga con lo SDI
- Non gestisce depositi cauzionali, pagamenti, scadenzari
- Non tratta importi, canoni o tariffe
- Non ha un'area studente
- Non traccia quali posti sono a tariffa agevolata DSU
- Non gestisce check-in, pulizie, badge di accesso, richieste di cambio stanza
- Non ha notifiche in tempo reale né uso multi-operatore concorrente

Contratti e fatturazione sono oggetto di una proposta integrativa separata (Fase 2, pianificata luglio–agosto 2026).

---

## 11. Decisioni prese, e perché

| Decisione | Motivo |
|---|---|
| Flusso candidatura a due fasi | Richiesta esplicita della direzione: filtro iniziale prima di chiedere l'intera documentazione |
| Nessun account studente | Semplicità del percorso di candidatura, pilastro confermato del posizionamento. Riduce drasticamente la superficie di sicurezza |
| Email di esito manuale, non automatica | Una comunicazione di esito merita una rilettura umana |
| Conferma ricezione e link completamento automatiche | Sono conferme operative, non giudizi |
| Regole di dominio nei trigger | Il frontend è aggirabile, il database no |
| Ruoli in tabella dedicata | I metadati utente sono scrivibili dal client |
| Token di completamento salvato come hash | Chi legge il database non può usare i link |
| Email in coda asincrona | Un fallimento di invio non deve mai far perdere una candidatura |
| Gestionale su misura invece di un PMS di mercato | I PMS alberghieri costano 100–400 €/mese per funzioni non pertinenti e mancano di ciò che serve; i gestionali immobiliari sono sovradimensionati per 82 posti |
| Rimozione del form configurabile | La funzionalità era di fatto inutilizzata; il modello dati resta più semplice e chiude una superficie di rischio |
| Rimozione dello stato intermedio `in_valutazione` | Il flusso reale ha un solo passaggio decisionale (approva/rifiuta): uno stato in mezzo era rumore |
| Dominio stati candidatura ridisegnato (`da_valutare` / `in_attesa_studente` / `da_decidere` / `accolta` / `in_attesa_posto` / `rifiutata`) | Allinea il modello al lessico operativo della direzione e distingue chi aspetta il posto da chi è già dentro |
| Stato camera manuale, occupazione derivata dalle assegnazioni | Separa lo stato fisico (manutenzione, fuori uso) dall'occupazione, che è già ricavabile: rimosso il trigger di sincronizzazione che rendeva il campo di sola scrittura del DB |
| Vincolo temporale `EXCLUDE` GIST sulle assegnazioni | Impedisce a livello DB doppie occupazioni dello stesso posto in periodi che si intersecano, anche per range storici, non solo fra assegnazioni attive |
| Anagrafica fiscale strutturata su `studenti` | Necessaria per contrattualizzazione e rendicontazione, separata dai dati della singola candidatura |
| Vista `v_studenti_stadio` come lettura unificata dello stadio persona | Evita di ricomporlo in ogni pagina con join ad hoc |
| Documenti spostati fuori da `pending/` a fine invio | Separa il temporaneo dal definitivo, riduce residui e rende chiaro cosa appartiene a una candidatura reale |
| Insieme fisso dei tipi documento in un modulo condiviso | Impedisce che client, edge function e vincolo DB divergano nel tempo |
| Filtro sede come contesto globale dell'area admin | Impedisce filtri locali reimplementati per pagina, che avevano già prodotto incoerenze |
| Pagina persona al posto della modale di dettaglio | Dà spazio ai dati, permette navigazione con URL condivisibile e distingue la persona dalla singola candidatura |
| Azioni candidatura definite in un unico punto | Lista e scheda leggono dalla stessa definizione: non possono mostrare azioni diverse per la stessa candidatura |

---

## 12. Regole per chi ci mette mano

1. **`camere.stato` è manuale** (`disponibile` / `manutenzione` / `non_disponibile`) e descrive lo stato fisico del posto letto. L'occupazione **non** si scrive lì: si legge dalle assegnazioni. Non reintrodurre trigger di sincronizzazione.
2. **Ogni nuovo endpoint pubblico valida server-side.** Tipi, lunghezze, formati. La validazione client è UX.
3. **Ogni nuova email passa da `enqueue-transactional.ts`.** Non ricostruire il payload a mano: mancherebbero `idempotency_key` e `unsubscribe_token`.
4. **Ogni nuova funzione `SECURITY DEFINER` va revocata esplicitamente da `PUBLIC`, `anon` e `authenticated`.** Revocare solo da `PUBLIC` non basta: Supabase concede l'esecuzione ad `anon` e `authenticated` separatamente. Questo errore è già stato commesso su sei funzioni.
5. **Ogni nuova funzione ha `SET search_path`.**
6. **Ogni nuova pagina con dati per sede espone il filtro sede.** L'hook `useStrutturaFilter` non esiste più (il filtro sede globale è stato rimosso): il filtro vive nel query param `sede` della pagina, con un `Select` popolato da `strutture`, come in Candidature, Residenti e Contratti.
7. **Le metriche di occupazione si calcolano dalle assegnazioni attive**, mai dalla struttura preferita in candidatura.
8. **Prima di dichiarare chiuso un intervento, rileggere il codice.** È già successo che un fix riportato come completato non fosse presente.
9. **Il design system è in `design-system.md`** e va rispettato: token semantici, mai colori hard-coded, componenti shadcn mai riscritti.
10. **Se una modifica tocca dati personali, verificare che l'informativa la copra** prima di rilasciarla.
11. **Non scrivere righe di transizione in `log_stato_candidature` dal codice applicativo.** Lo fa il trigger. Le funzioni server possono inserire solo righe di evento (`stato_precedente = stato_nuovo`) con una nota che ne spiega il significato.
12. **I tipi documento si prendono da `supabase/functions/_shared/documenti-tipi.ts`.** Non riscrivere l'elenco in edge function o componenti: divergerebbe dal vincolo DB.
13. **Il filtro sede sta nel query param `sede`** e si comporta in modo identico su tutte le liste: stesso `Select`, stesse etichette, stesso reset di pagina. Non introdurre varianti locali.
14. **Lo stato di una lista (ricerca, filtri, pagina) vive nell'indirizzo (query params).** Non in navigation state, non in `useState` locale che va perso alla navigazione: la pagina persona deve poter ricostruire l'URL di ritorno.
15. **Le azioni disponibili su una candidatura si leggono da `getAvailableActions`** in `src/lib/candidaturaActions.ts`. Lista e scheda persona non devono mai calcolarle in modo indipendente.
16. **Le ricerche di posti liberi per intervallo passano dalla funzione `camere_disponibilita`.** Non ricalcolare a mano in JS lo stato di occupazione per periodo: la funzione conosce le assegnazioni sovrapposte e il vincolo `EXCLUDE`.
17. **Non aggirare il vincolo `EXCLUDE` GIST sulle assegnazioni** (niente `SET session_replication_role`, niente `DELETE + INSERT` in transazioni allentate): se serve modificare un periodo che si sovrappone, chiudere prima l'assegnazione confliggente con un `motivo_chiusura`.
18. **La marcatura "esito da comunicare" si legge/scrive tramite `candidature.esito_email_inviata_il`**, non con un campo di stato dedicato: una candidatura in `accolta` o `rifiutata` con `esito_email_inviata_il IS NULL` è da comunicare.

---

## 13. Rilievi di sicurezza archiviati

Rilievi già esaminati e chiusi come non applicabili al perimetro attuale. Sono elencati qui insieme alla **condizione che li renderebbe di nuovo rilevanti**, così che in una prossima revisione non vengano riaperti per abitudine.

- **Formule negli export.** Gli export sono in formato **XLSX**, dove il tipo della cella è dichiarato nel file e il testo non viene reinterpretato come formula. Il rilievo tornerebbe rilevante se venisse introdotto un export in **CSV**, formato in cui i valori che iniziano per `=`, `+`, `-`, `@` vengono interpretati come formula da alcuni fogli di calcolo.
- **`candidatura_sessioni` senza policy RLS.** La tabella ha **RLS attiva e nessuna policy**, che è la configurazione più restrittiva possibile: la lettura e la scrittura passano solo dal ruolo `service_role`, che non è soggetto alle policy. Aggiungere una policy scritta larga la aprirebbe invece di chiuderla. Il rilievo tornerebbe rilevante solo se si volesse esporre la tabella a un ruolo applicativo (`anon` o `authenticated`).
- **Restrizione delle origini (CORS) sulle edge function.** Non applicata deliberatamente: il CORS è imposto dal browser e non protegge da chiamate non-browser, mentre gli endpoint amministrativi richiedono comunque un token valido. Il rilievo tornerebbe rilevante se un endpoint si autenticasse tramite cookie (soggetto a CSRF) o se restituisse dati sensibili senza autenticazione.
- **`camere_disponibilita` non filtra su `strutture.attiva`.** Le camere appartenenti a strutture disattivate compaiono comunque nei conteggi restituiti dalla funzione. È intenzionale: la disattivazione di una struttura è un flag amministrativo di visibilità nella lista sedi, non una rimozione dei posti letto — le assegnazioni storiche e in corso su quella struttura continuano a esistere. Il filtro per `attiva`, se serve nella UI, va applicato dal chiamante.
- **`v_studenti_stadio.struttura_id` per lo stadio `archiviato` ricade sulla struttura preferita dichiarata in candidatura**, non su quella dell'ultima camera occupata. Motivo: le assegnazioni concluse non entrano nel join laterale della vista, quindi per gli archiviati l'unico riferimento disponibile è la preferenza espressa. È accettabile per la UI di storico attuale; se in futuro servisse la sede reale dell'ultimo soggiorno, va aggiunto un join dedicato sulle assegnazioni concluse più recenti anziché "correggere" la vista in modo silenzioso.
