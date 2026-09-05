# Inserimento manuale di una persona: il percorso in area admin

Obiettivo: dare all'amministrazione un modo per registrare a mano una persona mai passata dal form pubblico, appoggiandosi alla funzione `crea_persona_manuale`, che in questo giro viene corretta: lo stato della candidatura non è più costante ma derivato dalla presenza dell'assegnazione.

## Verifiche fatte prima di scrivere il piano

- **La Dashboard oggi non ha nessun conteggio degli esiti da comunicare.** Cercata la condizione in tutto `src/`: in `src/pages/admin/Dashboard.tsx` non compare né `esito` né `accolta`/`rifiutata`; i blocchi "Da fare" e "Richiede attenzione" contano solo candidature per stato, camere in manutenzione e soggiorni in scadenza. Il punto 1 della richiesta, come formulato, non ha oggetto sulla Dashboard.
- Le occorrenze reali della condizione "accolta o rifiutata con `esito_email_inviata_il` nullo" sono **due**, entrambe fuori dalla Dashboard:
  1. `src/components/admin/candidatura/CandidaturaBadges.tsx` riga 44 — badge "Esito da comunicare".
  2. `src/lib/candidaturaActions.ts` righe 148-152 — azione `invia_esito`, che compare per ogni candidatura `accolta`/`rifiutata` e cambia solo etichetta a seconda di `esito_email_inviata_il`.
- `fetchStadi` (`src/lib/studentiQuery.ts`) legge da `candidature` un elenco esplicito di colonne che **non** comprende `origine`: per poter escludere gli inserimenti manuali va aggiunta lì.
- Validazione codice fiscale: modulo esistente `supabase/functions/_shared/codice-fiscale.ts`, importato dal frontend come `@shared/codice-fiscale` (già usato in `CandidaturaCompleta.tsx`, `Candidatura.tsx`, `StudentePage.tsx`). Riuso `validateCodiceFiscale`, non lo riscrivo.
- Posti liberi: `supabase.rpc('camere_disponibilita', { p_dal, p_al, p_struttura_id })`, come già fa `useCandidaturaActions.tsx` (righe 517 e 541). La colonna `posti_occupati_numeri` della funzione dà i posti già presi; nessun calcolo di occupazione in JavaScript.

## Cosa faremo

### 1. Correzione della funzione `crea_persona_manuale` (migration)
Lo stato della candidatura non è più costante `accolta`: la funzione lo deriva — `accolta` se `p_assegnazione` non è nullo, `in_attesa_posto` se è nullo. Mai preso dal payload.
Motivo verificabile: `v_studenti_stadio` classifica come `archiviato` qualsiasi candidatura il cui stato non sia fra `da_valutare`, `in_attesa_studente`, `da_decidere`, `in_attesa_posto` e che non abbia un'assegnazione attiva — una persona inserita senza posto letto sparirebbe da entrambe le liste.
Conseguenze:
- La riga in `log_stato_candidature` deve riportare lo stato effettivamente scritto (`stato_nuovo` uguale allo stato derivato, `stato_precedente` nullo, nota invariata).
- Il posto "Fuori perimetro: nessuna modifica al database" non vale più: questa correzione richiede una migration che aggiorna solo il corpo della funzione. Permessi, `SECURITY INVOKER`, `SET search_path`, controlli ed errori tradotti restano invariati.

### 2. Esiti da comunicare: esclusione degli inserimenti manuali
Poiché il conteggio in Dashboard non esiste, applichiamo l'esclusione dove la condizione vive davvero, così una persona inserita a mano non risulta mai "esito da comunicare":
- `studentiQuery.ts`: aggiungere `origine` alle colonne lette e al tipo `StadioRow`.
- `CandidaturaBadges.tsx`: il badge "Esito da comunicare" non compare quando `origine === 'inserimento_manuale'`.
- `candidaturaActions.ts`: l'azione "Invia esito" non viene proposta per le candidature manuali (resta disponibile tutto il resto).

Se invece si vuole *anche* una nuova voce "Esiti da comunicare" nella Dashboard, la aggiungiamo già filtrata con `.neq('origine','inserimento_manuale')` — ditelo e la includo.

### 2. Pulsante "Aggiungi persona"
Nella toolbar di `/admin/residenti`, accanto al pulsante di esportazione. Nessun pulsante in `/admin/candidature`.

### 3. Dialogo — sezione anagrafica
Nuovo componente a livello di modulo (mai definito dentro un altro componente) `src/components/admin/AggiungiPersonaDialog.tsx`.
Campi, gli stessi che `submit-candidatura` scrive su `studenti`: nome, cognome, email, telefono, data di nascita, nazionalità, codice fiscale con la casella "codice fiscale non disponibile", indirizzo (via, civico, CAP, comune, provincia, nazione con default `IT`).
Obbligatori solo nome, cognome, email. Codice fiscale validato, se compilato, con `validateCodiceFiscale` da `@shared/codice-fiscale`; salvato in forma normalizzata.

### 4. Dialogo — sezione posto letto (facoltativa)
Interruttore che apre: sede, data inizio (obbligatoria quando la sezione è attiva), data fine (facoltativa), camera e posto. L'elenco viene solo da `camere_disponibilita`; se la data fine è vuota si interroga con un orizzonte esplicito a partire dalla data inizio, e i posti già occupati arrivano da `posti_occupati_numeri`.

### 5. Controllo email
Al `blur` del campo email, ricerca esatta su `studenti`. Se esiste, blocco della conferma e collegamento "Apri la scheda" verso `/admin/studenti/:id`.

### 6. Avviso fisso sotto il campo email
"Questa persona non potrà più candidarsi dal form pubblico con questa email: le candidature con un'email già registrata vengono rifiutate." Non bloccante.

### 7. Conferma
Chiamata `supabase.rpc('crea_persona_manuale', { p_studente, p_candidatura, p_assegnazione })`, poi navigazione a `/admin/studenti/{studente_id}`. Gli errori della funzione vengono mostrati testualmente, senza riformularli.

## Fuori perimetro (dichiarato)
Nessuna modifica al database: colonna, funzione, permessi ed errori restano come sono. Nessuna email inviata all'inserimento.
