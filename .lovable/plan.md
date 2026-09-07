# Fatturazione: una pagina propria per il lotto del mese

L'emissione lascia la scheda contratto e diventa un processo mensile con una porta sola: `/admin/fatturazione`. Nessuna migration, nessuna modifica a `fic-emetti-fattura`. Solo interfaccia.

## 1. Nuova rotta e voce di menu

- `src/App.tsx`: rotta `fatturazione` sotto `AdminLayout` (stessa protezione admin delle altre).
- `src/components/admin/AdminSidebar.tsx`: voce "Fatturazione" subito sotto "Contratti", icona `Receipt`.

## 2. Un mese per volta

Nuova pagina `src/pages/admin/Fatturazione.tsx`. In testa un selettore del mese di competenza, preselezionato sul mese corrente. L'elenco contiene solo le mensilità `da_fatturare` di contratti `attivo` con competenza in quel mese. Scegliere un mese successivo è anche il modo per vedere ed emettere i mesi futuri: nessuna sezione separata.

Titolo esplicito: «Da emettere — giugno 2026», perché tutto ciò che segue dipende da quel valore.

Colonne: studente, struttura, imponibile, IVA (totale − imponibile), totale, scadenza. Ordinamento per cognome.

Dati: `canoni` con join `contratti!inner(stato, studenti(nome, cognome), strutture(nome))`.

## 3. Avviso arretrati

Sopra l'elenco, visibile solo se esistono mensilità `da_fatturare` di contratti attivi con competenza **precedente** al mese scelto: dice quante sono, qual è il mese più vecchio, e con un clic sposta il selettore su quel mese. Non si mescolano al lavoro del mese, ma non possono passare inosservate.

## 4. Guardie: le decide la funzione, non la pagina

Al caricamento dell'elenco la pagina chiama `fic-emetti-fattura` con i `canone_ids` del mese e `conferma: false`, e usa gli esiti per marcare ogni riga.

- Esito `ok` → riga emettibile e selezionabile; i dati dell'anteprima restano in memoria nella pagina.
- Esito con `message` → riga bloccata, non selezionabile, con il motivo in chiaro (intestazione non collegata, campi mancanti elencati, aliquota diversa, mensilità non più in `da_fatturare`, contratto non attivo).

Nessun criterio di blocco viene riscritto lato interfaccia.

## 5. Selezione, conferma, esito che resta

- Casella di selezione sulle sole righe emettibili, più "seleziona tutte le emettibili".
- Barra in fondo: "N mensilità — totale X €" e pulsante **Emetti le fatture selezionate**.
- `EmettiFatturaDialog` generalizzato da uno a molti e **senza più la chiamata di anteprima**: riceve dalla pagina le anteprime già ottenute al caricamento, così lista e dialogo non possono mostrare numeri diversi. Mostra l'elenco delle righe con importi e totale complessivo, l'avviso che si adegua a `TIPO_DOCUMENTO` e la nota che la trasmissione allo SDI resta manuale. Le guardie vengono comunque rivalutate dalla funzione alla conferma: quella è la verifica che conta. Resta un componente a livello di modulo.
- Emissione a **gruppi di dieci** canoni per chiamata (non cinquanta): ogni canone comporta due chiamate esterne — risincronizzazione dell'intestazione e creazione del documento — e cinquanta canoni sarebbero cento chiamate in sequenza in una sola richiesta.
- Se una chiamata di gruppo fallisce o va in timeout la pagina **non invita a riprovare**: ricarica l'elenco e dichiara che alcuni documenti potrebbero essere stati creati e vanno verificati nel pannello di riconciliazione prima di qualunque nuovo tentativo.
- Al ritorno **nessun toast come unico esito**: un pannello di riepilogo resta a schermo — quante riuscite, e per ogni fallita la mensilità (studente + mese) e il motivo — e si chiude solo esplicitamente. Riporta anche i `passi_saltati` dichiarati dalla funzione quando `TIPO_DOCUMENTO` è `proforma`.

## 6. Riconciliazione (sola lettura)

Visibile solo se non vuota: righe di `fatture` in stato `in_invio`, oppure `emessa` ma non referenziate da alcun canone (`canoni.fattura_id`). Per ognuna: contratto (studente), importo, stato, `messaggio_errore`, data. Nessun pulsante di risoluzione in questa versione.

## 7. Archivio delle fatture emesse

In fondo alla pagina, sola lettura: le fatture già emesse con studente, mese di competenza (dal canone collegato), numero, sezionale, data, totale e stato dell'invio elettronico (`ei_status`), ordinate dalla più recente. Risponde a «questa l'abbiamo già fatta?» senza aprire Fatture in Cloud.

## 8. Scheda contratto e documentazione

- `src/pages/admin/ContrattoPage.tsx`: rimossi l'azione "Emetti fattura", il dialogo e il relativo stato. Lo scadenzario resta e continua a mostrare numero e data della fattura sulle mensilità già fatturate.
- `docs/Context.md`: registrata la regola — l'emissione vive solo in `/admin/fatturazione`; la scheda contratto racconta cosa è successo senza essere il posto da cui far succedere le cose — e spiegato che la pagina valuta le guardie chiamando `fic-emetti-fattura` senza conferma, così nessuno le riscriva lato interfaccia.

## Fuori perimetro (dichiarato)

- Nessuna migration, nessuna modifica alla funzione di emissione.
- Nessuna azione di risoluzione nella riconciliazione.
- Nessuna trasmissione allo SDI, nessuna email.

## Verifica finale

Suite Vitest, typecheck, build; controllo che la scheda contratto non contenga più riferimenti all'emissione; resoconto punto per punto con file.
