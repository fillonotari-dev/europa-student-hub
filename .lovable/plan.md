## Obiettivo

Sdoppiare il processo in due fasi:

1. **Form pubblico "Pre-screening"** su `/candidatura` → blocchi **1 Dati personali**, **2 Percorso universitario**, **3 Preferenze alloggio**, **6 Documenti base**, **7 Dichiarazioni**.
2. **Form esteso "Completamento"** su `/candidatura/completa/:token` → aggiunge **4 Stile di vita**, **5 Contatto emergenza/garante** e versione completa di **6 Documenti** (garante, ulteriori). Inviato manualmente dall'admin solo ai candidati pre-approvati.

Una sola entità `candidature` continua a rappresentare la pratica end-to-end: il completamento arricchisce la stessa riga, non ne crea una nuova.

## Flusso UX

```text
Studente             Sito pubblico            Admin                Studente
   │                       │                    │                     │
   │── compila form base ─▶│                    │                     │
   │                       │── nuova candidatura (stato: ricevuta)    │
   │                       │                    │                     │
   │                       │     admin rivede candidatura             │
   │                       │                    │── "Invia form completo"
   │                       │                    │   genera token + link
   │                       │                    │── email con link ──▶│
   │                       │                                          │
   │                       │◀── apre /candidatura/completa/:token ────│
   │                       │    compila blocchi 4-5 + doc aggiuntivi  │
   │                       │── stato: completata ────────────────────▶│
   │                       │                                          │
   │                       │     admin valuta → accettata/rifiutata   │
```

### Stati candidatura (aggiornati)

`ricevuta` → (admin invia link) → `in_completamento` → (studente compila) → `completata` → `accettata` / `rifiutata` / `ritirata` / `sostituita`.

Le candidature possono anche andare direttamente da `ricevuta` a `rifiutata` se non passano il pre-screening (skip del completamento).

### UI Admin

- Nella tabella **Candidature** (stato `ricevuta`): azione **"Invia form completo"** → genera token, mostra modale con link copiabile e pulsante "Apri client email" (`mailto:` precompilato in italiano/inglese a seconda di `lang_preferita` se disponibile, altrimenti italiano).
- Badge visivo per distinguere candidature `ricevuta` (solo pre-screening) da `completata` (pronte per valutazione).
- Vista dettaglio candidatura: due sezioni separate, "Dati pre-screening" sempre presenti, "Dati completi" mostrate solo se valorizzate, con timestamp di compilazione.
- Azione **"Rigenera link"** se il token è scaduto/perso.

### UI Studente

- `/candidatura` (pubblico): step ridotti — `Personali → Accademico → Preferenze → Documenti base → Dichiarazioni → Revisione`. Schermata di successo aggiornata: "Riceverai una mail se la tua candidatura passa al passo successivo".
- `/candidatura/completa/:token` (link diretto): step → `Stile di vita → Garante → Documenti aggiuntivi → Dichiarazioni → Revisione`. Header mostra "Ciao Mario, completa la tua candidatura". Riusa gli stessi componenti `Field`, upload via edge function già esistente.
- Token scaduto/non valido → schermata d'errore con istruzioni per contattare la direzione.

## Modello dati

### Migrazione 1 — nuovi campi su `candidature`

```text
versione_form         text default 'pre_screening'   -- 'pre_screening' | 'completa'
completata_il         timestamptz null
completamento_token   text null unique               -- 32+ char random, hashato
token_scade_il        timestamptz null
dichiarazioni         jsonb default '{}'             -- block 7 checkboxes
-- block 3 estensioni
data_arrivo_prevista  date null
come_conosciuto       text null                      -- 'instagram'|'google'|...
come_conosciuto_altro text null
preferenze_note       text null                      -- "preferenze o esigenze particolari"
indirizzo_residenza   text null                      -- block 1
documento_identita_n  text null                      -- block 1
tipo_studente         text null                      -- 'universitario'|'erasmus'|'master'|'altro'
tipo_studente_altro   text null
-- block 4
lingue_parlate        text null
orari                 text null                      -- 'mattiniero'|'serale'|'variabile'
personalita           text null
personalita_altro     text null
ordine_pulizia        text null
fumatore              boolean null
presentazione         text null
-- block 5
garante_nome          text null
garante_relazione     text null
garante_telefono      text null
garante_email         text null
```

I campi di blocco 4-5 restano `null` finché lo studente non compila il form completo. Niente check constraint con `now()` — eventuale validazione token via trigger o nella edge function.

### Migrazione 2 — RLS

- `candidature`: aggiungere policy `anon UPDATE` filtrata su `completamento_token = current_setting('request.jwt.claims', true)::jsonb->>'token'` **NO** — meglio gestire tutto via edge function `complete-candidatura` con service role (come già fatto per `submit-candidatura`). Nessuna nuova policy RLS aperta.
- `documenti`: invariate (edge function service-role).

### Migrazione 3 — `form_documenti_custom`

Aggiungere colonna `fase text default 'pre_screening'` (`'pre_screening'` | `'completa'`) per permettere all'admin di decidere in quale fase richiedere ciascun documento custom. Stessa cosa su `form_campi_custom`. Default retro-compatibile.

## Edge functions

### Nuova `generate-completion-link` (auth: admin)

Input: `candidatura_id`. Genera token sicuro (32 byte base64url), salva su `candidature` con scadenza `now() + 14 days`, cambia stato in `in_completamento`, scrive in `log_stato_candidature`. Output: `{ url, scade_il }`.

### Nuova `complete-candidatura` (auth: pubblica, valida via token)

Input: `token`, payload blocchi 4-5 + dichiarazioni + documenti. Validazione: token esiste, non scaduto, stato == `in_completamento`. Aggiorna candidatura, imposta `completata_il`, stato `completata`, scrive log. Stessa validazione strict del payload come `submit-candidatura`.

### Modifica `submit-candidatura`

- Salva solo i campi del form ridotto.
- Stato iniziale resta `ricevuta`.
- `dichiarazioni` (blocco 7) ora obbligatorie anche nel form pubblico.

### Nuova `get-completion-form` (auth: pubblica)

Input: `token`. Restituisce dati minimi per prefill (nome studente, lingua preferita) e validità token. Nessun PII sensibile.

## Frontend — file principali

- `src/pages/Candidatura.tsx` → rimuovere step "Stile di vita"/"Garante" (non presenti oggi, quindi solo aggiungere il nuovo step **Dichiarazioni** prima della revisione). Aggiungere campi blocco 1 extra (indirizzo, doc identità n.) e blocco 3 extra (data arrivo, come conosciuto, preferenze particolari, tipo studente).
- `src/pages/CandidaturaCompleta.tsx` (nuovo) → step blocchi 4, 5, doc aggiuntivi, dichiarazioni se non già firmate, revisione.
- `src/App.tsx` → nuova route `/candidatura/completa/:token`.
- `src/pages/admin/Candidature.tsx` → azione "Invia form completo" + badge stato + link copia/mailto.
- `src/components/admin/CompletionLinkModal.tsx` (nuovo) → modale che mostra link, scadenza, bottone copia, bottone mailto con template IT/EN.
- `src/i18n/translations.ts` → nuove chiavi per i blocchi 4-5-7, mail templates, schermate token.
- `src/pages/admin/ConfigForm.tsx` → selettore "fase" per campi e documenti custom.

## Considerazioni

- **Email**: l'invio è manuale via `mailto:` (no infrastruttura email da configurare ora). Possiamo automatizzarlo dopo con Resend se necessario.
- **Sicurezza token**: salviamo l'hash (sha256) del token, non il valore in chiaro, e mostriamo il valore solo una volta nella modale. Scadenza 14 giorni configurabile.
- **Migrazione dati esistenti**: candidature esistenti rimangono `versione_form='pre_screening'`. Nessun backfill richiesto.
- **Storico/export XLSX**: estendere `exportXlsx.ts` con le nuove colonne (lasciate vuote se non compilate).
- **Dichiarazioni blocco 7**: 4 checkbox obbligatorie sia nel form pubblico (le prime 3 + privacy) sia nel form completo (riconferma con timestamp). Il consenso al contatto può essere chiesto solo nel form completo.

## Cosa NON viene fatto in questa iterazione

- Invio email automatico (resta `mailto:`).
- Firma digitale del PDF generato (rimaniamo su checkbox + dichiarazione con timestamp/IP).
- Rinnovo automatico token scaduti.
