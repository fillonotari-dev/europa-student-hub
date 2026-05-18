## Obiettivo

Mappare i flussi dell'app dal punto di vista del manager (Hotel Europa), evidenziare i punti dove un'azione può rompere lo stato dei dati o lasciare incongruenze, e introdurre **conferme/avvisi contestuali** (no nuove feature, no nuova logica di business). L'iterazione resta UI/UX: rendere ogni azione "pesante" reversibile o almeno consapevole.

## Mappa dei flussi attuali

```text
PUBBLICO                        ADMIN (manager)
────────                        ───────────────
/candidatura (form base)
        │                       Dashboard
        ▼                         ├── KPI (candidature, posti, occupazione)
Candidatura "ricevuta" ────────▶ │   tasks (contratti in scadenza)
                                  │
                                Candidature
                                  ├── prendi in carico → in_valutazione
                                  ├── approva / rifiuta
                                  ├── rimetti in valutazione
                                  ├── segna come ritirata
                                  ├── INVIA FORM COMPLETO (token)
                                  ├── ASSEGNA A CAMERA  ──┐
                                  └── elimina candidatura │
                                                          ▼
/candidatura/completa/:token                            Camere
        │  (studente compila)                            ├── CRUD camera (posti, tipo)
        ▼                                                ├── manutenzione / riattiva
Candidatura "completa"                                   ├── gestisci occupanti
                                                          │   ├── assegna studente
                                                          │   └── concludi assegnazione
                                                          └── elimina camera
                                                          
                                                        Residenti
                                                          ├── trasferisci a nuova camera
                                                          └── concludi soggiorno
                                                          
                                                        Strutture
                                                          ├── crea/modifica
                                                          └── disattiva
                                                          
                                                        Config Form
                                                          ├── campi custom (attiva/disattiva, elimina)
                                                          └── documenti custom (attiva/disattiva, elimina)
                                                          
                                                        Storico (read-only)
```

## Punti critici trovati (ordine di rischio)

### Alto — possono creare incongruenze nei dati

1. **Candidatura `approvata` → `rifiutata` / `ritirata` / `rimetti in valutazione**` mentre esiste già un'assegnazione **attiva** sulla stessa candidatura: oggi avviene senza alcun avviso e lascia un residente in camera con candidatura non più approvata.
2. **Elimina candidatura**: blocca solo se c'è un'assegnazione (qualsiasi stato), ma non spiega che restano i log_stato e i documenti orfani su storage. Messaggio attuale generico.
3. **Camera → cambia `posti**` (modifica camera): se i nuovi posti < occupanti correnti, oggi il salvataggio passa e lo stato camera diventa incoerente (occupati > posti).
4. **Camera → "Imposta in manutenzione"** quando ci sono occupanti attivi: non viene chiesta conferma né segnalato che i residenti restano formalmente in stanza ma la camera risulta non disponibile.
5. **Camera → elimina**: disabilitata solo se ci sono assegnazioni **attive**. Una camera con storico di assegnazioni può essere cancellata, lasciando lo storico orfano (riferimenti rotti in `assegnazioni.camera_id`).
6. **Residenti → "Concludi soggiorno"**: termina l'assegnazione subito (data odierna di default) senza ribadire l'impatto (lo studente sparisce dai residenti, la camera viene ricalcolata). Già esiste una conferma ma è generica.
7. **Residenti → "Trasferisci"**: se la camera di destinazione è piena o in manutenzione, oggi l'azione può fallire silenziosamente o creare overbooking. Manca un check `occupati < posti` lato UI prima di confermare.
8. **Disattiva struttura** (Strutture): possibile anche con candidature pendenti / residenti attivi. Le candidature pubbliche che la indicano restano "appese". Serve avviso che mostri quanti elementi ne dipendono.
9. **Config Form → elimina campo/documento custom** con risposte già raccolte: i dati restano in `risposte_custom` come "orfani" (oggi vengono mostrati, ma l'azione non lo dice).
10. **"Invia form completo" rigenerato**: il nuovo token sovrascrive il precedente. Se il manager rigenera per errore, il link vecchio smette di funzionare. Nessun avviso "esiste già un link valido fino al …".

### Medio — incoerenze di flusso / UX confondente

11. `**STATI` filtro candidature** non include `in_completamento` né `completata` (definiti nel plan ma non nel codice). Il manager non può filtrare per "in attesa di completamento".
12. **Approva candidatura senza form completo**: nessun avviso che lo studente non ha ancora compilato Blocchi 4-5 (lifestyle, garante). Approvare prima del completamento è legittimo ma andrebbe segnalato.
13. **"Assegna a camera"** disponibile solo da stato `approvata`. Il pulsante nel menu si vede solo se `stato==='approvata'` — OK, ma una volta in modalità assegnazione (`?candidatura=…`) non c'è validazione che la camera scelta appartenga alla `struttura_preferita_id` della candidatura.
14. **Note admin** salvate `onBlur` senza feedback visivo (toast) di salvataggio: il manager non sa se la nota è andata a buon fine.

### Basso — qualità di vita

15. Manca un **badge "Link form completo attivo"** in elenco candidature → il manager non vede a colpo d'occhio quali candidati hanno già il link inviato e quando scade.
16. Dashboard tasks: nessun raggruppamento "richiede attenzione" (es. candidature ricevute da > N giorni, link scaduti, camere in manutenzione da molto).

## Cosa propongo di fare ora

Tutto si traduce in **conferme `AlertDialog` / messaggi inline / disabilitazioni** sui punti sopra. Nessuna modifica al modello dati, nessuna nuova edge function.

### Modifiche frontend per blocco

`**src/pages/admin/Candidature.tsx**`

- Aggiungere `AlertDialog` di conferma per le transizioni di stato di una candidatura **assegnata** (punto 1): testo "Esiste un'assegnazione attiva. Cambiare stato non la chiude — vai in Residenti per gestirla."
- Estendere il dialog di "Elimina" (punto 2) elencando cosa rimane (log, documenti) e cosa viene perso.
- Nel modale "Invia form completo" (punto 10): se la candidatura ha già `token_scade_il > now()`, mostrare warning "Esiste già un link valido fino al … . Rigenerare lo invaliderà." e richiedere conferma esplicita.
- Aggiungere badge "Form completo richiesto · scade gg/mm" accanto a "Form completo" nelle righe della tabella (punto 15).
- Aggiungere `in_completamento` e `completata` nell'array `STATI` e nelle mappe label/colore (punto 11).
- Bottone "Approva" mostra tooltip / conferma se `versione_form !== 'completa'` (punto 12).
- Aggiungere toast su `onBlur` delle note admin (punto 14).

`**src/pages/admin/Camere.tsx**`

- Validazione `posti` nel form camera (punto 3): se `nuovo < occupanti correnti`, bloccare con messaggio `"Ci sono N occupanti attivi: riduci prima le assegnazioni o aumenta i posti."`
- Manutenzione (punto 4): se la camera ha occupanti, mostrare warning nel modale "Ci sono N residenti in questa stanza. Verranno mantenuti ma la camera risulterà non assegnabile."
- Elimina camera (punto 5): warning aggiuntivo se esistono assegnazioni concluse → "Eliminando si perde lo storico collegato a questa stanza."
- In modalità "assegna candidatura" (punto 13): mostrare warning inline se la camera selezionata appartiene a una struttura diversa da `struttura_preferita_id`.

`**src/pages/admin/Residenti.tsx**`

- Dialog trasferimento (punto 7): mostrare in tempo reale `occupati/posti` della camera di destinazione e disabilitare conferma se piena o in manutenzione.
- Dialog conclusione (punto 6): dettagliare conseguenze nel testo (rimosso dai residenti, ricalcolo stato camera, mantenuto in storico).

`**src/pages/admin/Strutture.tsx**`

- Toggle "Disattiva" (punto 8): se `metricsByStruttura[id].candidaturePendenti > 0` o `occupati > 0`, mostrare `AlertDialog` con conteggi e richiesta conferma.

`**src/pages/admin/ConfigForm.tsx**`

- Azione elimina campo/documento custom (punto 9): controllare se esiste almeno una `candidature.risposte_custom ? chiave` o `documenti.tipo == chiave`; se sì, mostrare warning "Esistono dati già raccolti con questa chiave: l'eliminazione li rende orfani (restano visibili come 'campo non più configurato')."

**Componente comune**

- `src/components/admin/ConfirmDestructive.tsx` (nuovo, riutilizzabile): wrapper su `AlertDialog` con varianti `warning` / `destructive` + slot per "conseguenze" (lista puntata). Tutti i punti sopra lo usano per uniformità visiva.

## Dettagli tecnici (per chi implementa)

- I controlli "esiste assegnazione attiva", "occupanti > N", "candidature pendenti" sono già calcolabili dalle query esistenti (`assegnazioni`, `dashboard-stats`). Aggiungiamo solo:
  - in `Candidature.tsx`: una `useQuery(['assegnazione-by-cand', id])` lazy quando si apre il dialog stato.
  - in `Camere.tsx`: lookup `occCount(camera.id)` già esistente.
  - in `ConfigForm.tsx`: una query `select id` aggregata su `candidature.risposte_custom ? chiave` (filtro JSONB `?` operator) e su `documenti.tipo`.
- Conferme in italiano, tono pratico, mai bloccare se non strettamente necessario (preferire warning + conferma rispetto a disable).
- Nessuna modifica al DB. Nessuna modifica alle edge function.

## Cosa NON facciamo in questa iterazione

- Niente nuovi stati candidatura, niente refactor delle macchine a stati.
- Niente cleanup automatico di documenti / log orfani (resta valutazione successiva, possibile cascade DB).
- Niente notifiche email automatiche per scadenze token.
- Niente nuove viste o pagine: solo dialog/inline su quelle esistenti.
- Niente modifiche al form pubblico `Candidatura.tsx` / `CandidaturaCompleta.tsx`.

## Domande aperte prima di implementare

1. Tra i punti elencati, vuoi che li affronti **tutti insieme** o solo i prioritari (gruppo "Alto")? -> iniziamo con i prioritari
2. Per i casi di overbooking / manutenzione / posti ridotti: preferisci **bloccare** l'azione o **mostrare warning + permettere conferma esplicita**? (Default proposto: blocco solo dove i dati diventerebbero matematicamente incoerenti — posti < occupanti — warning negli altri casi.) -> ok il default proposto
3. Vuoi che aggiunga subito `in_completamento` e `completata` ai filtri stato candidature, o lo trattiamo separatamente? - aggiungiamo