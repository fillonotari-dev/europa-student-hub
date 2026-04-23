

## Piano: Sezione "Storico" nella sidebar

### 1. Sidebar — nuova voce con sotto-menu

In `src/components/admin/AdminSidebar.tsx`, dopo "Camere" (e prima di "Esportazione") aggiungo una voce **"Storico"** con icona `History` (lucide-react). La voce è espandibile e contiene tre sotto-link:

- **Candidature** → `/admin/storico/candidature`
- **Residenti** → `/admin/storico/residenti`
- **Camere** → `/admin/storico/camere`

Implementazione: uso `Collapsible` di shadcn (già disponibile) dentro un `SidebarMenuItem`, con `SidebarMenuSub` / `SidebarMenuSubItem` / `SidebarMenuSubButton` per i figli. Il gruppo resta aperto automaticamente se la rotta corrente inizia con `/admin/storico`. In modalità sidebar collassata, click sull'icona porta direttamente a `/admin/storico` (indice).

### 2. Routing

In `src/App.tsx`, dentro `<Route path="/admin">`, aggiungo:

```tsx
<Route path="storico" element={<StoricoLayout />}>
  <Route index element={<Navigate to="candidature" replace />} />
  <Route path="candidature" element={<StoricoCandidature />} />
  <Route path="residenti" element={<StoricoResidenti />} />
  <Route path="camere" element={<StoricoCamere />} />
</Route>
```

`StoricoLayout` è un semplice wrapper con header "Storico" + tabs orizzontali (oltre alla sidebar) per navigare tra i tre registri quando l'utente è già in sezione.

### 3. Pagine Storico (3 nuovi file in `src/pages/admin/storico/`)

Tutte e tre seguono lo stesso pattern già usato in Candidature/Residenti: tabella con sorting, paginazione, ricerca, filtri data-range, export-locale opzionale. Niente azioni di modifica — la sezione è **read-only**, di sola consultazione storica.

#### a) `StoricoCandidature.tsx`
Fonte dati: `log_stato_candidature` joinato con `candidature` + `studenti`.
Colonne: data, studente, transizione (`stato_precedente → stato_nuovo`), cambiato_da (admin email risolta via `auth.users` se possibile, altrimenti uuid abbreviato), note.
Filtri: range date, stato di destinazione, ricerca per nome/cognome studente.

#### b) `StoricoResidenti.tsx`
Fonte dati: `assegnazioni` con `stato IN ('conclusa', 'trasferita')` (cioè non `attiva`), join `studenti` + `camere` + `strutture`.
Colonne: studente, struttura/camera/posto, data inizio, data fine, durata (giorni), motivo (da `note` o `stato`).
Filtri: range data fine, struttura, ricerca studente.

#### c) `StoricoCamere.tsx`
Registro storico delle camere = aggregazione per camera di tutte le `assegnazioni` (attive + concluse) cronologicamente.
Vista a due livelli:
- **Lista camere** (struttura, numero, piano, tipo) con conteggio assegnazioni totali e attuali.
- Click su una riga → dialog/drawer con la **timeline** di quella camera: tutte le assegnazioni ordinate per `data_inizio`, con studente, periodo, stato.
Filtri: struttura, tipo camera, ricerca per numero.

### 4. Dettagli tecnici

- Nuovo file `src/pages/admin/storico/StoricoLayout.tsx` con tabs (`Tabs` shadcn) sincronizzati al pathname.
- Riuso di componenti già esistenti: `Card`, `Table`, `Badge`, `Input`, `Select`, paginazione esistente in Candidature/Residenti (estraibile più avanti se serve, per ora copia-coerente).
- Query con `@tanstack/react-query`, chiavi `['storico-candidature', filters]` ecc.
- Nessuna modifica DB necessaria: i dati storici esistono già (`log_stato_candidature`, `assegnazioni` con stati non-attiva).
- Animazioni `motion.div` di entrata coerenti con Dashboard.

### File toccati

1. `src/components/admin/AdminSidebar.tsx` — nuova voce "Storico" con sub-menu
2. `src/App.tsx` — nuove rotte annidate
3. `src/pages/admin/storico/StoricoLayout.tsx` *(nuovo)*
4. `src/pages/admin/storico/StoricoCandidature.tsx` *(nuovo)*
5. `src/pages/admin/storico/StoricoResidenti.tsx` *(nuovo)*
6. `src/pages/admin/storico/StoricoCamere.tsx` *(nuovo)*

