# Design System — Studentato Europa Gestionale

Documento di riferimento per il design del gestionale. Ogni nuovo componente, pagina o documento di sistema deve seguire queste indicazioni per garantire coerenza visiva e di esperienza.

---

## 1. Principi guida

- **Minimal & funzionale**: interfaccia chiara, densità informativa controllata, nessun ornamento superfluo.
- **Coerenza tramite token**: nessun colore o dimensione hard-coded nei componenti — sempre token semantici da `index.css` / `tailwind.config.ts`.
- **Gerarchia tipografica leggibile**: titoli compatti, body 13-14px, micro-label 11px.
- **Feedback immediato**: ogni azione ha toast di conferma o errore, ogni stato distruttivo ha conferma `AlertDialog`.
- **Accessibilità**: contrasto sufficiente in light mode, tasti `sr-only` su icone interattive, focus ring sempre visibile (`--ring`).

---

## 2. Token di colore (HSL)

Tutti i colori sono dichiarati come variabili CSS in `src/index.css` e mappati in Tailwind. **Mai usare classi tipo `text-white`, `bg-blue-500`** — usare i token semantici.

### Palette base

| Token | HSL | Uso |
|-------|-----|-----|
| `--background` | `0 0% 98%` | Sfondo principale dell'app |
| `--foreground` | `0 0% 10%` | Testo principale |
| `--card` | `0 0% 100%` | Sfondo card, dialog, popover |
| `--card-foreground` | `0 0% 10%` | Testo su card |
| `--popover` | `0 0% 100%` | Sfondo popover, dropdown |
| `--muted` | `0 0% 96%` | Sfondi neutri secondari (header tabella, badge spenti) |
| `--muted-foreground` | `0 0% 45%` | Testo secondario, label, metadata |
| `--border` | `0 0% 90%` | Bordi divisori, separatori |
| `--input` | `0 0% 90%` | Bordo input |
| `--ring` | `208 100% 21%` | Focus ring |
| `--radius` | `0.75rem` | Raggio standard (lg) |

### Palette semantica

| Token | HSL | Uso |
|-------|-----|-----|
| `--primary` | `208 100% 21%` (blu navy) | Azioni primarie, link attivi sidebar, brand |
| `--primary-foreground` | `0 0% 100%` | Testo su sfondo primary |
| `--secondary` | `210 40% 96.1%` | Pulsanti secondari |
| `--accent` | `40 80% 61%` (oro) | Accenti decorativi, evidenziazioni |
| `--success` | `142 71% 45%` (verde) | Stati positivi: approvato, libera, attivo |
| `--warning` | `38 92% 50%` (arancio) | Stati di attenzione: in valutazione, parz. occupata |
| `--destructive` | `0 84% 60%` (rosso) | Azioni distruttive, errori, rifiutato, occupata |

### Pattern di stato (badge, pillole)

Per gli stati di dominio si usa la combinazione `bg-{color}/10 text-{color}` (sfondo trasparente + testo pieno):

```tsx
// candidature
ricevuta:        'bg-primary/10 text-primary'
in_valutazione:  'bg-warning/10 text-warning'
approvata:       'bg-success/10 text-success'
rifiutata:       'bg-destructive/10 text-destructive'
ritirata:        'bg-muted text-muted-foreground'

// camere
libera:                 'bg-success/10 text-success border-success/30'
parzialmente_occupata:  'bg-warning/10 text-warning border-warning/30'
occupata:               'bg-destructive/10 text-destructive border-destructive/30'
manutenzione:           'bg-muted text-muted-foreground border-border'
```

### Sidebar (token dedicati)

Sidebar ha la propria sotto-palette: `--sidebar-background`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-border`, `--sidebar-ring`. Sfondo bianco puro per separarla otticamente dall'area contenuti (grigio 98%).

---

## 3. Tipografia

- **Font**: `Plus Jakarta Sans` (Google Fonts), pesi 400/500/600/700/800. Fallback: `system-ui, sans-serif`.
- Importata in `index.css`, applicata via `font-sans` di Tailwind.

### Scala

| Uso | Classe Tailwind | Note |
|-----|-----------------|------|
| H1 pagina | `text-xl font-bold tracking-tight` | Titolo sezione admin (es. "Candidature") |
| H2 / titolo card | `text-sm font-semibold` o `text-base font-semibold` | |
| Body | `text-sm` (14px) | Contenuto tabelle, form |
| Sottotitolo / descrizione | `text-[13px] text-muted-foreground` | Sotto i titoli H1 |
| Micro / metadata | `text-[11px] text-muted-foreground` | Email sotto nome, label badge |
| Header tabella | `text-xs uppercase tracking-wider text-muted-foreground` | |
| Numeri tabellari | aggiungere `tabular-nums` | Per allineamento colonne |

---

## 4. Spaziatura, layout e radius

- **Padding pagina admin**: `p-6` (24px) in `<main>`.
- **Spaziatura verticale tra sezioni**: `space-y-6`.
- **Spaziatura interna a card/form**: `space-y-4`.
- **Gap toolbar**: `gap-3 flex-wrap`.
- **Padding cella tabella**: `px-4 py-3`.
- **Header app interno**: `h-14`, sfondo `bg-card/80 backdrop-blur-sm`, bordo inferiore.
- **Radius standard**: `rounded-lg` (= `--radius` 0.75rem). `rounded-md` per elementi compatti (badge, input piccoli), `rounded-full` solo per pillole di stato.
- **Container max-width**: 1400px (`2xl`), centrato con `padding: 2rem`.
- **Bordi sottili**: `border border-border/50` su card e contenitori secondari per ridurre il rumore visivo.

---

## 5. Componenti UI (shadcn/ui)

Base: tutti i componenti partono da **shadcn/ui** già installato in `src/components/ui/`. Estendere via `cva` se servono varianti, **mai** riscriverli da zero.

### Pulsanti (`Button`)

| Variante | Quando |
|----------|--------|
| `default` | Azione primaria della view (Salva, Approva, Conferma) |
| `outline` | Azioni secondarie, export, filtri |
| `ghost` | Azioni terziarie inline (icon button in tabella, trigger menu) |
| `destructive` | Eliminazione, rifiuto, conclusione soggiorno |
| `link` | Solo se serve aspetto testuale |

Dimensioni: `size="sm"` di default nelle toolbar admin; `size="icon"` per pulsanti con sola icona (es. RowActions trigger).

### Card e contenitori

- Card semplice: `bg-card border border-border/50 rounded-lg`.
- Card con padding standard: `<Card className="p-4">` (componente shadcn).
- Tabelle: contenitore `border rounded-lg overflow-hidden`, header `bg-muted/70` o `bg-muted/50`, righe con `border-b border-border/30 hover:bg-muted/50 transition-colors`.

### Form

- Input, Select, Textarea sempre da shadcn (`@/components/ui/...`).
- Label sempre presente sopra il campo (`<Label>`).
- Search input pattern: icona `Search` lucide assoluta a sinistra (`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`) + `pl-9` sull'input.
- Date picker: `<Input type="date">` (no datepicker custom).

### Dialog vs AlertDialog

- **`Dialog`**: dettagli, form di creazione/modifica. `max-w-lg` o `max-w-2xl`, `max-h-[85vh] overflow-y-auto` se contenuto lungo.
- **`AlertDialog`**: SOLO conferme di azioni distruttive o irreversibili (elimina, rifiuta definitivamente, concludi soggiorno).

### Dropdown / azioni di riga

- Pattern unico via `RowActions` (`src/components/admin/RowActions.tsx`): trigger `MoreHorizontal` ghost, dropdown con `align="end"`, larghezza `w-56`.
- Azioni distruttive nel menu: `className="text-destructive focus:text-destructive"` + separator sopra.
- Sezioni del menu separate con `DropdownMenuSeparator` e introdotte da `DropdownMenuLabel` quando opportuno.

### Badge

- Stati di dominio: `<span>` con classi `text-[11px] font-medium px-2 py-0.5 rounded-full ${STATO_COLORS[stato]}`.
- In alternativa `<Badge variant="outline">` con classi colore semantiche per stati delle camere.

### Pulsante export

Componente unico `ExportButton` (`@/components/admin/ExportButton`) — `variant="outline"`, `size="sm"`, icona `Download`, label "Esporta Excel". Posizionato a destra nella toolbar di filtri della pagina. Esporta la **vista corrente filtrata**, non l'intero dataset.

### Sidebar admin

- Voci principali: icona lucide `mr-2 h-4 w-4` + label.
- Stato attivo: `bg-primary text-primary-foreground hover:bg-primary/90`.
- Stato inattivo: `hover:bg-muted`.
- Sotto-menu (Storico): `Collapsible` con chevron `ml-auto` e rotazione `data-[state=open]:rotate-180`.
- Modalità collassata: solo icona, label nascosta condizionatamente con `{!collapsed && <span>…</span>}`.

---

## 6. Iconografia

- Libreria unica: **`lucide-react`**. Mai mescolare con altre librerie di icone.
- Dimensioni standard: `w-4 h-4` (16px) inline nei pulsanti e menu, `w-3.5 h-3.5` per dettagli inline al testo, `w-5 h-5` in card decorative, `w-8 h-8` in empty state.
- Colore: ereditato dal contesto (`currentColor`); usare `text-muted-foreground` per icone decorative non interattive.
- Margine standard accanto al testo: `mr-1` (compatto) o `mr-2` (menu).

### Icone ricorrenti

| Concetto | Icona |
|----------|-------|
| Home / dashboard | `LayoutDashboard` |
| Candidature | `FileText` |
| Residenti / studenti | `Users`, `User` |
| Camere | `DoorOpen` |
| Storico | `History` |
| Export / download | `Download` |
| Logout | `LogOut` |
| Conferma | `CheckCircle2` |
| Rifiuta / chiudi | `XCircle`, `X` |
| Elimina | `Trash2` |
| Modifica | `Pencil` |
| Manutenzione | `Wrench` |
| Trasferimento | `ArrowRightLeft` |
| Email | `Mail` |
| Cerca | `Search` |
| Aggiungi | `Plus` |
| Sort | `ArrowUp`, `ArrowDown`, `ArrowUpDown` |
| Menu azioni | `MoreHorizontal` |

---

## 7. Animazioni

- Libreria: **`framer-motion`** per micro-interazioni significative; `tailwindcss-animate` per accordion / collapsible.
- **Entrata pagina/sezione**: `motion.div` con `initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}`.
- **Righe tabella in sequenza**: `initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}` (cap a `0.3s` per liste lunghe).
- Transizioni hover/focus: `transition-colors` sui background interattivi.
- **Niente animazioni su elementi critici** (pulsanti di submit, conferme): la risposta deve essere immediata.

---

## 8. Pattern di pagina admin

Struttura standard di una pagina sotto `/admin`:

```
<div className="space-y-6">
  {/* 1. Header */}
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-xl font-bold tracking-tight">Titolo</h1>
      <p className="text-[13px] text-muted-foreground">Descrizione breve</p>
    </div>
    <div className="flex items-center gap-2">
      {/* azioni primarie + ExportButton */}
    </div>
  </div>

  {/* 2. Toolbar filtri */}
  <div className="flex gap-3 flex-wrap">
    <Input search... />
    <Select filtri... />
  </div>

  {/* 3. Contenitore dati */}
  <div className="bg-card border border-border/50 rounded-lg overflow-hidden">
    <table>...</table>
  </div>

  {/* 4. Paginazione + counter */}
  <div className="flex items-center justify-between text-[13px] text-muted-foreground">
    <span>1–15 di N</span>
    <Pagination>...</Pagination>
  </div>

  {/* 5. Dialog/AlertDialog fuori dal flusso */}
</div>
```

### Empty state

```tsx
<div className="py-12 text-center">
  <Icon className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
  <p className="text-[13px] text-muted-foreground">Nessun elemento trovato</p>
</div>
```

### Tabelle

- Header: `bg-muted/70`, `text-xs uppercase tracking-wider text-muted-foreground`, padding `px-4 py-3 font-semibold`.
- Sort header tramite componente locale `SortHeader` con icona `ArrowUp/Down/UpDown` (vedi `Candidature.tsx`, `Residenti.tsx`).
- Riga: `border-b border-border/30 hover:bg-muted/50 cursor-pointer transition-colors` (cursor-pointer solo se la riga apre dettaglio).
- Colonna azioni sempre `text-right`, `<RowActions>` con `e.stopPropagation()` per non innescare il click sulla riga.
- Paginazione fissa a `PAGE_SIZE = 15` (pagine normali) o `20` (storico).

---

## 9. Feedback utente

- **Toast** (`useToast` da `@/hooks/use-toast`): conferme positive senza `variant`, errori con `variant: 'destructive'`. Titolo conciso, descrizione opzionale.
- **AlertDialog**: conferme distruttive con titolo chiaro e descrizione che spiega le conseguenze.
- **Loading**: testo semplice `<p className="text-muted-foreground">Caricamento...</p>`. Non bloccare l'UI con spinner full-screen oltre l'auth gate.
- **Stato vuoto**: sempre presente con icona dimmed e messaggio in italiano.

---

## 10. Lingua e tono

- **Lingua interfaccia**: italiano. I nomi dei prodotti (Lovable Cloud, Supabase, GitHub) restano in inglese.
- **Tono**: professionale, diretto, niente emoji nell'UI.
- **Date**: formattate `it-IT` con `toLocaleDateString('it-IT')` o helper `fmtDate` / `fmtDateTime` in `src/lib/exportXlsx.ts`.
- **Etichette**: forma breve, prima maiuscola (es. "Nuova camera", "Esporta Excel", "Concludi soggiorno"). Verbo all'infinito per CTA, sostantivo per voci di menu.
- **Stati di dominio**: usare `STATO_LABELS` centralizzati per la traduzione tecnica → user-facing.

---

## 11. Regole inderogabili

1. **Mai colori hard-coded** (`text-white`, `bg-[#fff]`, `text-blue-500`). Solo token semantici.
2. **Mai font-family custom inline**. Solo `font-sans` (= Plus Jakarta Sans).
3. **Mai modificare `src/components/ui/*`** se non per aggiungere varianti tramite `cva`.
4. **Mai usare librerie di icone diverse da `lucide-react`**.
5. **Mai bypassare `AlertDialog`** per azioni distruttive (delete, conclusione soggiorno, rifiuto).
6. **Mai duplicare logica di export**: usare `ExportButton` + `exportToXlsx`.
7. **Mai duplicare azioni di riga**: usare `RowActions`.
8. **Sempre `motion.div` con la stessa firma** (`opacity: 0, y: 8 → 1, 0`) per coerenza di entrata.
9. **Sempre toast** dopo mutazioni (success/error).
10. **Sempre `tabular-nums`** sui numeri allineati in colonna.

---

## 12. File di riferimento nel codebase

| File | Cosa contiene |
|------|---------------|
| `src/index.css` | Definizione token CSS (colori, radius, sidebar) |
| `tailwind.config.ts` | Mappatura token → classi Tailwind, font, container |
| `src/components/ui/*` | Componenti shadcn (non modificare direttamente) |
| `src/components/admin/AdminSidebar.tsx` | Pattern sidebar + sotto-menu collapsible |
| `src/components/admin/RowActions.tsx` | Pattern azioni di riga |
| `src/components/admin/ExportButton.tsx` | Pattern pulsante export |
| `src/lib/exportXlsx.ts` | Helper export + formattazione date |
| `src/pages/admin/Candidature.tsx` | Riferimento pagina admin completa (toolbar, tabella, sort, paginazione, dialog) |
| `src/pages/admin/AdminLayout.tsx` | Layout base con sidebar + header sticky |

---

_Ultimo aggiornamento: questo documento va aggiornato ogni volta che si introduce un nuovo pattern UI riusabile, un nuovo token semantico o si modifica la palette._