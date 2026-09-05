# Revisione interfaccia: tre gruppi, conteggi disgiunti, icona solo su da_fatturare

La funzione database `aggiorna_canone_contratto` resta com'è. Intervento solo su `src/lib/canoniRicalcolo.ts`, `src/test/canoni-ricalcolo.test.ts` e `src/pages/admin/ContrattoPage.tsx`. Nessuna migration.

## 1. Tre partizioni invece di due

`partizionaMensilitaPerCambioCanone` restituisce tre gruppi disgiunti:

- **aggiornate** — `da_fatturare`, competenza dal mese corrente in poi, imponibile uguale al canone;
- **protette** — stessi filtri di stato e competenza, imponibile diverso: le righe che il cambio di canone risparmia proprio per via dell'importo personalizzato;
- **fuoriPerimetro** — tutto il resto (mesi passati, `fatturato`, `incassato`, `annullato`).

Il chiamante non deve più riscrivere il criterio per distinguere i motivi.

## 2. Dialogo di conferma con insiemi disgiunti

Il dialogo "Ricalcolare le mensilità?" conta:

- `aggiornate.length` nella frase principale;
- `protette.length` nella riga sulle mensilità con importo personalizzato (non più il filtro sul solo importo diverso, che si sovrapponeva alle fatturate);
- `intoccabili.length` (fatturate/incassate) nella riga già esistente.

Protette e intoccabili sono disgiunti per costruzione.

Quando `aggiornate.length` è zero, il dialogo lo dichiara con una frase dedicata («Nessuna mensilità verrà ricalcolata: …») invece di infilare uno zero nella frase costruita per un numero positivo — punto richiesto e rimasto fuori dal giro precedente, qui recuperato e dichiarato.

## 3. Icona solo sulle righe da_fatturare

L'icona `Info` accanto all'importo compare solo se la riga è `da_fatturare` e l'imponibile è diverso dal canone. Su una mensilità fatturata l'importo è storia, e dopo un cambio di canone ogni mese fatturato al prezzo precedente apparirebbe "diverso" senza aggiungere informazione. Il testo del tooltip resta invariato. In `ContrattoPage.tsx` il filtro `personalizzate` sparisce: il dialogo legge le partizioni della funzione pura.

## 4. Test

Aggiunti a `src/test/canoni-ricalcolo.test.ts`:

- riga `fatturato` con importo diverso dal canone → `fuoriPerimetro`, non `protette`;
- riga `da_fatturare` di un mese passato con importo diverso → `fuoriPerimetro`;
- contratto con righe protette e righe fatturate → conteggi che non si sovrappongono (intersezione vuota verificata per costruzione sulle tre partizioni);
- i casi esistenti vengono adeguati alla nuova forma a tre gruppi.

Esito della suite riportato nel resoconto.

## Fuori perimetro

Nessuna modifica alla funzione database, ad altre pagine o ai dati. Il testo del tooltip resta quello già approvato.
