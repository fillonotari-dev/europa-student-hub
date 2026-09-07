# Titolo Fatturazione nella posizione corretta

## Modifica
- Rimuovere il titolo `Fatturazione` inserito dentro il contenuto della pagina (`src/pages/admin/Fatturazione.tsx:244`).
- Lasciare il selettore del mese allineato a destra, senza creare un secondo titolo.
- Usare esclusivamente la barra superiore comune delle pagine admin (`src/pages/admin/AdminLayout.tsx:22`), dove il titolo della rotta `/admin/fatturazione` è già definito come `Fatturazione` (`src/hooks/usePageTitle.ts:19`).
- Eliminare dalla pagina l'override ridondante `usePageTitle('Fatturazione')`, così il testo dipende direttamente dalla rotta e non può rimanere quello della pagina precedente.

## Verifica
- Aprire `/admin/fatturazione` e controllare che in alto a sinistra, nella stessa identica posizione di `Contratti`, compaia `Fatturazione`.
- Controllare che nel contenuto non esista un secondo titolo e che il selettore del mese resti in alto a destra.
- Verificare compilazione e assenza di errori nella pagina.

## Fuori ambito
Nessuna modifica a fatture, filtri, emissione, database o altre pagine.
