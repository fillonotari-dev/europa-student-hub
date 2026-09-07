# Fatturazione: sei modifiche di interfaccia

Tutto in `src/pages/admin/Fatturazione.tsx`. Nessuna modifica a logica, query, Edge Function, dialogo o database.

## 1. Filtri in testa, mese nella URL

- Il contenitore del selettore diventa `flex items-center gap-3 flex-wrap`, selettore allineato a sinistra (via `justify-end`), come in `Contratti.tsx` (riga 114).
- Il mese passa da `useState` a `useSearchParams` con l'helper `patchParams` copiato dal pattern di `Contratti.tsx` (righe 69-76): parametro `mese`, default `meseCorrente()` quando assente.
- Il pulsante "Vai a …" dell'avviso arretrati chiama `patchParams({ mese: meseArretratoPiuVecchio })` invece di `setMese`.
- L'`useEffect` che azzera la selezione al cambio mese resta, ora dipendente dal parametro URL.

## 2. Barra di selezione sopra la tabella

- Il blocco con "Seleziona tutte le emettibili", riepilogo e pulsante "Emetti le fatture selezionate" si sposta dalla parte bassa della section a sopra il `<table>`, come prima fascia della card (border-b invece di border-t).
- Layout invariato: a sinistra la casella con l'etichetta, a destra riepilogo e pulsante. Resta visibile solo se ci sono emettibili.

## 3. Archivio chiuso di default con Collapsible

- La section archivio usa `Collapsible`/`CollapsibleTrigger`/`CollapsibleContent` da `src/components/ui/collapsible.tsx`, chiuso all'apertura.
- L'intestazione mostra il conteggio: `Archivio ({archivio.length})`, con un chevron che ruota all'apertura.
- Il pannello "Da riconciliare" resta esattamente com'è: sempre visibile quando non vuoto.

## 4. Allineamento tabelle al modello Contratti

Per tutte e tre le tabelle (mese, riconciliazione, archivio):

- `<table className="w-full">` e `text-sm` spostato sul `tbody` (oggi è sulla table).
- Celle del corpo: `px-4 py-3` al posto di `px-4 py-2`.
- Riga vuota: `px-4 py-10` al posto di `px-4 py-8` (anche la riga "Caricamento…").
- Il contenitore `bg-card border border-border/50 rounded-lg overflow-hidden` è già conforme; la riconciliazione mantiene il suo bordo `border-destructive/40`.

## 5. Hover sulle righe

- `hover:bg-muted/50` su tutte le righe dati delle tre tabelle, senza `cursor-pointer`.

## 6. Importi allineati a sinistra

- Le colonne Imponibile, IVA, Totale (tabella mese) e Totale (riconciliazione e archivio) passano da `text-right` a `text-left`, intestazioni comprese.
- Nota dichiarata: l'allineamento a destra degli importi si legge meglio, ma la scelta sarà ripresa quando verrà estratto un componente tabella comune; qui vige l'uniformità.

## Verifica

- Typecheck + build; rilettura del file a fine intervento per confronto con i sei punti.
