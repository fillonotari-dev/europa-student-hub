## Patch correttiva post-Intervento A (rev.2)

Perimetro minimo: UI Camere e Residenti allineate al nuovo schema, buco delle assegnazioni aperte chiuso, `trasferimento` come motivo di chiusura, `docs/Context.md` aggiornato.

### 1. Migrazione DB

Nome verificato del CHECK: `assegnazioni_motivo_chiusura_chk`. Usare comunque `IF EXISTS` per idempotenza.

```sql
ALTER TABLE public.assegnazioni
  DROP CONSTRAINT IF EXISTS assegnazioni_motivo_chiusura_chk;
ALTER TABLE public.assegnazioni
  ADD CONSTRAINT assegnazioni_motivo_chiusura_chk CHECK (
    (stato = 'conclusa' AND motivo_chiusura = ANY (ARRAY[
      'fine_naturale','partenza_anticipata','mai_arrivato','allontanato','trasferimento'
    ]))
    OR (stato = 'attiva' AND motivo_chiusura IS NULL)
  );
```

### 2. `src/pages/admin/Camere.tsx`

- **Costanti stato** (32–47, 269): ricostruire `STATO_CAMERA_LABELS`, `STATO_BADGE_CLASSES`, `STATO_ORDER` sui tre valori reali `disponibile | manutenzione | non_disponibile`.
- **Fallback** (252, 269, 344, 385): `c.stato || 'libera'` → `c.stato`.
- **Select filtro** (323–331): tre opzioni nuove.
- **`?candidatura=`** (118): `setFilterStato('disponibile')`.
- **Modalità assegnazione** (524): `stato === 'disponibile'`.
- **`saveCamera` insert** (186): rimuovere `stato: 'libera'` (default DB `disponibile`).
- **`reactivate`** (219–233): update semplice `stato: 'disponibile'`; dialogo (661) riscritto senza promettere ricalcolo.
- **`assegna`** (127–147) + dialogo occupanti (524–561): aggiungere due `Input type="date"` obbligatori `assegnaInizio` / `assegnaFine`, precompilati da `periodo_inizio` / `periodo_fine` della candidatura selezionata quando presenti (altrimenti `assegnaInizio = oggi`, `assegnaFine` vuoto). Bottone Assegna disabilitato senza `assegnaFine`. Mutazione insert usa i due valori.
- **`concludi`** (149–165, 511–516): rimossa. Nel blocco "Occupanti attivi" sostituire il bottone con un rimando testuale a Residenti.
- **Dialogo occupanti** (495): `STATO_CAMERA_LABELS[selectedCamera.stato]` ora restituisce sempre etichetta valida.

### 3. `src/pages/admin/Residenti.tsx`

- **`concludi`** (132–149) + dialogo (379–417): stato locale `endMotivo` + `Select` obbligatorio con `fine_naturale | partenza_anticipata | mai_arrivato | allontanato`. Bottone conferma disabilitato senza motivo. Update passa `motivo_chiusura`.
- **Descrizione dialogo** (386–392): rimuovere la parte "lo stato della camera viene ricalcolato…", sostituire con testo neutro.
- **Dialogo trasferimento** (323–376): aggiungere `Input type="date"` obbligatorio `transferDataFine` (precompilato da `data_fine` della vecchia assegnazione se presente).
- **`transferisci`** (99–130) — riordinare in tre fasi, tutte prima di qualsiasi scrittura:
  1. **Calcolo posto libero**. Chiamata `supabase.rpc('camere_disponibilita', { p_dal: data, p_al: transferDataFine, p_struttura_id: null })`, filtro sulla `camera_id` di destinazione, `posti_occupati_numeri` come base. Ciclo `for (let p = 1; p <= camera.posti; p++) if (!occupati.includes(p)) return p;`. Se la camera di destinazione coincide con quella di partenza rifiutare con messaggio esplicito ("il trasferimento richiede una camera diversa"): la vecchia assegnazione è ancora attiva e il proprio posto risulterebbe occupato. Se nessun posto libero, `throw` con messaggio esplicito.
  2. **Chiusura vecchia**: `motivo_chiusura: 'trasferimento'`, `data_fine = data - 1 giorno` calcolata in UTC:
     ```ts
     const d = new Date(data + 'T00:00:00Z');
     d.setUTCDate(d.getUTCDate() - 1);
     const dataFineVecchia = d.toISOString().slice(0, 10);
     ```
  3. **Insert nuova** con `posto` calcolato, `data_inizio: data`, `data_fine: transferDataFine`, `stato: 'attiva'`.
- **`camereDisponibili`** (86, 207–211): `tutteCamere` da `.neq('stato','manutenzione')` a `.eq('stato','disponibile')`.

### 4. Controllo generale fusi

Cercare in `Camere.tsx` e `Residenti.tsx` altre occorrenze di `new Date(<stringa yyyy-mm-dd>)` seguite da `.toISOString()`: se ne emergono, aggiungere `'T00:00:00Z'` o rimpiazzare con manipolazione stringa. (Nota: `new Date().toISOString().split('T')[0]` per "oggi" è OK — usa la data UTC corrente, non una stringa data in ora locale.)

### 5. `docs/Context.md`

- Stadi `v_studenti_stadio`: `in_casa, assegnato, da_valutare, in_attesa_studente, da_decidere, in_attesa_posto, archiviato`.
- `camere_disponibilita` e vincolo GIST: intervalli chiusi `[…]`, `data_fine` inclusa (ultimo giorno di permanenza).
- `motivo_chiusura`: CHECK su `fine_naturale, partenza_anticipata, mai_arrivato, allontanato, trasferimento`.

### Fuori perimetro

Dashboard, filtro sede globale, uso di `v_studenti_stadio` nelle pagine, Storico, `Candidature.tsx`.

### Verifiche

- Concludere soggiorno da Residenti: motivo richiesto, bottone disabled senza; con motivo passa.
- Trasferire con `data_inizio = 2026-09-15`: vecchia riga conclusa con `data_fine = 2026-09-14` (né `2026-08-30` né `2026-09-13`).
- Trasferire in una camera con posto 1 libero e 2 occupato: propone posto 1.
- Trasferire senza posti liberi: fallisce prima di chiudere la vecchia — lo studente resta in Residenti sulla camera di partenza.
- Trasferire nella stessa camera di partenza: rifiutato con messaggio, nessuna scrittura.
- Assegnare da Camere senza `data_fine`: bottone disabled.
- Riattivare da manutenzione: la camera torna `disponibile`.
- Badge di stato camera visibile su tutte le righe.
