# Prezzi IVA inclusa: l'operatore digita il lordo, il database conserva l'imponibile

## Verifiche preliminari

- Contratto in bozza `c30621c8-deea-40ce-b4fe-51762fa8646e`: oggi `canone_mensile = 300.00`, `aliquota_iva = 10.00`, 0 mensilità. Va portato a **272,73**, così che il totale in fattura sia 300,00 esatti.
- Listini esistenti coerenti con la lettura "lordo": doppia 350,00 (due sedi), singola 450,00, valide dal 01/08/2026. Nessuna riga in `canoni` in tutto il database.
- **Scostamento da segnalare sul punto 3 delle correzioni**: la colonna generata è `round(imponibile * (1 + aliquota_iva/100), 2)`, cioè arrotonda il totale, non `imponibile + round(iva, 2)`. Le due formule non coincidono sempre. La verifica di proprietà userà **la formula reale della colonna** come oracolo — è quella che produce la cifra in fattura — e il test conterrà un commento che spiega la differenza rispetto alla formulazione alternativa.

## 1. Funzione pura di conversione (`src/lib/iva.ts` + `src/test/iva.test.ts`)

Calcoli su **centesimi interi**, mai su numeri con la virgola:

- `imponibileCentDaLordoCent(lordoCent, aliquota)` → divisione con arrotondamento half-up su interi.
- `imponibileDaLordo(lordo, aliquota)` / `lordoDaImponibile(imponibile, aliquota)` → wrapper in euro che convertono in centesimi, calcolano su interi e restituiscono euro con due decimali.
- `scomposizione(lordo, aliquota)` → `{ imponibile, iva, totale }` dove `totale` replica in centesimi interi la colonna generata (`round(imponibile*(1+a/100), 2)`) e `iva = totale - imponibile`.

Test:
- 350 → 318,18 → 350,00 e 450 → 409,09 → 450,00 al 10%;
- il caso non idempotente 500 → 454,55 → 500,01, documentato come atteso;
- **verifica di proprietà**: per ogni lordo da 1,00 a 1000,00 € (passo 1 €) con aliquota 10%, `scomposizione(...).totale` coincide con l'oracolo che replica la colonna generata, e `iva === totale - imponibile`.

## 2. Rinomina del campo di listino

Migrazione additiva: `ALTER TABLE public.listini RENAME COLUMN importo_mensile TO importo_mensile_lordo` e `CREATE OR REPLACE FUNCTION public.imposta_listino(...)` sulla nuova colonna, firma e permessi invariati. Nessun `DROP`, nessun valore modificato.

`ListiniSection.tsx`: etichette "Importo mensile IVA inclusa (€)" e nota esplicita che i prezzi di listino sono IVA inclusa.

## 3. ContrattoDialog

- Campo "Canone mensile (IVA inclusa)": lo stato rappresenta il lordo.
- Sotto al campo, scomposizione ricalcolata anche al cambio di aliquota: imponibile, IVA, totale in fattura; se il totale differisce dal digitato, avviso con token semantici.
- Proposta dal listino: nessuna conversione (il listino è già lordo), cambia solo il nome della colonna letta.
- Precompilazione da contratto da sostituire: `canone_mensile` è imponibile → `lordoDaImponibile` con l'aliquota di quel contratto.
- Al salvataggio, `contratti.canone_mensile` riceve l'imponibile.

## 4. ContrattoPage — riga "Canone mensile"

- Dato principale il lordo, sotto in secondario l'imponibile.
- Modifica in riga: campo precaricato col lordo, accetta il lordo, `salvaCanone` passa l'imponibile a `aggiorna_canone_contratto` (firma invariata).

## 5. Anteprima e scadenzario

- Anteprima prima di "Attiva contratto": colonna importo su `totaleRiga(r)`, coerente col totale complessivo in fondo. Le righe inviate a `attiva_contratto` restano imponibili.
- Correzione a mano di una riga: il campo chiede il totale IVA inclusa (precaricato da `c.totale`), converte con `c.aliquota_iva` e scrive l'imponibile. **Se il totale effettivamente registrato differisce dal digitato per arrotondamento, il messaggio di conferma lo dichiara** ("registrato 500,01 € invece di 500,00"), stesso avviso del punto 3 ma nel punto della correzione.

## 6. Dati e documentazione

- `UPDATE contratti SET canone_mensile = 272.73` sulla bozza indicata.
- `docs/Context.md`: prezzi di listino e canoni si esprimono IVA inclusa; il database conserva l'imponibile (`listini.importo_mensile_lordo` è l'unica colonna lorda); la conversione vive in `src/lib/iva.ts` su centesimi interi; l'arrotondamento può produrre un totale che scarta di un centesimo dal digitato.

## 7. Censimento dei punti che mostrano un prezzo (da riportare nel resoconto)

Verificati oggi; nel resoconto dichiaro per ciascuno l'esito:

- `src/pages/admin/Contratti.tsx:167` — colonna canone dell'elenco contratti → **da portare al lordo**.
- `src/pages/admin/StudentePage.tsx:596` — "€/mese" nella scheda persona → **da portare al lordo**.
- `src/pages/admin/ContrattoPage.tsx` — riga canone, anteprima, scadenzario → punti 4 e 5.
- `src/components/admin/impostazioni/ListiniSection.tsx` — già lordo, solo etichette.
- `src/pages/admin/Contratti.tsx:172` — deposito: **resta com'è**, non è un canone e non è soggetto a IVA in questo schema.
- `src/lib/exportXlsx.ts` — verificato: **non esporta canoni né prezzi**, nessun intervento.
- Modelli email (`supabase/functions/_shared/email-templates/*`, `transactional-email-templates/registry.ts`) — verificato: **nessun importo compare in alcun template**, nessun intervento.
- `src/lib/scadenzario.ts` e `src/lib/canoniRicalcolo.ts` — base di calcolo: **restano sull'imponibile** come da perimetro.

## Fuori perimetro

`src/lib/canoniRicalcolo.ts`, `aggiorna_canone_contratto`, `generaScadenzario` e la colonna generata `canoni.totale`.

## Ordine di esecuzione

1. `src/lib/iva.ts` + test (compresa la proprietà su 1000 casi)
2. Migrazione rinomina + `imposta_listino`
3. ListiniSection, ContrattoDialog, ContrattoPage, elenco contratti, scheda persona
4. Correzione del dato, documentazione, suite e typecheck
