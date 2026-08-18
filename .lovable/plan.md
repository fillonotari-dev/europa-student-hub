# Ciclo di vita del contratto dopo l'attivazione

Oggi un contratto attivato non ha vie d'uscita e non si accorge se il soggiorno collegato viene concluso in anticipo. Questo intervento aggiunge chiusura, annullamento (ritorno in bozza), sostituzione/rinnovo e la proposta di chiusura quando si conclude un soggiorno.

Verificato prima di scrivere il piano: la tabella `contratti` contiene **zero righe**, quindi la migration non incontrerà contratti già in stato di chiusura; la colonna `contratto_precedente_id` esiste già e non è mai usata; `attiva_contratto` rifiuta l'attivazione se esistono già mensilità.

## 1. Migration: motivo di chiusura

- `ALTER TABLE public.contratti ADD COLUMN motivo_chiusura text` (unico ALTER).
- CHECK `contratti_motivo_chiusura_chk`, sullo stesso modello di quello già presente su `assegnazioni`:
  - stato in `scaduto`/`risolto`/`rinnovato` -> motivo NOT NULL e in (`fine_naturale`, `partenza_anticipata`, `risoluzione`, `sostituzione`);
  - stato in `bozza`/`attivo` -> motivo NULL.
- Il CHECK viene aggiunto senza `NOT VALID`: se esistesse una riga già chiusa la migration fallirebbe in modo esplicito, senza forzare valori.

## 2. Funzione `chiudi_contratto(p_contratto_id, p_data_fine, p_motivo, p_stato) RETURNS integer`

`SECURITY INVOKER`, `SET search_path TO 'public'`, `REVOKE ALL FROM PUBLIC`, `GRANT EXECUTE TO authenticated` (come `attiva_contratto`). In una sola transazione:

- errore se il contratto non esiste o non è in stato `attivo`;
- errore se `p_stato` non è in (`scaduto`, `risolto`, `rinnovato`) o `p_motivo` non è fra i quattro ammessi;
- errore esplicito se `p_data_fine` è minore o uguale a `data_inizio`, con indicazione che per lo studente mai arrivato la strada è "Riporta in bozza" seguita dall'eliminazione;
- riscrive `data_fine` con `p_data_fine`, imposta `stato` e `motivo_chiusura`;
- porta ad `annullato` i canoni `da_fatturare` con competenza successiva al mese di `p_data_fine` — il mese di chiusura resta dovuto per intero;
- non tocca i canoni `fatturato` o `incassato`;
- restituisce il numero di mensilità annullate.

## 3. Funzione `riporta_contratto_in_bozza(p_contratto_id) RETURNS void`

Stesse regole di sicurezza. In una sola transazione:

- errore se il contratto non è `attivo`;
- errore se esiste anche una sola mensilità `fatturato` o `incassato`;
- errore se `deposito_stato` è diverso da NULL e da `atteso`;
- cancella **tutte** le righe di `canoni` del contratto (necessario perché `attiva_contratto` rifiuta se ne esistono già);
- riporta lo stato a `bozza` e azzera `motivo_chiusura`.

## 4. Azioni nella scheda contratto (`/admin/contratti/:id`)

Per lo stato `attivo`:

- **Chiudi contratto** — dialogo con data di fine effettiva precompilata a oggi, motivo fra `fine_naturale`, `partenza_anticipata` e `risoluzione`, e anteprima calcolata dai canoni: quante mensilità verranno annullate e quante restano intoccate perché già fatturate o incassate. Chiama `chiudi_contratto` con stato `scaduto` per fine naturale e `risolto` per gli altri due motivi.
- **Riporta in bozza** — visibile solo se nessuna mensilità è fatturata o incassata e il deposito non è stato incassato. Se le condizioni non sono soddisfatte l'azione non compare e al suo posto un testo spiega che il contratto ha già prodotto documenti fiscali e può solo essere chiuso. Dialogo di conferma che avverte della cancellazione delle mensilità.

Gli stati `scaduto`, `risolto` e `rinnovato` non offrono nessuna di queste azioni. L'intestazione mostra anche il motivo di chiusura.

## 5. Sostituzione del contratto

Azione **Sostituisci contratto** su un contratto `attivo`:

- chiede la data di fine del vecchio contratto, poi chiama `chiudi_contratto` con stato `rinnovato` e motivo `sostituzione`;
- apre subito `ContrattoDialog` precompilato dal contratto chiuso: studente, struttura, assegnazione, anagrafica di fatturazione, canone, aliquota, giorno di scadenza, garante, deposito; `data_inizio` proposta al giorno successivo alla fine del vecchio;
- il nuovo contratto nasce con `contratto_precedente_id` valorizzato con l'id del vecchio;
- nella scheda contratto: se `contratto_precedente_id` è valorizzato, link "Sostituisce il contratto del [periodo]"; sul vecchio contratto il link inverso verso il successore.

Tecnicamente `ContrattoDialog` riceve due prop opzionali nuove (precompilazione e id del contratto precedente) che inizializzano il form all'apertura, senza cambiare il comportamento delle chiamate esistenti.

## 6. Proposta di chiusura alla conclusione del soggiorno

In `useCandidaturaActions`, dopo il successo di "Concludi soggiorno" si cerca un contratto `attivo` collegato all'assegnazione conclusa. Se esiste, si apre un dialogo che **propone** — non impone — di chiudere anche il contratto, con data di fine precompilata a quella del soggiorno e motivo suggerito:

| motivo assegnazione | motivo contratto | stato |
|---|---|---|
| fine_naturale | fine_naturale | scaduto |
| partenza_anticipata / mai_arrivato | partenza_anticipata | risolto |
| allontanato | risoluzione | risolto |
| trasferimento | nessuna proposta | — |

Rifiutando non succede nulla; accettando si chiama `chiudi_contratto`.

## 7. Documentazione

`docs/Context.md` §8bis: gli stati di chiusura e cosa li distingue, la regola meccanica che separa "riporta in bozza" (nessun fatto economico) da "chiudi" (almeno uno), il fatto che la data di fine viene riscritta con la data effettiva alla chiusura, l'annullamento delle sole mensilità successive al mese di chiusura, le due nuove funzioni con il motivo per cui esistono, la sostituzione con `contratto_precedente_id` e la proposta di chiusura da Residenti.

## Fuori perimetro

Nessuna modifica al ciclo del deposito, nessun editor listini, nessun promemoria in Home, nessuna automazione di chiusura alla scadenza, nessuna modifica a `canoni_protect_fatturati`, `contratti_protect_delete`, `attiva_contratto`, `aggiorna_canone_contratto`, nessun riferimento a Fatture in Cloud.

## Ordine di esecuzione

1. Migration con colonna e CHECK; seconda migration con le due funzioni e i relativi permessi.
2. Rigenerazione dei tipi, poi le modifiche a `ContrattoPage.tsx`, `ContrattoDialog.tsx` e `useCandidaturaActions.tsx`.
3. Aggiornamento di `docs/Context.md`.