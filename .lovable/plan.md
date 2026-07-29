## 1. Tabella `public.impostazioni`

Migrazione singola con la SQL fornita più:
- `GRANT SELECT, INSERT, UPDATE ON public.impostazioni TO authenticated` e `GRANT ALL ... TO service_role` (nessun grant ad `anon`).
- Trigger `BEFORE UPDATE ... EXECUTE FUNCTION public.update_updated_at_column()`.
- `ENABLE ROW LEVEL SECURITY` + una sola policy `impostazioni_admin_all FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (...)`.
- Riga iniziale via `INSERT ... (id, notifica_email) VALUES (1, 'studentatoeuropa@gmail.com')` nella stessa migrazione (dato di bootstrap, non un vero seed operativo).

## 2. Pagina `/admin/impostazioni`

- Nuova voce in `AdminSidebar.tsx` (icona `Settings`).
- Rotta in `App.tsx` dentro `<AdminLayout>` (già protetta dal check ruolo admin).
- File `src/pages/admin/Impostazioni.tsx`: fetch riga id=1 via client Supabase, form singola card, nessun `<h1>` (titolo lo mostra `AdminTopBar` come le altre pagine — aggiungere entry in `usePageTitle`).
- Campi: `contatto_email`, `contatto_telefono`, `contatto_whatsapp`, `contatto_orari`, `notifica_email`. Validazione zod: `EMAIL_RE` per le due email, telefono/whatsapp regex permissiva (`^[+\d][\d\s().\-]{4,30}$`).
- Sotto/accanto a `notifica_email`: box `Alert` con testo "Se questo indirizzo marca le notifiche come spam o si disiscrive, gli invii si interrompono senza segnalazione: usa una casella monitorata."
- Salvataggio con `upsert({ id: 1, ... })`; toast di conferma.

## 3. Modulo condiviso `supabase/functions/_shared/contatti.ts`

```
export const CONTATTI_DEFAULT = {
  contatto_email: 'info@studentatoeuropa.it',
  contatto_telefono: '',
  contatto_whatsapp: '',
  contatto_orari: '',
  notifica_email: 'studentatoeuropa@gmail.com',
}
export type Contatti = typeof CONTATTI_DEFAULT
export async function getContatti(supabase): Promise<Contatti>
```

Fallback per campo (merge `{ ...DEFAULT, ...row }` con normalizzazione dei vuoti a `''`). Su errore/eccezione: `console.error` e ritorno `CONTATTI_DEFAULT`. Mai throw.

## 4. Aggiornare i 4 template candidato

`candidatura-ricevuta.tsx`, `candidatura-link-completamento.tsx`, `candidatura-esito-approvata.tsx`, `candidatura-esito-rifiutata.tsx`:

- Props estese con `contatti?: Partial<Contatti>`.
- Nuovo blocco `<Section>` prima del footer con `<Hr />` + titolo ("Contatti" / "Get in touch") + righe condizionali: mostra la riga solo se il valore è non vuoto. Etichette IT/EN: Email, Telefono/Phone, WhatsApp, Orari/Hours.
- WhatsApp reso come `<Link href="https://wa.me/{numero pulito da non-cifre}">`.
- `candidatura-ricevuta.tsx` footer riscritto: IT "Per qualsiasi domanda scrivi a {email} o chiama {telefono}." con fallback grazioso se manca un canale; EN equivalente. Se contatti tutti vuoti, footer torna al testo attuale.
- I template Auth (signup/invite/magic-link/recovery/reauthentication/email-change) NON vengono toccati.

## 5. Due template admin

`supabase/functions/_shared/email-templates/candidatura-nuova-admin.tsx` e `candidatura-completata-admin.tsx`, solo IT, stessi stili (`#003b6b`, `main`, `container`, `text`).

Props: `nome, cognome, sedePreferita?, tipoCamera?, periodoInizio, periodoFine, dataInvioIso, studenteId, appBaseUrl` (default `https://app.studentatoeuropa.it`).

Contenuto:
- Titolo: "Nuova candidatura" / "Candidatura completata".
- Righe: Nome e cognome, Sede preferita (`sedePreferita || 'nessuna preferenza'`), Tipo camera (`|| '—'`), Periodo (`{inizio} → {fine}` formattati it-IT), Data invio.
- Bottone/Link a `${appBaseUrl}/admin/studenti/${studenteId}` con label "Apri scheda nel gestionale".
- `candidatura-completata-admin`: frase esplicita "La candidatura è ora completa e pronta per la decisione."
- Nessun CF, indirizzo, numero documento, allegati o link ai file.

Oggetti: `Nuova candidatura — ${nome} ${cognome}` e `Candidatura completata — ${nome} ${cognome}`.

## 6. Accodamenti

**`submit-candidatura/index.ts`** — dopo il blocco `enqueueTransactional(CandidaturaRicevutaEmail)` (righe 349-363):

1. Recuperare `getContatti(supabase)` (una sola volta, riusare per il candidato: passare `contatti` alle props di `CandidaturaRicevutaEmail` — piccola estensione del blocco esistente).
2. Recuperare `struttura_preferita.nome` con `select('nome').eq('id', struttura_preferita_id).maybeSingle()` (già validato UUID sopra).
3. `try { enqueueTransactional({ component: CandidaturaNuovaAdminEmail, props: { nome: vNome, cognome: vCognome, sedePreferita, tipoCamera: vTipoCamera, periodoInizio, periodoFine, dataInvioIso: new Date().toISOString(), studenteId }, subject: ..., to: contatti.notifica_email, label: 'candidatura-nuova-admin' }) } catch { log }`.
4. `idempotencyKey` gestito internamente da `enqueueTransactional` via `messageId`; nessuna costruzione manuale del payload.

**`complete-candidatura/index.ts`** — dopo l'`update` della candidatura e l'insert nel `log_stato_candidature`:

Stesso pattern con `CandidaturaCompletataAdminEmail`, `studenteId = cand.studente_id`, `to: contatti.notifica_email`, label `candidatura-completata-admin`. Inoltre, se il template esito già inviato al candidato può includere `contatti`, aggiornare anche le chiamate ai template esito e link-completamento (`send-esito-email` e `generate-completion-link`) per passare `contatti`.

Entrambi i punti: `try/catch` che logga e prosegue; il fallimento non annulla la candidatura.

## 7. Verifica cron (nessuna modifica)

Dopo il deploy, un accodamento di prova (invocare `submit-candidatura` in dev o `SELECT public.enqueue_email('transactional_emails', '{}'::jsonb)`) e poi:

```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'process-email-queue';
```

Attesa: una riga con `schedule='5 seconds'`, `active=true`. A coda svuotata il job si disarma da solo. Riporto l'esito.

## 8. Disiscrizione sulle notifiche interne — analisi

Letto `process-email-queue/index.ts` e `_shared/enqueue-transactional.ts`. Risposte:

1. **Omissione del link/header per messaggio**: no, non è controllabile dal nostro codice. `sendLovableEmail` riceve `unsubscribe_token` come parametro obbligatorio (bug storico "missing_unsubscribe" citato nei commenti di `enqueue-transactional.ts`). Header `List-Unsubscribe` e footer sono aggiunti dall'API Lovable server-side a partire dal token: non abbiamo un flag per sopprimerli su singolo messaggio.
2. **Controllo `suppressed_emails`**: non avviene nella nostra edge (né in `enqueue-transactional`, né in `process-email-queue`). Viene applicato dentro l'API Lovable in fase di invio, quindi non è aggirabile marcando il messaggio "interno" — l'unico modo per bypassarlo dal nostro lato sarebbe non chiamare quell'API.
3. **Modifica minima**: nessuna delle due strade è percorribile mantenendo `enqueueTransactional` come è oggi. Le opzioni realistiche sono tre, in ordine di rischio:
   - **(a)** Lasciare il flusso attuale e istruire il destinatario delle notifiche a non usare "Annulla iscrizione" (fragile: un tocco accidentale spegne tutto in silenzio).
   - **(b)** Consegnare le notifiche interne fuori dalla coda transazionale: nuovo canale (es. edge dedicata che chiama un provider diverso, oppure webhook / Slack). Richiede un nuovo secret e un secondo percorso di invio, ma è l'unico modo per togliere davvero il link di disiscrizione.
   - **(c)** Se in futuro la libreria `@lovable.dev/email-js` esporrà un flag `internal`/`skip_unsubscribe`, aggiungere `internal?: boolean` a `EnqueueArgs` e propagarlo — oggi non esiste.

Raccomandazione da confermare prima di procedere: adottare (b) per le due notifiche admin, mantenendo (a) come temporanea. Non implemento nulla su questo punto finché non decidi.

## Fuori scope

- Nessuna modifica ai template Auth.
- Nessuna modifica a `process-email-queue`, a `email_queue_wake`/`dispatch`, o al cron.
- Nessuna nuova rotta candidatura (la scheda persona resta l'unico target del link admin).
