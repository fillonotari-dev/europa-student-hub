# D2 — Emissione della fattura di una mensilità

Obiettivo: creare su Fatture in Cloud il documento di una mensilità e registrarlo nel gestionale, con anteprima obbligatoria prima della conferma. Il gestionale crea il documento; la trasmissione allo SDI resta un'azione manuale su Fatture in Cloud. Nessuna email.

## 1. Modulo puro `supabase/functions/_shared/fic-fattura.ts`

Costante in testa:

```ts
// 'proforma' durante il collaudo: documento non fiscale, non consuma il numero
// del sezionale e si può cancellare. Va portato a 'invoice' quando il ciclo è
// stato verificato end-to-end.
export const TIPO_DOCUMENTO = 'proforma'
```

Funzione pura `costruisciPayloadFattura(...)` che restituisce esattamente:

```json
{ "data": {
  "type": "<TIPO_DOCUMENTO>",
  "entity": { "id": 0 },
  "date": "<oggi>",
  "numeration": "<fic_numerazione>",
  "payment_method": { "id": 0 },
  "items_list": [{ "name": "Canone di ospitalità — <mese> <anno>",
                   "net_price": 0, "qty": 1, "vat": { "id": 0 } }],
  "payments_list": [{ "due_date": "<oggi + fic_giorni_scadenza>",
                      "amount": 0, "status": "not_paid" }]
} }
```

`number` omesso (progressivo assegnato da Fatture in Cloud). Mese in italiano derivato da `canoni.competenza`. Nessun import esterno, così il modulo è importabile sia da Deno sia dai test Vitest (stesso schema di `_shared/fic-anagrafica.ts`, già incluso in `tsconfig.app.json`; il nuovo file va aggiunto allo stesso elenco `include`).

Prima di scrivere il payload definitivo: verifica sulla documentazione ufficiale Fatture in Cloud se il documento debba nascere con il flag di fattura elettronica attivo (`e_invoice`) perché Daniela possa trasmetterlo allo SDI dalla propria interfaccia. Riporto la fonte e imposto il campo solo se la documentazione lo richiede; se non lo richiede lo dichiaro e non lo imposto.

## 2. Test `src/test/fic-fattura.test.ts`

Coprono: descrizione con mese in lettere, `due_date` = data emissione + `fic_giorni_scadenza`, `net_price` = `canoni.imponibile`, `amount` = `canoni.totale`, assenza di `number`, presenza di `vat.id` e assenza di `vat.value`, `payment_method` al primo livello del documento, `type` preso dalla costante.

## 3. Edge function `supabase/functions/fic-emetti-fattura/index.ts`

Modellata su `fic-registri/index.ts`: `verify_jwt = true` nel blocco corrispondente di `supabase/config.toml`, controllo `has_role(auth.uid(), 'admin')` in apertura, uso di `_shared/fic-client.ts` (`ficFetch`, `estraiDiagnosticaFic`, `isQuotaError`, `FIC_BASE`).

Ingresso `{ canone_ids: uuid[], conferma: boolean }`, validato con Zod. I canoni si elaborano uno alla volta in sequenza, ciascuno con esito proprio; un fallimento non ferma gli altri e la risposta è l'elenco degli esiti.

Ogni chiamata esterna scrive in `fic_log` con `operazione = 'emetti_fattura'`, diagnostica 400/422 tramite `estraiDiagnosticaFic` e solo i **nomi** dei campi valorizzati, mai i valori. Il token non compare mai.

Senza `conferma`: nessuna chiamata esterna e nessuna scrittura. Esegue le guardie, costruisce il payload e lo restituisce — è il primo tempo dell'anteprima, non una modalità esposta all'operatore.

### Guardie (tutte prima di qualunque chiamata esterna; l'esito dichiara quale è mancata)

a. canone esistente e in stato `da_fatturare`;
b. contratto collegato in stato `attivo`;
c. `anagrafiche_fatturazione.fic_entity_id` valorizzato;
d. `campiMancantiPerFattura` vuota, altrimenti l'elenco dei campi mancanti;
e. `impostazioni.fic_metodo_pagamento_id` e `fic_vat_id` non nulli;
f. `canoni.aliquota_iva` uguale a `impostazioni.fic_vat_valore`.

### Risincronizzazione dell'intestazione (solo con conferma)

Prima di creare il documento, PUT idempotente su `/c/{company_id}/entities/clients/{fic_entity_id}` con `mappaAnagraficaPerFic`, stessa mappatura di `fic-sync-anagrafica`. `fic-sync-anagrafica` non viene toccata (unificazione rinviata di proposito, come dichiarato nel commento in testa a `_shared/fic-client.ts`). Se la risincronizzazione fallisce non si crea niente e l'esito lo dichiara; un PUT 404 azzera `fic_entity_id` e ferma l'emissione con il messaggio già previsto.

### Scrittura in due fasi

1. INSERT in `fatture` con `contratto_id`, importi coerenti col CHECK `totale = imponibile + iva`, `stato = 'in_invio'`;
2. chiamata a Fatture in Cloud;
3. su risposta positiva UPDATE `fatture` con `fic_document_id`, `numero`, `numerazione`, `data`, `ei_status`, `url_documento`, `stato = 'emessa'`;
4. solo dopo, **un'unica** UPDATE su `canoni` che scrive `fattura_id` e `stato = 'fatturato'` insieme: scritti separatamente, il secondo aggiornamento troverebbe `OLD.stato = 'fatturato'` e verrebbe rifiutato dal trigger `canoni_protect_fatturati`.

Su rifiuto definitivo (4xx di validazione: il documento sicuramente non esiste) la riga passa a `errore` con `messaggio_errore`. Su timeout o errore di rete resta `in_invio`, perché il documento potrebbe esistere. In entrambi i casi il canone resta `da_fatturare`.

## 4. Migration additiva: congelare `stato` dopo `emessa`

`CREATE OR REPLACE FUNCTION public.fatture_protect_emesse()` con `SET search_path TO 'public'`, corpo identico all'attuale più il rifiuto di qualunque cambio di `stato` quando `OLD.stato = 'emessa'`: da `emessa` non esiste transizione legittima (debito lasciato aperto in D1). Nessun DROP, nessun ALTER restrittivo su tabelle, nessuna modifica ai dati. Il trigger esistente `fatture_protect_emesse` (BEFORE UPDATE OR DELETE) resta invariato.

## 5. Interfaccia: `src/pages/admin/ContrattoPage.tsx`

Ogni riga dello scadenzario in stato `da_fatturare` acquista l'azione **Emetti fattura**, che apre un dialogo — componente nuovo `src/components/admin/contratti/EmettiFatturaDialog.tsx`, definito a livello di modulo, mai dentro il corpo di un altro componente.

Il dialogo mostra prima: intestatario, descrizione, imponibile, IVA, totale, data di emissione, scadenza calcolata, e gli identificativi col nome leggibile («metodo 2537205 — Bonifico bancario», «aliquota 3 — 10%»). I dati vengono dal primo tempo (chiamata senza conferma).

Il pulsante di conferma dice **Conferma ed emetti**. Sopra di sé un avviso che si adegua da solo al valore di `TIPO_DOCUMENTO`: con `proforma` dichiara che verrà creato un documento proforma di prova, non fiscale, cancellabile; con `invoice` che la fattura esisterà su Fatture in Cloud col suo numero e non sarà più cancellabile né modificabile nell'importo. In entrambi i casi ricorda che la trasmissione allo SDI non viene fatta dal gestionale.

Le mensilità già fatturate mostrano numero e data della fattura al posto dell'azione (join su `canoni.fattura_id`).

Nessun colore scritto a mano: solo token semantici (regola 9 del §12 di `docs/Context.md`).

## 6. Documentazione

`docs/Context.md`: sottosezione sull'emissione — funzione, guardie, due fasi, significato di `in_invio` vs `errore`, costante `TIPO_DOCUMENTO` e cosa cambiare per passare a `invoice`, esito della verifica sul flag di fattura elettronica.

## Fuori perimetro (dichiarato)

- Nessuna trasmissione allo SDI dal gestionale.
- Nessuna email.
- Nessuna modifica a `fic-sync-anagrafica`.
- Nessun lotto mensile automatico: l'interfaccia manda un canone per volta, ma la firma accetta più canoni fin da subito.

## Verifica finale

Suite Vitest completa, typecheck, build; deploy della nuova funzione; resoconto punto per punto con file e riga per il codice e statement SQL per il database.
