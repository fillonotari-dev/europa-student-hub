# Chiusura del ciclo di fatturazione: quattro pendenze

Fuori perimetro, confermato: `TIPO_DOCUMENTO` resta `'proforma'`. Nessuna email, nessuna trasmissione SDI, nessun componente tabella condiviso.

## 1. La scadenza sul documento è quella del contratto

Oggi il payload calcola `due_date` come data di emissione + `fic_giorni_scadenza` (`_shared/fic-fattura.ts`, `payments_list[0].due_date = aggiungiGiorni(d.dataEmissione, d.giorniScadenza)`), ignorando `canoni.scadenza`. Risultato: scadenzario interno e fattura dichiarano due date diverse per la stessa mensilità.

Nuova regola, in una funzione esportata del modulo:
- se `scadenza` esiste ed è uguale o successiva alla data di emissione, si usa `scadenza`;
- se manca, si usa data di emissione + `giorniScadenza`;
- se è anteriore alla data di emissione (arretrato fatturato in ritardo), si usa la data di emissione, per non emettere un documento già scaduto.

`DatiFattura` guadagna `scadenza?: string`. Il chiamante `fic-emetti-fattura/index.ts` aggiunge `scadenza` alla select su `canoni` (oggi non la legge), la passa al payload e usa la stessa data nel campo `scadenza` dell'anteprima, così anteprima e documento non possono divergere.

Test in `src/test/fic-fattura.test.ts`: scadenza futura, scadenza mancante, scadenza già passata.

## 2. Segnalazione dei mesi parzialmente coperti

Nuova funzione pura in `src/lib/coperturaMese.ts`: dati competenza, `data_inizio` e `data_fine` del contratto, restituisce giorni coperti e giorni del mese, e se la copertura è parziale. Test propri in `src/test/copertura-mese.test.ts` (primo mese parziale, ultimo mese parziale, mese intero, mese unico coperto solo in parte, mesi di 28/30/31 giorni).

In `/admin/fatturazione` la query dei canoni legge anche `contratti.data_inizio` e `contratti.data_fine`; ogni riga parziale mostra un'annotazione accanto al mese, per esempio "17 giorni su 30". Nessun blocco: la riga resta selezionabile, la segnalazione è un avviso. Motivo: il rateo non viene calcolato, quindi il primo e l'ultimo mese vanno corretti a mano prima dell'emissione — dopo, `canoni_protect_fatturati` blocca l'importo.

## 3. Una sola implementazione della formula IVA

`totaleRiga` in `src/lib/scadenzario.ts` calcola il totale in virgola mobile, duplicando ciò che `src/lib/iva.ts` fa su centesimi interi. Diventa una delega a `lordoDaImponibile(imponibile, aliquota_iva)`. Alimenta l'anteprima mostrata prima di "Attiva contratto" (`ContrattoPage.tsx`). I test di `scadenzario` vengono eseguiti e verrà dichiarato esplicitamente se qualche risultato cambia (atteso: nessun cambiamento, salvo eventuali casi di arrotondamento al centesimo, che verranno riportati).

## 4. Documentazione di chiusura

`docs/Context.md` e `roadmap.md`: ciclo di fatturazione completo e collaudato in modalità proforma (proforma 550829694 creata, nessuna scrittura locale); cosa cambia esattamente portando `TIPO_DOCUMENTO` a `'invoice'` — tipo del documento, flag `e_invoice`, riga in `fatture`, collegamento `canoni.fattura_id` e passaggio a `fatturato`; debiti dichiarati che restano aperti — nessun componente tabella condiviso, `fic-sync-anagrafica` non usa ancora `_shared/fic-client.ts`, nessuna azione di risoluzione nel pannello di riconciliazione, nessuna email di trasmissione della fattura allo studente.

## Verifica

Typecheck, suite completa dei test e build. Nessuna migration, nessuna modifica al database, solo interventi additivi.
