

## Piano: sistema di "Azioni Admin" per Camere, Candidature, Residenti

Pattern UI uniforme: **menu "⋯" per riga** (DropdownMenu) + **conferme AlertDialog** per azioni distruttive. Nessuna duplicazione con la sezione Esportazione esistente.

---

### 1. Camere — CRUD completo + manutenzione

**Toolbar:**
- **+ Nuova camera** → dialog (struttura, numero, piano, tipo, posti, note)

**Menu riga ⋯:**
- **Gestisci occupanti** (apre dialog esistente)
- **Modifica camera** → stesso dialog della creazione
- **Imposta in manutenzione** → conferma + nota opzionale (`stato='manutenzione'`)
- **Riattiva** (solo se in manutenzione) → ricalcola stato in base agli occupanti
- **Elimina camera** → conferma; bloccata se ci sono assegnazioni attive

---

### 2. Candidature — workflow completo

**Menu riga ⋯ + bottoni nel dialog dettaglio:**
- **Prendi in carico** (ricevuta → in_valutazione)
- **Approva** / **Rifiuta** (in_valutazione → …)
- **Rimetti in valutazione** (da approvata/rifiutata, per correggere errori)
- **Segna come ritirata**
- **Assegna a una camera** (solo se `approvata`) → naviga a `/admin/camere` con la candidatura preselezionata
- **Contatta via email** → `mailto:` con oggetto precompilato
- **Elimina candidatura** → conferma forte; bloccata se esiste un'assegnazione collegata

Tutte le transizioni di stato continuano a loggare in `log_stato_candidature` con nota opzionale.

---

### 3. Residenti — gestione del soggiorno

**Menu riga ⋯:**
- **Visualizza profilo** → dialog con dati anagrafici/accademici + storico assegnazioni dello studente
- **Trasferisci in altra camera** → seleziona nuova camera (filtrate per posti disponibili) + posto + data; conclude la vecchia assegnazione e ne crea una nuova attiva, aggiornando lo stato di entrambe le camere
- **Concludi soggiorno** → conferma + data fine (default oggi) + nota; aggiorna stato camera
- **Contatta via email** → `mailto:`

---

### Dettagli tecnici

- Nuovo componente `src/components/admin/RowActions.tsx`: wrapper su `DropdownMenu` (shadcn) con icona `MoreHorizontal` e slot per le voci.
- Conferme distruttive con `AlertDialog` (già usato in Camere).
- Toast su ogni esito; invalidazione coerente di `camere`, `assegnazioni-attive`, `residenti`, `candidature`, `dashboard-stats`.
- "Assegna a camera" da Candidature → naviga con `?candidatura=<id>` e Camere apre automaticamente il dialog di gestione filtrando le camere compatibili.
- Nessuna modifica al DB schema. Nessuna nuova edge function.

### File da modificare

1. `src/components/admin/RowActions.tsx` *(nuovo)*
2. `src/pages/admin/Camere.tsx` — toolbar "+ Nuova", `RowActions`, dialog create/edit, manutenzione, elimina con guard, lettura querystring `?candidatura`
3. `src/pages/admin/Candidature.tsx` — `RowActions` con tutte le transizioni, mailto, elimina con guard, link "Assegna a camera"
4. `src/pages/admin/Residenti.tsx` — `RowActions` con profilo, trasferimento, conclusione, mailto

