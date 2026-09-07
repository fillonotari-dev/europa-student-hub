# Ripristinare “Fatturazione” nella barra superiore

## Modifica
- In `src/pages/admin/Fatturazione.tsx`, ripristinare `usePageTitle('Fatturazione')` così la pagina comunica esplicitamente il titolo alla barra comune.
- Non aggiungere alcun titolo nel contenuto: il testo deve apparire esclusivamente nell’`h1` di `AdminTopBar` in `src/pages/admin/AdminLayout.tsx:22`, nella stessa posizione usata dalle altre pagine.

## Verifica
- Aprire `/admin/fatturazione` con una sessione amministratore e controllare visivamente che “Fatturazione” compaia in alto a sinistra nella barra, mentre il selettore del mese resti nel contenuto.
- Controllare che non esistano titoli duplicati e che la compilazione resti valida.

## Limiti
- Nessuna modifica a fatture, filtri, emissione, database o altre pagine.
