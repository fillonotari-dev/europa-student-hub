# Spostare il riepilogo selezione accanto al selettore del mese

## Scope
Modifica puramente di layout in `src/pages/admin/Fatturazione.tsx`. Nessun cambiamento a logica, query, API, database o altre pagine.

## Obiettivo
Il blocco con il conteggio delle mensilità selezionate, il totale e il pulsante "Emetti le fatture selezionate" deve stare sulla stessa riga del selettore del mese di competenza, allineato a destra.

## Modifiche

1. Estrarre il blocco di destra della barra di selezione (attualmente dentro la `<section>` sopra la tabella):
   - span con `{selezionate.length} mensilità — totale {fmtEuro(totaleSelezione)}`
   - pulsante "Emetti le fatture selezionate"

2. Inserirlo nel contenitore di testa già esistente:
   ```tsx
   <div className="flex items-center gap-3 flex-wrap">
     <Select ... />
     {/* blocco riepilogo + bottone qui, con ml-auto */}
   </div>
   ```
   Aggiungere `ml-auto` al blocco per spingerlo a destra.

3. Renderlo condizionale a `emettibili.length > 0`, come lo è ora sopra la tabella.

4. Lasciare la barra sopra la tabella con solo la casella "Seleziona tutte ({emettibili.length})" e il suo `Checkbox`; rimuovere da lì il riepilogo e il pulsante.

5. Verificare che il layout non si rompa quando il riepilogo va a capo su schermi stretti (`flex-wrap` del contenitore padre gestisce il wrap).

## Verifica
- Typecheck (`bunx tsc --noEmit -p tsconfig.json`).
- Build.
- Visual check nel preview: il selettore del mese rimane a sinistra, il riepilogo e il pulsante compaiono a destra sulla stessa riga quando ci sono mensilità emettibili.
