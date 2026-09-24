# Collegare fatture già esistenti su Fatture in Cloud e bloccare i doppioni

## Cosa cambia per l'operatore

- Ogni riga del mese in /admin/fatturazione ha l'azione "Collega fattura già emessa": apre un elenco delle fatture di quel cliente su Fatture in Cloud non ancora registrate nel gestionale; se ne sceglie una e si conferma. Nulla viene creato su Fatture in Cloud, e il dialogo lo dice.
- Se l'importo della fattura scelta è diverso dal totale della mensilità, il collegamento viene rifiutato e si vedono entrambi i valori.
- Una mensilità il cui contratto ha una fattura "in invio" o "emessa senza mensilità collegata" risulta bloccata, con il rinvio al pannello di riconciliazione.

Caso di produzione: le 6 mensilità di agosto si sistemano collegando le fatture convertite a mano. Nessun UPDATE scritto a mano sui dati.

## Stato verificato

- `fatture`: CHECK `fatture_importi_coerenti (totale = imponibile + iva)`, stati `in_invio|emessa|errore`, indice unico parziale `fatture_fic_document_id_uniq` (migration `20260905170350_…`).
- `attiva_contratto`: REVOKE da PUBLIC (`20260818225705_…:71`) e da anon (`20260818234428_…`): stesso schema per la nuova funzione.
- `fic-emetti-fattura/index.ts`: guardie (a)–(f); nessun controllo su righe `fatture` `in_invio` o non collegate. `docs/Context.md` §riconciliazione (righe 368-372) va corretto dove presenta la guardia come esistente.

## 1. Migration additiva: `registra_fattura_esistente`

`registra_fattura_esistente(p_canone_id uuid, p_fic_document_id bigint, p_numero int, p_numerazione text, p_data date, p_ei_status text, p_imponibile numeric, p_iva numeric, p_totale numeric) returns uuid`

- SECURITY INVOKER, `SET search_path = public`, REVOKE da PUBLIC e anon (resta `authenticated`, protetto dalle RLS admin come `attiva_contratto`).
- Nel corpo: `SELECT … FOR UPDATE` sul canone, rifiuta se non `da_fatturare`; INSERT in `fatture` con `stato='emessa'` e i dati del documento; unica UPDATE su `canoni` con `fattura_id` e `stato='fatturato'` insieme. Una sola transazione: se una scrittura fallisce non resta nulla.
- Violazione di `fatture_fic_document_id_uniq` (unique_violation) rilanciata con messaggio in italiano: "Questo documento di Fatture in Cloud è già registrato nel gestionale."
- Nessun DROP, nessun vincolo toccato, nessun dato modificato.

Un'aggiunta al punto 1: dentro registra_fattura_esistente, dopo il SELECT … FOR UPDATE, rifiuta se p_totale è diverso da canoni.totale della riga bloccata, con un messaggio in italiano che riporti entrambi i valori. Il controllo in fic-collega-fattura resta (serve a mostrare la differenza prima di chiamare la RPC), ma la garanzia deve stare nel database: la funzione è eseguibile da authenticated e oggi accetterebbe qualunque importo. Confronta anche gli id numericamente (Number()) sia per [entity.id](http://entity.id) sia per fic_document_id, perché arrivano da due fonti diverse.

## 2. Edge function `fic-collega-fattura`

- `verify_jwt = true` in `config.toml` (solo aggiunta della voce), controllo `has_role(admin)` in apertura, stesso impianto di `fic-emetti-fattura`, usa `_shared/fic-client.ts`.
- Commento di testa: esegue **solo GET** su Fatture in Cloud; non crea, non modifica, non cancella nulla.
- Ogni chiamata esterna scrive in `fic_log` con `operazione='collega_fattura'`; token mai nel log, nessun dato personale (solo id, stato HTTP, quote, diagnostica 400/422).
- Input Zod: `{ modo: 'elenca', canone_id }` oppure `{ modo: 'collega', canone_id, fic_document_id }`.

**elenca**: canone → contratto → anagrafica; se `fic_entity_id` nullo, errore guidato. `GET /c/{company_id}/issued_documents?type=invoice&q=entity.id = {id}&fieldset=detailed` (paginazione seguita). Esclude gli id già presenti in `fatture.fic_document_id`. Restituisce per ciascuno: id, number, numeration, date, importo lordo.

**collega**: `GET /c/{company_id}/issued_documents/{id}` e verifica, prima di ogni scrittura: `type === 'invoice'`; `entity.id === fic_entity_id`; canone `da_fatturare`; lordo del documento uguale a `canoni.totale` (confronto in centesimi). Se l'importo differisce: niente scrittura, risposta con entrambi i valori. Se tutto torna: chiamata RPC `registra_fattura_esistente` con il client dell'admin chiamante (RLS applicate).

Sintassi del filtro `q` e nomi dei campi importo (`amount_net`, `amount_vat`, `amount_gross` come da documentazione) vanno verificati sull'API Reference prima di scrivere il codice: nel resoconto riporterò la sintassi esatta e i nomi confermati, e segnalerò se differiscono.

## 3. Guardia doppioni in `fic-emetti-fattura`

- Nuova guardia `doppione`, dopo (b) contratto attivo e prima di qualunque chiamata esterna, valida anche con `conferma: false`: se per lo stesso contratto esiste una riga `fatture` in `in_invio`, oppure `emessa` senza alcun canone con `fattura_id` che la punti, la mensilità è bloccata con il messaggio "Esiste una fattura da riconciliare per questo contratto: verificala nel pannello Da riconciliare prima di emettere."
- La pagina la mostra già come motivo di blocco (usa gli esiti dell'anteprima). Ridistribuzione della funzione.

## 4. Interfaccia `/admin/fatturazione`

- Nuovo componente `CollegaFatturaDialog.tsx` (a livello di modulo, non annidato): carica il modo "elenca", lista selezionabile (numero/sezionale, data, lordo), pulsante di conferma; avviso fisso "Nessun documento viene creato o modificato su Fatture in Cloud"; mostra in chiaro la differenza d'importo se rifiutato.
- Nuova colonna azioni in ogni riga del mese, anche nelle righe bloccate (il collegamento è proprio il rimedio). A esito positivo ricarica elenco, riconciliazione e archivio.
- Solo token semantici.

## 5. Documentazione e roadmap

- `docs/Context.md`: nuova voce `fic-collega-fattura` e `registra_fattura_esistente`; correzione della sezione riconciliazione (la guardia doppioni ora esiste, con ancoraggio al file); il debito (c) "riconciliazione sola lettura" resta vero per il pannello ma cita il nuovo percorso di collegamento.
- `roadmap.md` aggiornata.

## Verifica

- Test puri: confronto importi in centesimi e criterio della guardia doppioni estratti in `_shared/` con test in `src/test/`.
- Typecheck, suite, build; chiamata alla funzione con sola anon key → 403; modo "elenca" su una delle mensilità di agosto (sola lettura).
- Confronto finale col piano e scostamenti dichiarati.

## Fuori perimetro

Nessuna modifica a `attiva_contratto`, `canoni_protect_fatturati`, `fatture_protect_emesse`, alla modalità proforma/invoice, né collegamenti automatici delle 6 mensilità: li fa l'operatore dal dialogo.