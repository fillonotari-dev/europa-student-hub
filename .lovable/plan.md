# Collegamento a Fatture in Cloud — sola lettura

Obiettivo: collegare il gestionale a Fatture in Cloud e permettere all'amministratore di verificare il collegamento da Impostazioni. In questo giro nessun documento fiscale viene creato, modificato o inviato: si legge soltanto.

## 1. Credenziali

Due valori riservati salvati nel deposito sicuro del backend: `FIC_ACCESS_TOKEN` e `FIC_COMPANY_ID`. Vengono letti solo dalla funzione lato server. Non vengono scritti in nessuna tabella, in nessun file dell'interfaccia e in nessun messaggio di log. Verranno richiesti con il modulo sicuro al momento dell'implementazione.

## 2. Registro delle chiamate: tabella `fic_log`

Nuova tabella con: `id`, `created_at`, `operazione`, `metodo`, `endpoint`, `http_status`, `esito` (`ok` / `errore`), `messaggio`, `payload_ridotto` (jsonb).

- Protezione attiva, unica regola di accesso `FOR ALL TO authenticated` su `has_role(auth.uid(), 'admin')`, permessi ad `authenticated` e `service_role`: identica impostazione delle quattro tabelle della migration `20260818221948`.
- `payload_ridotto` contiene solo campi selezionati esplicitamente (nome azienda, partita IVA, quote residue, codice errore). Il token non compare in nessun campo, e le risposte che contengono credenziali vengono filtrate campo per campo prima della scrittura, mai copiate intere.
- Migration puramente additiva: nessun DROP, nessun ALTER restrittivo, nessuna modifica ai dati esistenti.

## 3. Funzione server `fic-test-connection`

- `verify_jwt` attivo in `supabase/config.toml`; in apertura verifica il ruolo `admin` con `has_role` e risponde `403` altrimenti.
- Non viene inserita nell'elenco delle funzioni pubbliche del §7 di `docs/Context.md`; verrà documentata come funzione riservata all'amministratore.
- Endpoint interrogati (verificati sulla specifica ufficiale OpenAPI di Fatture in Cloud, non dedotti):
  - `GET https://api-v2.fattureincloud.it/c/{company_id}/company/info` — conferma che token e azienda sono validi e restituisce il nome dell'azienda.
  - `GET https://api-v2.fattureincloud.it/user/companies` — unica fonte documentata della partita IVA (`vat_number`) associata all'id azienda. La sua risposta contiene anche token di accesso per azienda: vengono scartati subito, non registrati e non restituiti all'interfaccia.
- Da entrambe le risposte vengono letti gli header `RateLimit-HourlyRemaining` e `RateLimit-MonthlyRemaining`.
- Ogni chiamata, riuscita o fallita, scrive una riga in `fic_log`.
- Su risposta `429`, o `403` per superamento quota, la funzione rispetta l'header `Retry-After` e riprova al massimo due volte con attesa crescente; al terzo fallimento restituisce l'errore all'interfaccia e si ferma.
- Messaggi di errore in italiano, senza dettagli tecnici inutili e senza mai riportare il token.

## 4. Interfaccia: sezione "Fatture in Cloud"

In `/admin/impostazioni`, nuova sezione sotto Listini con un solo pulsante **Verifica connessione**. Al termine mostra:

- in caso positivo: azienda collegata, partita IVA, chiamate residue nell'ora e nel mese;
- in caso negativo: il messaggio di errore restituito.

Nessun altro comando in questa sezione.

## Fuori perimetro

Nessuna sincronizzazione delle anagrafiche, nessuna creazione di documenti, nessun webhook.

## Dettagli tecnici

- Migration additiva `fic_log` con `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated`, `GRANT ALL ... TO service_role`, `ENABLE ROW LEVEL SECURITY` e la singola policy admin, nell'ordine previsto.
- Nuova funzione `supabase/functions/fic-test-connection/index.ts`, CORS incluso; blocco `[functions.fic-test-connection] verify_jwt = true` in `supabase/config.toml`.
- Scrittura su `fic_log` con client `service_role` interno alla funzione; l'interfaccia legge il registro solo tramite le regole admin.
- Nuovo componente `src/components/admin/impostazioni/FattureInCloudSection.tsx`, montato in `src/pages/admin/Impostazioni.tsx` dopo `ListiniSection`, che invoca la funzione con `supabase.functions.invoke`.
- `docs/Context.md`: nuovo paragrafo sull'integrazione e sul registro chiamate, senza aggiungere la funzione all'elenco pubblico del §7.
