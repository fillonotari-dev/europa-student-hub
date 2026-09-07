# Fatturazione: una pagina propria per il lotto del mese

L'emissione lascia la scheda contratto e diventa un processo mensile con una porta sola: `/admin/fatturazione`. Nessuna migration, nessuna modifica a `fic-emetti-fattura`. Solo interfaccia.

## 1. Nuova rotta e voce di menu

- `src/App.tsx`: rotta `fatturazione` sotto `AdminLayout` (stessa protezione admin delle altre).
- `src/components/admin/AdminSidebar.tsx`: voce "Fatturazione" subito sotto "Contratti", icona `Receipt`.

## 2. Elenco delle mensilità da fatturare

Nuova pagina `src/pages/admin/Fatturazione.tsx`. Query: `canoni` in stato `da_fatturare` con join sul contratto (`contratti!inner(stato, studenti(nome, cognome), strutture(nome))`), filtrata sui contratti `attivo`.

Colonne: mese di competenza, studente, struttura, imponibile, IVA (totale − imponibile), totale, scadenza. Ordinamento per competenza crescente, poi cognome.

Nessun filtro attivo all'apertura: gli arretrati restano visibili. Un select "mese di competenza" è disponibile ma parte su "tutti".

## 3. Guardie: le decide la funzione, non la pagina

All'apertura la pagina chiama `fic-emetti-fattura` con tutti i `canone_ids` dell'elenco e `conferma: false`, e usa gli esiti per marcare ogni riga.

- Esito `ok` → riga emettibile e selezionabile.
- Esito con `message` → riga bloccata, non selezionabile, con il motivo mostrato in chiaro (intestazione non collegata, campi mancanti elencati, aliquota diversa, mensilità non più in `da_fatturare`, contratto non attivo).

La funzione accetta al massimo 50 `canone_ids` per chiamata (`Body` in `supabase/functions/fic-emetti-fattura/index.ts`): la pagina spezza sia l'anteprima sia l'emissione in gruppi da 50 in sequenza e unisce gli esiti. Nessun criterio di blocco viene riscritto lato interfaccia.

## 4. Selezione, riepilogo, conferma, esito che resta

- Casella di selezione sulle sole righe emettibili, più "seleziona tutte le emettibili".
- Barra in fondo: "N mensilità — totale X €" e pulsante **Emetti le fatture selezionate**.
- `EmettiFatturaDialog` generalizzato da un canone a molti: accetta `canoneIds: string[]`, mostra in anteprima l'elenco delle righe con importi e totale complessivo, lo stesso avviso che si adegua a `TIPO_DOCUMENTO` e la stessa nota che la trasmissione allo SDI resta manuale. Resta un componente a livello di modulo.
- Al ritorno **nessun toast come unico esito**: la pagina mostra un pannello di riepilogo che resta a schermo — quante riuscite, e per ogni fallita la mensilità (studente + mese) e il motivo. Il pannello si chiude solo esplicitamente. Vengono riportati anche i `passi_saltati` dichiarati dalla funzione quando `TIPO_DOCUMENTO` è `proforma`.

## 5. Riconciliazione (sola lettura)

In fondo, visibile solo se non vuota: righe di `fatture` in stato `in_invio`, oppure `emessa` ma non referenziate da alcun canone (`canoni.fattura_id`). Per ognuna: contratto (studente), importo, stato, `messaggio_errore`, data. Nessun pulsante di risoluzione in questa versione.

## 6. Scheda contratto e documentazione

- `src/pages/admin/ContrattoPage.tsx`: rimossi l'azione "Emetti fattura", il dialogo e il relativo stato. Lo scadenzario resta e continua a mostrare numero e data della fattura sulle mensilità già fatturate.
- `docs/Context.md`: registrata la regola — l'emissione vive solo in `/admin/fatturazione`; la scheda contratto racconta cosa è successo senza essere il posto da cui far succedere le cose — e spiegato che la pagina valuta le guardie chiamando `fic-emetti-fattura` senza conferma, così nessuno le riscriva lato interfaccia.

## Fuori perimetro (dichiarato)

- Nessuna migration, nessuna modifica alla funzione di emissione.
- Nessuna azione di risoluzione nella riconciliazione.
- Nessuna trasmissione allo SDI, nessuna email.

## Verifica finale

Suite Vitest, typecheck, build; controllo che la scheda contratto non contenga più riferimenti all'emissione; resoconto punto per punto con file.
