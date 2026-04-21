

## Piano: Camere in vista tabella

Sostituire la visualizzazione a card raggruppata per piano con una tabella unica più leggibile e scansionabile.

### Struttura tabella

Colonne:
- **Numero** (con icona porta)
- **Struttura**
- **Piano**
- **Tipo** (singola/doppia)
- **Posti** (occupati/totali, es. "1/2")
- **Occupanti** (nomi separati da virgola, "—" se libera)
- **Stato** (badge colorato: Libera / Parz. occupata / Occupata / Manutenzione)
- **Azioni** (pulsante "Gestisci" che apre il dialog esistente)

### Comportamento

- Header tabella stilizzato come Candidature/Residenti (`bg-muted/70 text-xs uppercase tracking-wider`)
- Righe ordinate per struttura → piano → numero
- Clic su riga o pulsante "Gestisci" apre il dialog esistente per assegnazione/conclusione
- Filtro struttura in alto (mantenuto)
- Aggiunta filtro stato (select: tutti/libera/parzialmente_occupata/occupata/manutenzione)
- Legenda colori rimossa (gli stati sono già visibili nei badge)
- Animazione fade-in righe (stagger leggero)

### Badge stato

Riutilizzo del componente `Badge` con varianti custom via className:
- Libera → verde (success)
- Parz. occupata → giallo (warning)
- Occupata → rosso (destructive)
- Manutenzione → grigio (muted)

### File da modificare

1. **`src/pages/admin/Camere.tsx`** — sostituire la sezione "Rooms by floor" con una `<Table>` (import da `@/components/ui/table`), aggiungere stato `filterStato`, mantenere intatto il `Dialog` di gestione e tutte le mutation esistenti (`assegna`, `concludi`).

Nessuna modifica al database o ad altri file.

