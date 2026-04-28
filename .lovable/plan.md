# Fix: Combobox del corso di studi si blocca dopo la prima apertura

## Problema osservato
Nel form `/candidatura`, dopo aver aperto e chiuso senza selezionare il dropdown "Corso di studi" (e potenzialmente anche Università/Dipartimento), il bottone non si riapre più.

## Causa probabile
Nel `Combobox` (in `src/pages/Candidatura.tsx`) i tre campi accademici condividono lo stesso pattern: `Popover` + `cmdk` con un array `options` ricostruito a ogni render e `CommandItem` con chiavi/`value` derivate da `group + label`. Due fattori si sommano:

1. Le `options` (e gli oggetti dentro) sono ricreati ad ogni render → `cmdk` può rimontare in stato inconsistente.
2. Il `Button` trigger ha `type="button"` ma è dentro un `<form>` implicito di step (lo step si trova dentro un container con `motion.div` + `AnimatePresence`). Quando il Popover si chiude, Radix riporta il focus al trigger; se nel frattempo `AnimatePresence` ha già rimontato il nodo, il focus va su un nodo diverso e i click successivi sul nuovo bottone non aprono il Popover (event handlers interrotti dal focus-guard di Radix).
3. Il warning in console "Function components cannot be given refs… Check the render method of `Field`" indica che Radix sta cercando di passare un `ref` al trigger ma `Button` viene wrappato dentro `Field` o un altro componente senza `forwardRef`. Per il `Combobox` corrente il trigger è `Button` direttamente, quindi questo riguarda altri campi — ma indica che ci sono problemi di forwarding ref nel file.

## Soluzioni da applicare

### 1. Stabilizzare le `options` con `useMemo`
In `UniversitaField`, `DipartimentoField`, `CorsoField` calcolare `options` con `useMemo` dipendente dai parametri. Questo evita che `cmdk` veda nuovi oggetti ogni render.

### 2. Modal Popover
Passare `modal={false}` al `Popover` (default) ma aggiungere `onOpenChange` con cleanup esplicito; in alternativa usare `modal` per garantire che il focus management funzioni anche dentro `AnimatePresence`.

In pratica la fix robusta è:
- Spostare il rendering degli step **fuori** da `AnimatePresence` per il sotto-albero che contiene Popover, oppure
- Più semplice: aggiungere `onCloseAutoFocus={(e) => e.preventDefault()}` su `PopoverContent` del `Combobox`. Questo evita che Radix tenti di restituire il focus al trigger (che, in combinazione col rerender da `framer-motion`, causa il "blocco" del bottone).

### 3. CommandItem value unico
Cambiare `value={o.searchKey || o.label}` in qualcosa di garantito unico (`${o.group ?? ''}-${o.value}`) e usare `keywords={[o.label, o.group]}` per la ricerca. Così `cmdk` non confonde item con label uguali in gruppi diversi.

### 4. Reset interno del Combobox
Quando il Popover si chiude senza selezione, resettare lo stato del `Command` (input di ricerca) usando una `key` sul `Command` legata a `open`, così alla prossima apertura il componente è "fresco".

## File da modificare
- `src/pages/Candidatura.tsx` — applicare i 4 punti sopra al solo componente `Combobox` (e di riflesso a `UniversitaField`/`DipartimentoField`/`CorsoField`). Nessun cambio a `NationalityField` se non riproduce il problema.

## Verifica
Dopo la modifica, sul preview:
1. Aprire dropdown Università → chiudere senza selezionare → riaprire (deve funzionare).
2. Stessa prova su Dipartimento e Corso di studi.
3. Verificare che la selezione di un corso popoli correttamente il form.
