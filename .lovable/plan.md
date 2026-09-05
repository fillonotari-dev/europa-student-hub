# Piano: sincronizzazione anagrafica → cliente Fatture in Cloud

Nessun documento fiscale viene creato. Solo allineamento dell'anagrafica e scrittura di `fic_entity_id`.

## 1. Modulo condiviso `supabase/functions/_shared/fic-anagrafica.ts`

Unico posto dove vivono le regole di mappatura. Vive in `_shared` perché è la sola cartella già importabile da entrambi i lati: l'alias `@shared` esiste in `vite.config.ts:19` e `tsconfig.app.json:23-24`, con i file condivisi elencati in `tsconfig.app.json:37-39` (aggiungerò lì il nuovo file). Il modulo non avrà import esterni, come `countries.ts`.

Contenuto:
- `EU_COUNTRY_CODES`: elenco dei 27 codici ISO alpha-2 dei paesi UE (stesso modulo, come richiesto).
- `codiceDestinatarioProposto(nazione)`: `0000000` se `IT`, `XXXXXXX` altrimenti — la regola oggi scritta a mano in `src/components/admin/contratti/ContrattoDialog.tsx:186` e `:309`, che verranno modificati per chiamare questa funzione (nessun cambio di comportamento).
- `mappaAnagraficaPerFic(anagrafica)`: restituisce il corpo `data` da inviare e un riepilogo delle trasformazioni applicate.
- `campiMancantiPerFic(anagrafica)`: elenco in italiano dei campi mancanti.

Regole estere (nazione ≠ `IT`), come da guida ufficiale citata nella richiesta:
- `tax_code` lasciato vuoto anche se il codice fiscale è presente in anagrafica;
- `address_postal_code` = `00000`, con il CAP reale accodato alla riga di indirizzo;
- `address_province` = `EE` se l'anagrafica non ne ha una;
- `vat_number` = identificativo estero; se il paese non è in `EU_COUNTRY_CODES`, `OO99999999999`.

## 2. Edge function `fic-sync-anagrafica`

Riceve `{ anagrafica_id }`. Stessa impalcatura di `supabase/functions/fic-test-connection/index.ts`: `verify_jwt = true` in `supabase/config.toml`, controllo `has_role(auth.uid(), 'admin')` in apertura con 403 altrimenti, retry massimo due volte su 429 / 403-da-quota rispettando `Retry-After`, e una riga in `fic_log` per ogni chiamata (operazione `sync_anagrafica`), senza mai il token.

Comportamento:
- legge la riga con il client `service_role`;
- se mancano campi obbligatori: **non chiama l'API**, registra l'esito in `fic_log` e restituisce l'elenco esatto;
- se `fic_entity_id` è nullo: `POST /c/{company_id}/entities/clients`, poi scrive l'`id` ricevuto in `fic_entity_id`;
- se è valorizzato: `PUT /c/{company_id}/entities/clients/{client_id}`. Mai una seconda creazione per la stessa anagrafica.
- se il `PUT` risponde 404 (cliente cancellato su Fatture in Cloud): `fic_entity_id` viene azzerato, l'evento registrato in `fic_log`, e la risposta lo dichiara esplicitamente all'operatore, che potrà rilanciare la sincronizzazione ottenendo una creazione. Nessuna ricreazione automatica nella stessa chiamata.

Mappatura dei campi (riportata anche nel resoconto finale):

| Fatture in Cloud | Anagrafica |
| --- | --- |
| `type` | `person` se `tipo = 'persona_fisica'`, `company` se `soggetto_giuridico` |
| `name` | `nome + cognome` oppure `denominazione` |
| `first_name` / `last_name` | `nome` / `cognome` (solo persona fisica) |
| `tax_code` | `codice_fiscale` (vuoto se estero) |
| `vat_number` | `partita_iva` (regola estera del punto 1) |
| `address_street` | `indirizzo_via` + `indirizzo_civico` (+ CAP reale se estero) |
| `address_postal_code` | `indirizzo_cap` (`00000` se estero) |
| `address_city` / `address_province` | `indirizzo_comune` / `indirizzo_provincia` (`EE` se estero e assente) |
| `country_iso` | `indirizzo_nazione` |
| `certified_email` | `pec` |
| `email` | `email_recapito` |
| `ei_code` | `codice_destinatario`, altrimenti il proposto del punto 1 |

## 3. Campi obbligatori: cosa dice davvero la fonte, e guardia distinta per nazione

Verificato lo schema ufficiale `models/schemas/Client.yaml` del repository OpenAPI di Fatture in Cloud (`fattureincloud/openapi-fattureincloud`), referenziato da `CreateClientRequest`: **non contiene alcuna lista `required` e ogni proprietà è `nullable`**. Non esiste quindi, nell'API Reference, un elenco di campi obbligatori da citare: la guardia è *nostra* e sarà dichiarata come tale nel codice e in `docs/Context.md`.

Guardia sdoppiata per nazione:
- `indirizzo_nazione = 'IT'`: nome o denominazione, via, comune, CAP, provincia, e almeno un identificativo fra codice fiscale e partita IVA.
- estero: solo nome o denominazione, via, comune, nazione. Nessun identificativo fiscale, nessun CAP, nessuna provincia — la mappatura invia comunque `00000` ed `EE`, e con il campo P.IVA vuoto Fatture in Cloud scrive da sé codice ISO del paese e la parola ESTERO. In produzione 6 studenti su 12 non hanno codice fiscale e hanno indirizzo estero: una lista unica li bloccherebbe tutti. È anche coerente con `ContrattoDialog`, dove quei campi non impediscono la creazione del contratto.

Nessuna seconda implementazione: `ContrattoDialog.tsx:318-324` calcola già `datiFiscaliMancanti` per l'avviso non bloccante. Quella logica viene spostata nel modulo condiviso come `campiMancantiPerFic(anagrafica)` — con la distinzione per nazione sopra — e usata sia dall'avviso del dialogo sia dalla guardia dell'edge function, così le due strade non possono divergere. Il dialogo continua ad avvisare senza bloccare; l'edge function blocca.


## 4. Interfaccia in `/admin/contratti/:id`

Nel riquadro "Intestazione fattura" di `src/pages/admin/ContrattoPage.tsx:465-473`:
- riga di stato: "Non ancora collegata a Fatture in Cloud" oppure "Collegata a Fatture in Cloud (ID <n>)";
- pulsante "Sincronizza con Fatture in Cloud" che invoca la funzione e mostra l'esito, o l'elenco puntato dei campi mancanti;
- per le anagrafiche estere, una riga di riepilogo delle trasformazioni applicate (codice fiscale omesso, CAP 00000 con CAP reale in indirizzo, provincia EE, identificativo estero o `OO99999999999`), calcolata con lo stesso modulo condiviso.

Colori solo via token semantici (`text-success`, `text-destructive`), come da §12.

## 5. Fuori perimetro

Nessuna migration (la colonna `fic_entity_id` esiste già), nessun documento fiscale, nessun webhook, nessuna sincronizzazione massiva o automatica.

## 6. Verifica finale

Rilettura del diff, `tsc --noEmit`, build, prova reale della funzione su un'anagrafica italiana e una estera con esito riportato, e aggiornamento di `docs/Context.md` (sezione Fatture in Cloud) con endpoint usati e regole di mappatura.
