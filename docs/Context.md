# Studentato Europa — Gestionale: contesto e funzionamento

**Destinazione:** sezione `/docs` dell'applicazione
**Ultimo aggiornamento:** 27 luglio 2026
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

Lo studente compila il form su `/candidatura`. Raccoglie:

- **Anagrafica:** nome, cognome, email, telefono, data di nascita, nazionalità, codice fiscale, indirizzo di residenza, numero documento d'identità
- **Dati accademici:** università, dipartimento, corso di studi, anno di corso, tipologia (universitario / Erasmus / master / altro)
- **Preferenze:** struttura, tipo camera, periodo inizio e fine, data di arrivo prevista, note
- **Documenti:** documento d'identità, certificato di iscrizione
- **Attribuzione:** come ha conosciuto lo Studentato Europa
- **Dichiarazioni:** veridicità, privacy, presa visione informazioni struttura, autorizzazione al contatto — tutte e quattro obbligatorie

I file passano da `upload-candidatura-doc`, che li deposita in `pending/{temp_id}/{tipo}/{nome_file}`. Il record viene poi creato da `submit-candidatura`, che collega i documenti già caricati.

Stato risultante: **`ricevuta`**. Parte in automatico l'email di conferma ricezione.

### Fase 2 — Completamento (su invito, con token)

Se il candidato supera il filtro iniziale, l'amministratore genera un link di completamento da `/admin/candidature`. `generate-completion-link` produce un token casuale da 32 byte, ne salva **solo l'hash SHA-256** sul record, imposta una scadenza a 21 giorni e invia in automatico l'email con il link.

Il candidato apre `/candidatura/completa/{token}` e compila il secondo blocco:

- **Stile di vita:** lingue parlate, orari prevalenti, personalità, abitudini di ordine e pulizia, fumatore, presentazione personale
- **Garante:** nome, relazione, telefono, email
- **Documenti aggiuntivi:** documento d'identità del garante (obbligatorio), documentazione ulteriore (facoltativa)

Il token viene validato da `get-completion-form` prima di mostrare il modulo e di nuovo da `complete-candidatura` al momento dell'invio. È monouso: dopo il completamento il link restituisce `410`.

Stato risultante: **`completata`**.

### Fase 3 — Valutazione e assegnazione

L'amministratore approva o rifiuta la candidatura. L'azione è disponibile sia da `ricevuta` (candidatura arrivata ma senza il blocco completo) sia da `completata` (candidatura con anche stile di vita, garante e documenti del garante). Il passaggio ad `approvata` o `rifiutata` fa scattare il trigger `candidature_flag_esito_email`, che marca la candidatura come "esito da comunicare" e la fa comparire nella sezione **Task** della Dashboard.

Da `approvata` o `rifiutata` è possibile **riaprire** la candidatura: torna a `completata` se esiste un form completo, altrimenti a `ricevuta` (logica in `reopenStato`, `src/lib/candidaturaActions.ts`). La riapertura non è possibile se esiste già un'assegnazione attiva, per garanzia del trigger `candidature_check_stato_vs_assegnazione`.

L'invio dell'email di esito è **manuale**, non automatico: l'amministratore la conferma dalla scheda candidatura e può aggiungere una nota libera. Scelta deliberata — l'esito di una candidatura è una comunicazione che merita una rilettura umana.

Al candidato approvato viene poi assegnato un posto in una camera specifica. Nasce un record in `assegnazioni`, che è l'oggetto che rappresenta il soggiorno.

### Stati possibili

**Candidature:** `ricevuta` → (`in_completamento` →) `completata` → `approvata` | `rifiutata`. Più `ritirata` (rinuncia del candidato) e `sostituita`. Lo stato intermedio `in_valutazione` non esiste: approvazione e rifiuto avvengono direttamente da `ricevuta` o `completata`.

**Camere:** `libera`, `parzialmente_occupata`, `occupata`, `manutenzione`, `non_disponibile`.

**Assegnazioni:** `attiva`, `conclusa`, `annullata`.

---

## 4. Modello dati

### Tabelle di dominio

| Tabella | Contenuto |
|---|---|
| `strutture` | Le due sedi. Unica tabella con lettura pubblica (solo se `attiva = true`) |
| `camere` | Camere per struttura: numero, piano, tipo, posti, stato |
| `studenti` | Anagrafica della persona, separata dalla candidatura. Email univoca |
| `candidature` | La richiesta: stato, preferenze, dati accademici in snapshot, dichiarazioni, token di completamento, campi di gestione email |
| `assegnazioni` | Il soggiorno: studente, candidatura, camera, posto (1 o 2), date, stato |
| `documenti` | Metadati dei file caricati, con riferimento al path in storage |
| `log_stato_candidature` | Traccia automatica di ogni cambio di stato |
| `user_roles` | Ruoli applicativi. Tabella separata da `auth.users` per scelta di sicurezza |

**Perché `studenti` è separata da `candidature`:** una persona può candidarsi più volte, o candidarsi e poi diventare residente. Tenere l'identità separata dalla richiesta evita duplicazioni e permette di ricostruire la storia di una persona.

**Perché i dati accademici sono anche in snapshot su `candidature`:** i campi `universita_snapshot`, `corso_snapshot`, `anno_corso_snapshot` congelano la situazione al momento della candidatura. Se lo studente cambia corso, la candidatura resta leggibile com'era.

### Tabella di sessione candidatura

`candidatura_sessioni` registra ogni apertura del form pubblico: `temp_id` (UUID generato dal client), `origine` (`pubblica` o `completamento`), `upload_count`, `consumata_il`. Serve a due cose: dimostrare che chi carica un documento ha effettivamente aperto il form (validazione Cloudflare Turnstile per il form pubblico, token di completamento per quello su invito) e limitare il numero di upload per sessione.

La tabella è scritta esclusivamente da funzioni `SECURITY DEFINER` (`check_candidatura_sessione`, `consume_candidatura_upload_slot`, `consume_candidatura_sessione`) invocate dalle edge function pubbliche. Ha **RLS attiva e zero policy**: è la configurazione più restrittiva possibile e l'accesso passa solo dal ruolo `service_role`, che non è soggetto alle policy. Non aggiungere policy: una policy scritta larga la aprirebbe invece di chiuderla (vedi §"Rilievi di sicurezza archiviati").

### Tabelle di infrastruttura email

`email_send_log`, `suppressed_emails`, `email_unsubscribe_tokens`, più le code `pgmq`. Accessibili unicamente dal ruolo `service_role`: nessun accesso applicativo, per design.

---

## 5. Le regole di dominio stanno nel database

Questa è la scelta architetturale più importante del sistema, e va rispettata: **le invarianti di dominio sono applicate da trigger PostgreSQL, non dal frontend.** Il frontend può essere aggirato, il database no.

| Trigger | Cosa garantisce |
|---|---|
| `camere_sync_stato` | Lo stato della camera deriva dalle assegnazioni attive. È l'unica fonte di verità |
| `camere_check_posti` | Non si può ridurre il numero di posti sotto il numero di occupanti attivi |
| `assegnazioni_check_overbooking` | Nessun overbooking, nessuna assegnazione su camera in manutenzione, posto entro il range |
| `candidature_check_stato_vs_assegnazione` | Non si può togliere l'approvazione a una candidatura con assegnazione attiva |
| `candidature_log_stato` | Ogni cambio di stato viene tracciato automaticamente |
| `candidature_flag_esito_email` | Marca l'esito da comunicare quando la candidatura viene approvata o rifiutata |

C'è anche un indice univoco parziale su `(camera_id, posto)` per le assegnazioni attive: due persone non possono occupare lo stesso posto nemmeno in caso di scrittura concorrente.

**Conseguenza pratica:** non scrivere mai `camere.stato` dal codice applicativo. Lo fa il trigger. Scritture ridondanti sono già state rimosse una volta e non vanno reintrodotte.

### Registro dei cambi di stato: transizioni vs eventi

Le righe di `log_stato_candidature` sono di due tipi:

- **Righe di transizione** (`stato_precedente` ≠ `stato_nuovo`): scritte **esclusivamente** dal trigger `candidature_log_stato` a ogni `UPDATE` di `candidature.stato`. Il codice applicativo non deve mai inserire righe di transizione: farebbe duplicati e/o incoerenze rispetto allo stato reale della candidatura.
- **Righe di evento** (`stato_precedente = stato_nuovo`, con `note`): scritte dalle funzioni server per lasciare traccia di azioni che non cambiano lo stato ma sono rilevanti nella cronologia. Oggi l'unico caso è `complete-candidatura`, che inserisce una riga di evento con nota "Form completo inviato dallo studente" quando il candidato invia la fase 2.

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

Cinque edge function sono raggiungibili senza autenticazione: `submit-candidatura`, `complete-candidatura`, `get-completion-form`, `upload-candidatura-doc`, e il webhook `auth-email-hook`.

Tutte validano server-side: tipi, lunghezze massime, regex su email e date, formato UUID, formato dei path di storage. La validazione lato client esiste per l'esperienza d'uso, non per la sicurezza.

I messaggi di errore verso l'utente sono generici, il dettaglio finisce nei log lato server. Non introdurre messaggi che espongano nomi di tabella o struttura delle query.

### Documenti e storage

Il bucket `documenti_studenti` è privato: gli amministratori leggono tramite signed URL a scadenza breve, nessuna lettura pubblica.

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

Il sistema nasce multi-sede. Il filtro sede non è un filtro locale di pagina ma un **contesto globale** dell'area amministrativa, con sorgente unica in `StrutturaFilterProvider` (`src/hooks/useStrutturaFilter.ts`) e presentato nella top bar. Ogni pagina admin lo legge via `useStrutturaFilter()` e rifetcha automaticamente al cambio di valore. Non reimplementare filtri locali: è già successo una volta e ha prodotto incoerenze fra pagine.

**Eccezione**: la pagina `/admin/strutture` elenca sempre tutte le sedi (attive e disattivate), indipendentemente dal valore del filtro globale, perché è la pagina in cui le sedi si gestiscono.

Attenzione a una distinzione che ha già causato un bug: `candidature.struttura_preferita_id` è una **preferenza espressa dal candidato**, non un'occupazione. L'occupazione reale si legge dalle assegnazioni attive risalendo alla struttura della camera. Le metriche di occupazione devono usare la seconda, mai la prima.

---

## 8bis. Area amministrativa

L'area `/admin` è organizzata attorno a `AdminLayout`, che fornisce:

- una **sidebar** con le voci principali (Dashboard, Candidature, Residenti, Camere, Strutture, Storico);
- una **top bar globale** con titolo della pagina corrente e selettore struttura.

Le pagine sotto `/admin` **non** stampano più un proprio titolo o sottotitolo: iniziano direttamente dalla toolbar filtri o dal contenuto. Il titolo mostrato in top bar è risolto in ordine da un override esplicito (`usePageTitle(label)` per rotte con parametri variabili, es. `"Rossi Mario"` sulla pagina persona) oppure da una mappa statica `rotta → label` per le rotte fisse.

### Pagina persona

La finestra modale di dettaglio candidatura è sostituita da una pagina dedicata: `/admin/studenti/:id` (`src/pages/admin/StudentePage.tsx`). Contiene, nell'ordine:

1. anagrafica della persona, mostrata una sola volta in alto;
2. i **blocchi delle sue candidature**, collassabili singolarmente (aperto solo quello indicato nell'URL o, in assenza, il più recente), ciascuno con le dichiarazioni congelate a quella candidatura, i documenti caricati, la timeline dei cambi di stato e le note admin;
3. lo **storico dei soggiorni**.

Le liste (Candidature, Residenti) navigano a questa pagina preservando i filtri correnti tramite query string: il tasto "Torna alla lista" ricostruisce l'URL di partenza. Le azioni disponibili nel menu di riga e nella scheda persona sono lette dalla stessa definizione condivisa (`getAvailableActions` in `src/lib/candidaturaActions.ts`), così lista e scheda non possono divergere.

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
| Documenti spostati fuori da `pending/` a fine invio | Separa il temporaneo dal definitivo, riduce residui e rende chiaro cosa appartiene a una candidatura reale |
| Insieme fisso dei tipi documento in un modulo condiviso | Impedisce che client, edge function e vincolo DB divergano nel tempo |
| Filtro sede come contesto globale dell'area admin | Impedisce filtri locali reimplementati per pagina, che avevano già prodotto incoerenze |
| Pagina persona al posto della modale di dettaglio | Dà spazio ai dati, permette navigazione con URL condivisibile e distingue la persona dalla singola candidatura |
| Azioni candidatura definite in un unico punto | Lista e scheda leggono dalla stessa definizione: non possono mostrare azioni diverse per la stessa candidatura |

---

## 12. Regole per chi ci mette mano

1. **Non scrivere `camere.stato` dal codice.** Lo gestisce il trigger.
2. **Ogni nuovo endpoint pubblico valida server-side.** Tipi, lunghezze, formati. La validazione client è UX.
3. **Ogni nuova email passa da `enqueue-transactional.ts`.** Non ricostruire il payload a mano: mancherebbero `idempotency_key` e `unsubscribe_token`.
4. **Ogni nuova funzione `SECURITY DEFINER` va revocata esplicitamente da `PUBLIC`, `anon` e `authenticated`.** Revocare solo da `PUBLIC` non basta: Supabase concede l'esecuzione ad `anon` e `authenticated` separatamente. Questo errore è già stato commesso su sei funzioni.
5. **Ogni nuova funzione ha `SET search_path`.**
6. **Ogni nuova pagina con dati per sede usa `useStrutturaFilter`.**
7. **Le metriche di occupazione si calcolano dalle assegnazioni attive**, mai dalla struttura preferita in candidatura.
8. **Prima di dichiarare chiuso un intervento, rileggere il codice.** È già successo che un fix riportato come completato non fosse presente.
9. **Il design system è in `design-system.md`** e va rispettato: token semantici, mai colori hard-coded, componenti shadcn mai riscritti.
10. **Se una modifica tocca dati personali, verificare che l'informativa la copra** prima di rilasciarla.
11. **Non scrivere righe di transizione in `log_stato_candidature` dal codice applicativo.** Lo fa il trigger. Le funzioni server possono inserire solo righe di evento (`stato_precedente = stato_nuovo`) con una nota che ne spiega il significato.
12. **I tipi documento si prendono da `supabase/functions/_shared/documenti-tipi.ts`.** Non riscrivere l'elenco in edge function o componenti: divergerebbe dal vincolo DB.
13. **Il filtro sede si legge da `useStrutturaFilter`.** Non reimplementare selettori locali per pagina.
14. **Lo stato di una lista (ricerca, filtri, pagina) vive nell'indirizzo (query params).** Non in navigation state, non in `useState` locale che va perso alla navigazione: la pagina persona deve poter ricostruire l'URL di ritorno.
15. **Le azioni disponibili su una candidatura si leggono da `getAvailableActions`** in `src/lib/candidaturaActions.ts`. Lista e scheda persona non devono mai calcolarle in modo indipendente.

---

## 13. Rilievi di sicurezza archiviati

Rilievi già esaminati e chiusi come non applicabili al perimetro attuale. Sono elencati qui insieme alla **condizione che li renderebbe di nuovo rilevanti**, così che in una prossima revisione non vengano riaperti per abitudine.

- **Formule negli export.** Gli export sono in formato **XLSX**, dove il tipo della cella è dichiarato nel file e il testo non viene reinterpretato come formula. Il rilievo tornerebbe rilevante se venisse introdotto un export in **CSV**, formato in cui i valori che iniziano per `=`, `+`, `-`, `@` vengono interpretati come formula da alcuni fogli di calcolo.
- **`candidatura_sessioni` senza policy RLS.** La tabella ha **RLS attiva e nessuna policy**, che è la configurazione più restrittiva possibile: la lettura e la scrittura passano solo dal ruolo `service_role`, che non è soggetto alle policy. Aggiungere una policy scritta larga la aprirebbe invece di chiuderla. Il rilievo tornerebbe rilevante solo se si volesse esporre la tabella a un ruolo applicativo (`anon` o `authenticated`).
- **Restrizione delle origini (CORS) sulle edge function.** Non applicata deliberatamente: il CORS è imposto dal browser e non protegge da chiamate non-browser, mentre gli endpoint amministrativi richiedono comunque un token valido. Il rilievo tornerebbe rilevante se un endpoint si autenticasse tramite cookie (soggetto a CSRF) o se restituisse dati sensibili senza autenticazione.
