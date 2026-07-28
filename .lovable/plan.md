## Obiettivo
Unificare tutti i documenti della scheda persona sotto un'unica sezione "Documenti", eliminando la suddivisione tra "Documento di identità", "Documento garante" e "Altri documenti".

## Modifiche
**File:** `src/pages/admin/StudentePage.tsx`

- Rimuovere le sezioni separate per identità / garante / altri.
- Creare un unico blocco `DataCard` intitolato **"Documenti"** che elenca tutti i file presenti in `documenti`, indipendentemente dal `tipo`.
- Mantenere per ogni file: etichetta leggibile del tipo (Documento di identità, Certificato iscrizione, Documento garante, Documento aggiuntivo, ecc.), nome file, e azione di download/anteprima già esistente.
- Ordinamento suggerito: identità → certificato iscrizione → garante → aggiuntivi → altri, poi per data di caricamento.
- Se non ci sono documenti, la card resta nascosta (coerente con il pattern `DataCard` esistente).

## Fuori scope
Nessuna modifica a DB, edge functions, o logica di upload.
