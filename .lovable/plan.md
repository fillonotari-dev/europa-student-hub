# Prezzi IVA inclusa: l'operatore digita il lordo, il database conserva l'imponibile

## Verifica preliminare (scostamento da segnalare)

Il contratto `c30621c8-deea-40ce-b4fe-51762fa8646e` ha oggi `canone_mensile = 300.00` e `aliquota_iva = 10.00`, non 350.00 come indicato nel punto 6. È in bozza e non ha mensilità (0 righe in `canoni`), quindi la correzione resta indolore, ma il valore di destinazione cambia a seconda dell'intenzione:

- se l'importo concordato è 350 € IVA inclusa → imponibile 318,18;
- se l'importo concordato è 300 € IVA inclusa → imponibile 272,73.

Non tocco quella riga finché non confermi quale dei due. Il resto del lavoro procede comunque.

I listini esistenti sono coerenti con la lettura "lordo": doppia 350,00 (due righe, sedi diverse) e singola 450,00, tutte valide dal 01/08/2026. Nessuna riga in `canoni` in tutto il database.

## 1. Funzione pura di conversione

Nuovo `src/lib/iva.ts`:

- `imponibileDaLordo(lordo, aliquota)` → `round2(lordo / (1 + aliquota/100))`
- `lordoDaImponibile(imponibile, aliquota)` → `round2(imponibile * (1 + aliquota/100))`
- `scomposizione(lordo, aliquota)` → `{ imponibile, iva, totale }`, dove `totale` è il ricalcolo effettivo (`imponibile + iva`), cioè ciò che finirà davvero in fattura.

Nuovo `src/test/iva.test.ts` con, al 10%: 350 → 318,18 → 350,00; 450 → 409,09 → 450,00; e il caso non idempotente 500 → 454,55 → 500,01, documentato in un commento come comportamento atteso dell'arrotondamento a due decimali, non come difetto.

## 2. Rinomina del campo di listino

Migrazione additiva: `ALTER TABLE public.listini RENAME COLUMN importo_mensile TO importo_mensile_lordo` e `CREATE OR REPLACE FUNCTION public.imposta_listino(...)` con la nuova colonna, firma e permessi invariati (`REVOKE`/`GRANT` già presenti restano). Nessun `DROP`, nessun valore modificato: i dati erano già lordi.

`ListiniSection.tsx`: colonna e campo diventano "Importo mensile IVA inclusa (€)", con una riga esplicativa che i prezzi di listino si esprimono IVA inclusa e che il sistema conserva l'imponibile.

## 3. ContrattoDialog

- Il campo "Canone mensile" diventa "Canone mensile (IVA inclusa)" e lo stato `canone` rappresenta il lordo.
- Sotto al campo, scomposizione sempre visibile e ricalcolata anche al cambio di aliquota: imponibile, IVA, totale in fattura. Se il totale differisce dal digitato, avviso con token semantici che spiega che in fattura andrà quella cifra.
- Proposta dal listino: nessuna conversione, il listino è già lordo (cambia solo il nome della colonna letta).
- Precompilazione da contratto da sostituire: `c.canone_mensile` è un imponibile, va convertito con `lordoDaImponibile` usando l'aliquota del contratto sostituito prima di finire nel campo.
- Al salvataggio, `contratti.canone_mensile` riceve `imponibileDaLordo(canone, aliquota)`.

## 4. ContrattoPage — riga "Canone mensile"

- Dato principale: lordo (`lordoDaImponibile`); sotto, in secondario, "imponibile X €".
- Modifica in riga: il campo si precarica con il lordo, accetta il lordo, e `salvaCanone` passa l'imponibile a `aggiorna_canone_contratto` (firma invariata).

## 5. Anteprima e scadenzario

- Anteprima prima di "Attiva contratto": la colonna importo mostra `totaleRiga(r)` (IVA inclusa), coerente con il totale complessivo già in fondo. Le righe inviate a `attiva_contratto` restano imponibili.
- Tabella scadenzario: la correzione a mano della cella chiede il totale IVA inclusa (precaricato da `c.totale`), lo converte con `c.aliquota_iva` e scrive `imponibile`. Etichetta e tooltip aggiornati di conseguenza; il badge "importo diverso dal canone" resta com'è.

## 6. Dati e documentazione

- Correzione della riga in bozza dopo la tua conferma sul valore (vedi sopra).
- `docs/Context.md`: nuova regola — prezzi di listino e canoni si esprimono IVA inclusa, il database conserva l'imponibile (`listini.importo_mensile_lordo` è l'unica colonna lorda), la conversione vive in `src/lib/iva.ts`, e l'arrotondamento può produrre un totale che scarta di un centesimo dal digitato.

## Fuori perimetro

`src/lib/canoniRicalcolo.ts`, `aggiorna_canone_contratto`, `generaScadenzario` e la colonna generata `canoni.totale` restano sull'imponibile.

## Ordine di esecuzione

1. `src/lib/iva.ts` + test
2. Migrazione rinomina + `imposta_listino`
3. ListiniSection, ContrattoDialog, ContrattoPage
4. Correzione dato, documentazione, suite e typecheck
