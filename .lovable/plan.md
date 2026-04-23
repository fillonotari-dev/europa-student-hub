

## Piano: Rinominare "Dashboard" in "Home" e aggiungere sezione Task

### 1. Rinomina

- `src/components/admin/AdminSidebar.tsx`: voce di menu `Dashboard` → **`Home`** (rotta invariata `/admin`)
- `src/pages/admin/Dashboard.tsx`: titolo pagina `Dashboard` → **`Home`**, sottotitolo invariato
- File `Dashboard.tsx` non viene rinominato (solo label UI) per evitare modifiche al routing

### 2. Nuova sezione "Task da svolgere"

Posizionata **subito sotto le metriche**, prima del blocco "Occupazione". Card con header `Task da svolgere` e contatore totale.

**Task calcolate** (ognuna con icona, titolo, conteggio, link rapido):

| Task | Condizione query | Link |
|---|---|---|
| Candidature ricevute da prendere in carico | `candidature.stato = 'ricevuta'` | `/admin/candidature?stato=ricevuta` |
| Candidature in valutazione da decidere | `candidature.stato = 'in_valutazione'` | `/admin/candidature?stato=in_valutazione` |
| Candidature approvate da assegnare a una camera | `candidature.stato = 'approvata'` AND nessuna `assegnazioni` attiva collegata | `/admin/candidature?stato=approvata` |
| Camere in manutenzione da riattivare | `camere.stato = 'manutenzione'` | `/admin/camere?stato=manutenzione` |
| Assegnazioni in scadenza nei prossimi 30 giorni | `assegnazioni.stato='attiva'` AND `data_fine` tra oggi e +30gg | `/admin/residenti` |

Ogni task è una riga cliccabile (`Link` da react-router) con:
- Icona colorata a sinistra (warning/primary/destructive a seconda dell'urgenza)
- Titolo + conteggio in badge a destra
- Hover sfondo `muted/50`
- Se il conteggio è 0 → riga nascosta
- Se **tutte** le task sono a 0 → empty state "Nessuna task in sospeso 🎉"

### 3. Implementazione tecnica

In `Dashboard.tsx` aggiungere una nuova `useQuery({ queryKey: ['admin-tasks'] })` che fa in parallelo:

```ts
const [ricevute, valutazione, approvate, manutenzione, assegnazioni] = await Promise.all([
  supabase.from('candidature').select('id', { count: 'exact', head: true }).eq('stato', 'ricevuta'),
  supabase.from('candidature').select('id', { count: 'exact', head: true }).eq('stato', 'in_valutazione'),
  supabase.from('candidature').select('id, assegnazioni!inner(id, stato)').eq('stato', 'approvata'),
  supabase.from('camere').select('id', { count: 'exact', head: true }).eq('stato', 'manutenzione'),
  supabase.from('assegnazioni').select('id, data_fine').eq('stato', 'attiva').not('data_fine', 'is', null).lte('data_fine', date30dFromNow).gte('data_fine', today),
]);
```

Per "approvate da assegnare" si fa una query separata su `candidature` filtrata per stato `approvata` e poi un controllo client-side incrociando con `assegnazioni` attive (via secondo fetch leggero su `assegnazioni.candidatura_id`).

Animazione `motion.div` coerente con le altre card. Componente in linea (no nuovo file): la sezione resta semplice e localizzata alla Home.

### File modificati

1. `src/components/admin/AdminSidebar.tsx` — label `Dashboard` → `Home`
2. `src/pages/admin/Dashboard.tsx` — titolo + nuova sezione task con query e UI

Nessuna modifica a DB, routing o altri file.

