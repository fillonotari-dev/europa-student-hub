## Obiettivo
Rimuovere le etichette di tipo ("Documento di identità", "Certificato di iscrizione", ecc.) sopra ogni gruppo di documenti nella sezione "Documenti" della scheda persona, dato che il nome del tipo è già visibile nella riga `DocumentoRow`.

## Modifiche
**File:** `src/pages/admin/StudentePage.tsx`

- Nella sezione "Documenti", sostituire l'iterazione per gruppi (`Object.entries(documentiPerTipo)`) con un elenco piatto di `documentiOrdinati`, mantenendo l'ordinamento già definito.
- Rimuovere il `<p className="text-[12px] text-muted-foreground">` con l'etichetta di tipo.
- Rimuovere l'helper `documentiPerTipo` se non più usato altrove.

## Fuori scope
Nessuna modifica al componente `DocumentoRow` né alla logica di fetch.
