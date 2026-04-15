

## Piano modifiche design

Tre problemi segnalati dallo screenshot:

### 1. Focus ring troppo invadente sui form elements

**Problema**: `focus:ring-2 focus:ring-ring focus:ring-offset-2` crea un anello spesso navy che copre le label adiacenti.

**Soluzione**: Ridurre a `focus:ring-1` e rimuovere `ring-offset-2` su `Input`, `SelectTrigger`, e `Textarea`. Questo darà un bordo sottile senza overflow sugli elementi vicini.

File coinvolti:
- `src/components/ui/input.tsx` — cambiare `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` → `focus-visible:ring-1 focus-visible:ring-ring`
- `src/components/ui/select.tsx` — stesso cambio su `SelectTrigger`
- `src/components/ui/textarea.tsx` — stesso cambio

### 2. Hover sidebar su elemento attivo non leggibile

**Problema**: L'item attivo ha sfondo navy con testo bianco, ma l'hover generico (`hover:bg-muted`) sovrascrive il colore rendendo il testo illeggibile.

**Soluzione**: In `AdminSidebar.tsx`, l'`activeClassName` già usa `hover:bg-primary/90` che è corretto. Verificare che il `NavLink` applichi correttamente la classe attiva sovrascrivendo l'hover di default. Se necessario, aggiungere priorità con `hover:text-primary-foreground` sulla classe attiva.

File: `src/components/admin/AdminSidebar.tsx`

### 3. Tabelle poco curate

**Problema**: La tabella candidature appare piatta e poco strutturata visivamente.

**Soluzione**:
- Aggiungere bordi interni più definiti alle righe (`border-b border-border/30`)
- Aumentare leggermente il padding delle celle
- Migliorare il contrasto dell'header con `bg-muted/70` e `text-xs uppercase tracking-wider`
- Aggiungere `font-medium` al testo principale nelle celle

File: `src/pages/admin/Candidature.tsx` (e pattern analogo su `Studenti.tsx`, `Camere.tsx`)

### Riepilogo file da modificare
1. `src/components/ui/input.tsx`
2. `src/components/ui/select.tsx`
3. `src/components/ui/textarea.tsx`
4. `src/components/admin/AdminSidebar.tsx`
5. `src/pages/admin/Candidature.tsx`
6. `src/pages/admin/Studenti.tsx`
7. `src/pages/admin/Camere.tsx`

