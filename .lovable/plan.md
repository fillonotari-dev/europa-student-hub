Rifacimento della **disposizione visiva** di `src/pages/admin/StudentePage.tsx`. Nessun cambio a query, dati salvati, azioni disponibili, validazioni o design tokens. Modifiche solo a JSX, wrapping, classi Tailwind e a un componente ausiliario per il menu azioni.

## 1. Intestazione (non è una card)

Sostituire la card di testa con un blocco piatto:

- Riga: a sinistra `h1` `text-2xl font-semibold` con `Nome Cognome`; a destra l'area azioni (vedi §8).
- Sotto il nome, sulla riga successiva, il badge stadio (usa `STADIO_COLORS[stadio]` con classi già esistenti).
- Chiudere l'intestazione con `border-b border-border/60 pb-4` — nessun `bg-card` né `rounded-lg` attorno.

## 2. Fascia Soggiorno (banda, non card)

Solo se `attive.length > 0`. Per ogni assegnazione attiva:

- Contenitore `bg-muted/40 rounded-lg px-5 py-4` (no border).
- Riga unica separata da ` · `:  
  `struttura · Camera N · posto P · dataInizio → dataFine · statoTemporale`  
  (`statoTemporale` = "Non ancora iniziato" se `futura`, "In corso" se `in_corso`).
- Se `compagniPerAssegnazione.get(a.id)` ha elementi, seconda riga `text-[13px] text-muted-foreground`: "Con <Link>Nome Cognome</Link>" (link a `/admin/studenti/<id>`).
- Più assegnazioni attive → più bande impilate `space-y-2`.
- I soggiorni **conclusi** vengono **rimossi da qui** e spostati in fondo (§5).

## 3. Informazioni personali — full width, 3 colonne

Card `bg-card border border-border/50 rounded-lg p-5`, larghezza piena.
- Titolo sezione + pulsante Modifica/Salva/Annulla (invariati nella logica).
- Griglia `grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5`.
- Ogni coppia: `<div class="text-[11px] uppercase tracking-wide text-muted-foreground">Label</div><div class="text-sm">Valore</div>`.
- Indirizzo in lettura resta riga composta unica (`nomeIndirizzoCompatto`), occupa una cella della griglia (`md:col-span-2` se serve respiro).
- Etichetta "Residenza fiscale" → **"Residenza"**.
- In modalità edit, i campi già presenti restano invariati ma disposti in `md:grid-cols-3` con gli stessi gap.

## 4. Quattro sezioni dati — 2×2, allineate in alto

Wrapper `grid grid-cols-1 md:grid-cols-2 gap-6 items-start` (due volte, o unico wrapper con 4 card):

- Riga 1: Dati accademici | Preferenze
- Riga 2: Caratteristiche | Garante

Ogni card: `bg-card border border-border/50 rounded-lg p-5`. `items-start` è obbligatorio (fix del problema di stiramento).

## 5. Cronologia | Note (2 col) + Soggiorni conclusi (full width)

Wrapper `grid grid-cols-1 md:grid-cols-2 gap-6 items-start`:

- **Cronologia** (sinistra, card `p-5`): mostra al massimo le **ultime 5** righe di `log` (ordinate ascendenti → prendere `slice(-5)`). Sotto, pulsante "Mostra tutto" che espande il resto (stato locale `showAllLog`). Righe evento (stato_precedente == stato_nuovo): testo = `l.note` (fallback "Evento" solo se nota vuota). Righe transizione: come oggi con `formatStatoCandidatura`.
- **Note admin** (destra, card `p-5`): mostrare sempre l'area di testo, anche se vuota (già così, verificare).

Sotto, **full width**, elenco compatto **Soggiorni conclusi** — solo se `concluse.length > 0`. Una riga per soggiorno: `struttura · Camera N · dataInizio → dataFine · motivoChiusura`.

## 6. Respiro globale

Wrapper pagina: `space-y-6`. Rimuovere `p-4` residui dalle card e usare `p-5` ovunque. `gap-6` fra card affiancate.

## 7. Campi vuoti non si rendono

Introdurre helper locale `Field({ label, value })` che ritorna `null` se `value` è falsy/stringa vuota. Applicare a Informazioni personali (lettura), Dati accademici, Preferenze, Caratteristiche, Garante. Se dopo il filtro una card non ha campi renderizzati, mostrare una sola riga `text-[13px] text-muted-foreground`: "Non ancora compilato". In modalità edit, tutti i campi tornano visibili.

## 8. Azioni — un pulsante pieno + menu "Azioni"

Nuovo componente locale (o piccolo adattamento a `CandidaturaActions`): usare `getAvailableActions` come oggi, ma renderizzare:

- La prima azione con `group === 'principale'` come `Button` pieno (variant `default`).
- Tutte le restanti (incluse le pericolose) dentro un `DropdownMenu` con trigger `<Button variant="outline">Azioni <ChevronDown /></Button>`. Le pericolose mantengono `text-destructive` e restano separate da `DropdownMenuSeparator`.

Implementazione: aggiungere un terzo helper in `src/components/admin/CandidaturaActions.tsx` (`PrimaryWithMenu`) oppure comporre inline in `StudentePage.tsx` usando `useCandidaturaActionsCtx` + `getAvailableActions`. Preferire il nuovo helper riutilizzabile.

## 9. Cronologia — testo eventi

Già coperto nella logica di render: quando `stato_precedente === stato_nuovo`, il testo della riga è `l.note`; se `note` è vuota, mostrare "Evento registrato" (mai "Evento su <stato>").

## 10. Etichetta

Sostituire ogni occorrenza di "Residenza fiscale" con "Residenza" nella scheda.

## Responsive

Sotto `md` tutto collassa a colonna unica nell'ordine: Intestazione → Soggiorno → Informazioni → Accademici → Preferenze → Caratteristiche → Garante → Cronologia → Note → Soggiorni conclusi.

## File toccati

- `src/pages/admin/StudentePage.tsx` — riorganizzazione JSX, helper `Field`, stato `showAllLog`, spostamento conclusi in fondo, testi eventi, etichetta "Residenza".
- `src/components/admin/CandidaturaActions.tsx` — aggiunta variante `PrimaryWithMenu` (pulsante pieno + dropdown "Azioni") senza toccare `Menu`/`Buttons` esistenti.

Nessun altro file coinvolto. Nessuna migration. Nessuna modifica a hook, query o azioni.
