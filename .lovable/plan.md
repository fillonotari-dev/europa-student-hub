

## Piano: "Residenti" UI + Gestione fine assegnazioni

### 1. Rinominare tab "Studenti" → "Residenti" (solo UI)

- **`src/components/admin/AdminSidebar.tsx`** — label "Studenti" → "Residenti", URL `/admin/residenti`
- **`src/App.tsx`** — route `studenti` → `residenti`
- **`src/pages/admin/Studenti.tsx`** — rinominare file in `Residenti.tsx`:
  - Titolo "Residenti", sottotitolo "Studenti con assegnazione attiva"
  - Query: join `assegnazioni` (stato = 'attiva') con `studenti` e `camere`, mostrare solo studenti con assegnazione
  - Colonne: Nome, Email, Nazionalità, Camera (numero), Struttura
  - Mantenere ricerca e stile tabella esistente

### 2. Gestione fine assegnazioni in Camere

**File: `src/pages/admin/Camere.tsx`**

Nel dialog camera con occupanti attivi:
- Mostrare lista occupanti con pulsante "Concludi assegnazione"
- `AlertDialog` di conferma prima di procedere
- Mutation `concludiAssegnazione`:
  - UPDATE `assegnazioni` SET `stato = 'conclusa'`, `data_fine = today`
  - Contare assegnazioni attive rimaste nella camera
  - UPDATE `camere.stato`: 0 rimaste → `libera`, < posti → `parzialmente_occupata`
- Invalidare queries: `camere`, `assegnazioni-attive`, `dashboard-stats`

### File da modificare
1. `src/components/admin/AdminSidebar.tsx`
2. `src/App.tsx`
3. `src/pages/admin/Studenti.tsx` → rinominare/riscrivere come `Residenti.tsx`
4. `src/pages/admin/Camere.tsx`

