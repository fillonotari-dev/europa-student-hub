# Riallineamento senza job: all'apertura di Fatturazione e dal pulsante

## 1. fic-riallinea solo per admin
- Riporto `supabase/config.toml` a `[functions.fic-riallinea] verify_jwt = true`, come le altre fic-*.
- Nel file `fic-riallinea/index.ts` tolgo:
  - il modo (b): `stessoSegreto` (righe 38-48) e il controllo di `x-riallinea-secret` / `FIC_RIALLINEA_CRON_SECRET` (righe 79-82);
  - il commento in testata che lo descrive.
- Resta solo l'accesso admin con `getClaims` + `has_role`:
  - nessun token: 401;
  - token valido ma non admin: 403.
- `origine` diventa `'admin' | 'apertura'`. Il client la passa nel corpo come `{ origine: 'apertura' }` o `{ origine: 'pulsante' }`. Si legge solo nel log e ogni valore non riconosciuto vale "pulsante".
- Niente job pg_cron e nessuna modifica al Vault o al database.

## 2. Un solo giro ogni 10 minuti (dentro la funzione)
- Dopo il controllo admin, la funzione legge da `fic_log` l'ultima riga con `operazione = 'riallinea'` e `payload_ridotto->>giro_concluso = 'true'`.
- Se quella riga ha meno di 10 minuti, la funzione non avvia un altro giro. Risponde con `{ ok: true, recente: true, riepilogo, aggiornate, annullate, anomalie }` ricostruiti da quel giro:
  - `riepilogo` è il conteggio salvato nella riga di chiusura;
  - le liste vengono dalle righe per fattura con lo stesso `giro_id`. Numero e studente si rileggono dalla tabella `fatture` col client service_role, quindi nel log non finisce nessun dato personale.
- Limite noto: se due richieste partono nello stesso istante e nessun giro è ancora concluso, possono partire due giri. Il riallineamento è idempotente (`riallinea_fattura` scrive solo le differenze), quindi il secondo giro trova tutto invariato. Non aggiungo un lock nel database.

## 3. Giro automatico all'apertura di Fatturazione
- Nuovo hook `useRiallineamentoAutomatico`, in un file separato, chiamato da `Fatturazione.tsx`:
  - legge l'ultimo giro concluso, con la stessa lettura che fa già `AvvisiFatturazione.tsx:57`, più `created_at`;
  - se il giro non esiste o ha più di 6 ore, chiama `supabase.functions.invoke('fic-riallinea', { body: { origine: 'apertura' } })` in background. La pagina si carica normalmente;
  - fa un solo tentativo per caricamento della pagina, protetto da un `useRef`, senza nuovi tentativi automatici. Un errore viene ignorato in silenzio: la pagina resta utilizzabile e c'è il pulsante;
  - a fine giro invalida `QUERY_FATTURAZIONE`. Se `annullate` o `anomalie` non sono vuote, apre lo stesso `RiepilogoRiallineamento` del pulsante; altrimenti non mostra nulla.
- Il pulsante nell'Archivio resta, invia `origine: 'pulsante'` e mostra sempre il riepilogo. Se la risposta è `recente`, il riepilogo lo dice: «Giro già eseguito alle HH:MM».

## 4. Documentazione
- docs/Context.md, sezione «Riallineamento automatico (P5b)», riscritta:
  - il giro parte all'apertura di Fatturazione (se l'ultimo ha più di 6 ore) e dal pulsante, non da un job;
  - perché: la piattaforma non permette all'agente di creare o leggere segreti nel Vault, quindi un job senza login non ha un modo sicuro per autenticarsi; `verify_jwt` resta attivo come in tutte le fic-*;
  - la regola dei 10 minuti.
- roadmap.md: chiudo la voce del job come «sostituito», aggiungo la voce di questo intervento e tolgo l'attesa del segreto.

## Verifiche (nel resoconto)
- Contenuto di config.toml per fic-riallinea.
- Chiamate senza token e con la sola chiave pubblica: devono rispondere 401 o 403.
- Test, typecheck e build.
- Nel browser, in sola lettura: la pagina si carica mentre il giro gira in background. È un giro vero: fa solo letture su Fatture in Cloud, ma può riallineare 7/S e 8/S nel gestionale. Lo segnalo nel resoconto.

## Scostamenti previsti
- Nessuna protezione contro due giri partiti nello stesso istante (vedi punto 2).
- Il giro automatico parte solo quando un admin apre Fatturazione: se nessuno la apre, non c'è nessun riallineamento.
