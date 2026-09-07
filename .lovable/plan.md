# Modifica titolo pagina Fatturazione

## Obiettivo
Allineare il titolo della pagina `/admin/fatturazione` alle altre pagine admin: titolo statico "Fatturazione" in alto a sinistra, senza sottotitolo e senza indicazione dinamica del mese.

## Intervento
- In `src/pages/admin/Fatturazione.tsx` sostituire l'attuale `<h1>Da emettere — {etichettaMese(mese)}</h1>` con `<h1>Fatturazione</h1>`.
- Mantenere il selettore del mese a destra.
- Non modificare logica, query, API o altre pagine.

## Criterio di completamento
- Titolo visibile in alto a sinistra: "Fatturazione".
- Build senza errori.
