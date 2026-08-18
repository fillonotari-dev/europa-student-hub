# Listini: proposta del canone, funzione imposta_listino, editor in Impostazioni

Il punto 1 del messaggio è arrivato troncato: assumo che chieda la revoca dei permessi pubblici sulle funzioni RPC dei contratti. Lo tratto come punto 0 qui sotto; correggimi se intendevi altro.

## 0. Permessi sulle funzioni esistenti (assunzione)
Per `attiva_contratto`, `aggiorna_canone_contratto`, `chiudi_contratto`, `riporta_contratto_in_bozza`: `REVOKE ALL ... FROM PUBLIC`, `REVOKE EXECUTE ... FROM anon`, `GRANT EXECUTE ... TO authenticated`. Nessuna modifica al corpo delle funzioni.

## 1. Proposta del listino indipendente dall'assegnazione (ContrattoDialog.tsx)
- Nuovo campo "Tipo camera" (singola / doppia) nella sezione Contratto. Precompilato dal tipo della camera dell'assegnazione quando esiste, altrimenti scelto dall'operatore. Non viene salvato su `contratti`: serve solo a scegliere il prezzo.
- La ricerca del listino esce dal blocco di precompilazione e diventa un effetto su `(strutturaId, tipoCamera)`: parte ogni volta che entrambi sono valorizzati, anche senza assegnazione.
- Il canone proposto non sovrascrive un importo digitato: si tiene traccia dell'ultimo valore proposto e si aggiorna il campo solo se è vuoto o se contiene ancora esattamente quel valore.
- Tre stati distinti sotto al campo canone:
  - coppia incompleta: "Seleziona struttura e tipo camera per vedere il canone di listino."
  - ricerca eseguita senza risultato: "Nessun listino valido oggi per questa sede e tipo camera: inserisci l'importo a mano."
  - listino applicato: importo, sede, tipo camera e data di decorrenza.
- In modalità sostituzione il canone del vecchio contratto resta quello precompilato e non viene sovrascritto dal listino (è un valore "digitato").

## 2. Funzione imposta_listino
`imposta_listino(p_struttura_id uuid, p_tipo_camera text, p_importo numeric, p_valido_dal date) RETURNS uuid`, `SECURITY INVOKER`, `SET search_path TO 'public'`, `REVOKE ALL FROM PUBLIC`, `REVOKE EXECUTE FROM anon`, `GRANT EXECUTE TO authenticated`.

Esiste perché il vincolo EXCLUDE `listini_no_overlap` rifiuta due listini validi insieme per la stessa coppia sede + tipo camera: un semplice inserimento fallisce sempre finché il precedente è aperto.

In un'unica transazione:
- errore se `p_tipo_camera` non è 'singola' o 'doppia', o se `p_importo` è nullo o negativo;
- errore se esiste già un listino per quella coppia con `valido_dal >= p_valido_dal`;
- chiude il listino aperto per quella coppia con `valido_al = p_valido_dal - 1`;
- inserisce il nuovo listino con `valido_al` NULL;
- restituisce l'id del nuovo listino.

## 3. Editor dei listini in /admin/impostazioni
Nuova sezione "Listini" sotto le impostazioni di contatto:
- tabella per sede e tipo camera con importo, decorrenza e periodo di validità; riga in vigore oggi evidenziata, storico in grigio;
- modulo "Nuovo prezzo" (sede, tipo camera, importo, data di decorrenza) che, prima della conferma, mostra quale listino verrà chiuso e da quale data, poi chiama `imposta_listino`;
- nessuna modifica in riga e nessuna cancellazione: un prezzo già applicato a un contratto è un fatto storico, si cambia aprendone uno nuovo.

## 4. Documentazione
`docs/Context.md`: sezione Listini in Impostazioni, `imposta_listino` con il motivo (vincolo EXCLUDE), la regola che i listini non si modificano ma si succedono nel tempo, e la correzione del comportamento della proposta del canone.

## Fuori perimetro
Nessun ciclo del deposito, nessun promemoria in Home, nessuna modifica al corpo delle RPC contratti, nessuna colonna nuova su `contratti`, nessun riferimento a Fatture in Cloud.

## Ordine di esecuzione
1. Migrazione (permessi + `imposta_listino`)
2. Sezione Listini in Impostazioni
3. ContrattoDialog
4. Documentazione, typecheck e test
