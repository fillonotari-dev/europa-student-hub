# Piano: evidenziare e spostare il bottone "Aggiungi persona" in Residenti

## Obiettivo
Nella pagina `/admin/residenti` rendere il bottone **Aggiungi persona** più visibile rispetto alle altre azioni e posizionarlo come ultimo elemento a destra, dopo il bottone "Esporta Excel".

## Modifiche previste
1. In `src/pages/admin/Residenti.tsx`:
   - spostare il `<Button ...>Aggiungi persona</Button>` dopo `<ExportButton ... />`;
   - cambiare la variante da `outline` a `default` (colore primario) per dare risalto;
   - mantenere `size="sm"`, l'icona `UserPlus` e il testo esistente.

## Cosa non cambia
- Nessuna modifica al database, alle Edge Function o alla logica di inserimento manuale.
- Il dialogo `AggiungiPersonaDialog` resta invariato.

## Verifica post-implementazione
- Build senza errori.
- Visual check della toolbar in `/admin/residenti`: "Aggiungi persona" è l'ultimo bottone a destra con colore primario.
