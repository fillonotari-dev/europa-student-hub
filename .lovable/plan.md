# D2 — Emissione della fattura di una mensilità su Fatture in Cloud

Obiettivo: emettere il documento di una mensilità, registrarlo in `public.fatture`
e collegarlo al canone, con scrittura in due fasi e una modalità di prova che non
tocca nulla. Nessuna migration: lo schema è quello creato in D1.

## 1. Edge function `fic-emetti-fattura`

- `verify_jwt = true` in `supabase/config.toml` (blocco nuovo, come
  `fic-sync-anagrafica`) più controllo `has_role(auth.uid(), 'admin')` in codice,
  copiato dal preambolo di `fic-sync-anagrafica/index.ts`.
- Ingresso: `{ canone_ids: uuid[], dry_run: boolean }`. La firma accetta più
  canoni fin da subito; l'interfaccia ne manda uno per volta. I canoni vengono
  elaborati **uno alla volta, in sequenza**, ciascuno con esito proprio: la
  risposta è un elenco di esiti, non un successo/insuccesso unico. Un fallimento
  non interrompe gli altri.
- Ogni chiamata esterna scrive in `fic_log` con `operazione = 'emetti_fattura'`,
  con la stessa diagnostica 400/422 già in uso (`estraiDiagnosticaFic`,
  `campi_inviati` con i soli nomi dei campi valorizzati). Il token non compare mai.
- Retry solo sugli errori di quota (429 / 403 quota), come nelle funzioni esistenti.

## 2. Guardie, prima di qualunque chiamata esterna

Per ogni canone, in quest'ordine:

1. il canone esiste ed è in stato `da_fatturare`;
2. il contratto collegato è in stato `attivo`;
3. l'anagrafica di fatturazione ha `fic_entity_id` valorizzato;
4. `campiMancantiPerFattura(anagrafica)` restituisce lista vuota.

Se una condizione manca: nessuna chiamata a Fatture in Cloud, nessuna riga in
`fatture`, e la risposta dice **quale** condizione è mancata (per la 4, l'elenco
dei campi). L'esito viene comunque registrato in `fic_log` come già fa la guardia
di `fic-sync-anagrafica`.

## 3. Risincronizzazione dell'anagrafica

Prima di creare il documento, la funzione esegue lo **stesso PUT idempotente** di
`fic-sync-anagrafica` su `/c/{company_id}/entities/clients/{fic_entity_id}`, con
il payload di `mappaAnagraficaPerFic`. Il gestionale è la fonte di verità: è
l'unico modo per garantire che la fattura esca con l'intestazione aggiornata.

Per non duplicare quel codice, la parte comune (costruzione payload, `fetch` con
retry di quota, lettura del corpo, gestione del PUT 404 che azzera
`fic_entity_id`) viene estratta in `supabase/functions/_shared/fic-client.ts`, un
modulo con: `ficFetch(...)` (chiamata con retry e lettura quote),
`estraiDiagnosticaFic`, `isQuotaError`, e `syncAnagraficaSuFic(admin, ana)` che
restituisce `{ ok, fic_entity_id, scollegata, messaggio }`.
`fic-sync-anagrafica/index.ts` viene riscritto per usarlo, a comportamento
invariato — nessun cambio di messaggi, di risposte o di righe scritte in `fic_log`.

Se la risincronizzazione fallisce, **non si emette**: l'esito lo dichiara.
Un PUT 404 azzera `fic_entity_id` e l'emissione si ferma con il messaggio già
previsto ("il cliente non esiste più: ripeti la sincronizzazione").

## 4. Payload del documento

`POST /c/{company_id}/issued_documents`, con i valori letti da
`public.impostazioni` (riga id = 1):

```json
{
  "data": {
    "type": "invoice",
    "entity": { "id": <fic_entity_id> },
    "date": "<oggi>",
    "numeration": "<fic_numerazione>",
    "items_list": [{
      "name": "Canone di ospitalità — <mese in lettere> <anno>",
      "net_price": <canoni.imponibile>,
      "qty": 1,
      "vat": { "value": <canoni.aliquota_iva> }
    }],
    "payments_list": [{
      "due_date": "<oggi + fic_giorni_scadenza>",
      "amount": <canoni.totale>,
      "status": "not_paid"
    }]
  }
}
```

`number` è omesso: il progressivo del sezionale lo assegna Fatture in Cloud.
Il metodo di pagamento (`fic_metodo_pagamento`) viene passato come
`payment_method.name` nel payload; se Fatture in Cloud lo rifiuta perché il
metodo non esiste nell'anagrafica dei metodi dell'azienda, il rifiuto arriva
come 422 con la diagnostica già registrata, e lo si dichiara — non si inventa un
identificativo. Il mese in lettere è in italiano, derivato da `canoni.competenza`.

## 5. Modalità prova (`dry_run`)

Con `dry_run = true`: nessuna scrittura nel database, nessuna riga in `fatture`,
nessuna chiamata a Fatture in Cloud — **neppure la risincronizzazione**, che è
una scrittura remota. Le guardie del punto 2 vengono eseguite tutte, il payload
viene costruito e restituito così com'è perché l'operatore lo legga. Viene
scritta una riga in `fic_log` che registra la prova.

## 6. Scrittura in due fasi

1. `INSERT` in `fatture` con `contratto_id`, `imponibile`, `iva`, `totale`
   (coerenti con il CHECK `totale = imponibile + iva`) e `stato = 'in_invio'`.
2. Chiamata a Fatture in Cloud.
3. Su risposta positiva: `UPDATE fatture` con `fic_document_id`, `numero`,
   `numerazione`, `data`, `ei_status`, `url_documento` se presente, e
   `stato = 'emessa'`.
4. Solo dopo: `UPDATE canoni` con `fattura_id` e `stato = 'fatturato'`.
   L'ordine è obbligatorio — `canoni_protect_fatturati` rende `fattura_id`
   immutabile una volta che lo stato è `fatturato`, quindi i due campi vanno
   scritti nella **stessa** `UPDATE`.

Se la chiamata fallisce, la riga resta `in_invio` con `messaggio_errore`
valorizzato: caso visibile, mai un dato perso. Il canone resta `da_fatturare`.
Se il rifiuto è definitivo (4xx di validazione, documento sicuramente inesistente)
la riga viene portata a `errore`, secondo la distinzione fissata in D1; su
timeout o errore di rete resta `in_invio`.

## 7. Interfaccia — scheda contratto

In `src/pages/admin/ContrattoPage.tsx`, nello scadenzario, ogni riga in stato
`da_fatturare` acquista l'azione **Emetti fattura**, che apre un dialogo
(nuovo componente `src/components/admin/contratti/EmettiFatturaDialog.tsx`, a
livello di modulo) con:

- intestatario, descrizione, imponibile, IVA, totale, data di emissione e data di
  scadenza calcolata;
- interruttore **modalità prova**, attivo per impostazione predefinita;
- avviso: dopo l'emissione l'importo non sarà più modificabile;
- in modalità prova, il payload restituito mostrato in un riquadro leggibile;
- in emissione reale, esito con numero e sezionale, e invalidamento delle query
  `canoni` e contratto.

Le mensilità già fatturate mostrano numero e data della fattura al posto
dell'azione.

## Fuori perimetro

Nessuna migration, nessuna modifica allo schema, nessuna nota di credito, nessun
lotto mensile automatico (la firma multipla c'è, la proposta di lotto è un giro
successivo), nessuna email.

## Verifica

- Typecheck, build e suite esistente (66 test) invariati.
- Test unitari nuovi sulla costruzione del payload, estratta come funzione pura
  in `supabase/functions/_shared/fic-fattura.ts` e coperta da
  `src/test/fic-fattura.test.ts`: descrizione del mese, `due_date` calcolata,
  coerenza fra `net_price`, IVA e `amount`, `number` assente.
- Primo collaudo reale in modalità prova su una mensilità, leggendo il payload.
