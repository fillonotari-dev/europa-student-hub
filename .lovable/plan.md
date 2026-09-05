# Importi personalizzati protetti dal cambio canone

Verificato: `aggiorna_canone_contratto` riscrive `imponibile = p_canone` su tutte le mensilità `da_fatturare` con competenza dal mese corrente in poi, senza confronto col canone precedente (definizione letta dal database). In `src/pages/admin/ContrattoPage.tsx` il conteggio `daRicalcolare` (righe 101-104) filtra solo per stato e competenza, quindi il dialogo di conferma promette anche le righe corrette a mano.

## 1. Funzione database (additiva, `CREATE OR REPLACE`)

Prima dell'aggiornamento si legge il canone attuale del contratto; l'UPDATE sulle mensilità aggiunge la condizione `imponibile = <canone precedente>`. Firma e tipo di ritorno invariati: continua a restituire il numero di righe effettivamente aggiornate. Nessun DROP, nessun ALTER, nessuna modifica ai dati esistenti oltre a quella già prevista.

```sql
CREATE OR REPLACE FUNCTION public.aggiorna_canone_contratto(p_contratto_id uuid, p_canone numeric)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_canone_prec numeric;
  v_toccate integer;
BEGIN
  IF p_canone IS NULL OR p_canone < 0 THEN
    RAISE EXCEPTION 'canone_non_valido: il canone deve essere un importo maggiore o uguale a zero';
  END IF;

  SELECT canone_mensile INTO v_canone_prec
    FROM public.contratti WHERE id = p_contratto_id;
  IF v_canone_prec IS NULL THEN
    RAISE EXCEPTION 'contratto_inesistente: il contratto non esiste o non è accessibile';
  END IF;

  UPDATE public.contratti SET canone_mensile = p_canone WHERE id = p_contratto_id;

  -- Solo le mensilità ancora allineate al canone precedente: quelle corrette a
  -- mano dall'operatore sono deliberatamente diverse e non vanno riscritte.
  -- Limite noto, compromesso accettato: se l'operatore corregge una riga a un
  -- valore che coincide esattamente col canone precedente, quella riga è
  -- indistinguibile da una standard e verrà aggiornata. Non si risolve con una
  -- colonna in più.
  UPDATE public.canoni
     SET imponibile = p_canone
   WHERE contratto_id = p_contratto_id
     AND stato = 'da_fatturare'
     AND competenza >= date_trunc('month', current_date)::date
     AND imponibile = v_canone_prec;

  GET DIAGNOSTICS v_toccate = ROW_COUNT;
  RETURN v_toccate;
END;
$function$;
```

Nota: il controllo di esistenza passa da `SELECT true` a `SELECT canone_mensile`, che è sempre `NOT NULL` sulla tabella, quindi il messaggio `contratto_inesistente` resta esatto.

## 2. Criterio estratto in una funzione pura

Il criterio che distingue le mensilità toccate da quelle intatte non vive nel componente: una funzione pura nuova in `src/lib/` (sul modello di `src/lib/candidaturaActions.ts`) riceve l'elenco delle mensilità, il canone attuale del contratto e la data odierna, e restituisce le due partizioni: quelle che un cambio di canone aggiornerebbe (stato `da_fatturare`, competenza corrente o futura, imponibile uguale al canone) e quelle che lascerebbe intatte. `ContrattoPage.tsx` la usa per i conteggi `daRicalcolare` e `personalizzate` e per il segno in tabella, senza filtri propri.

File di test nuovo con almeno: riga allineata e competenza futura (aggiornata), riga con importo diverso (intatta), riga di un mese passato (intatta), riga già `fatturato` (intatta), nessuna riga aggiornabile. Esito della suite riportato nel resoconto.

## 3. Dialogo di conferma

Il dialogo "Ricalcolare le mensilità?" dichiara entrambe le quantità: quante verranno portate al nuovo importo e quante hanno un importo personalizzato e resteranno com'erano, con l'avvertenza che vanno eventualmente corrette a mano. Resta la riga esistente sulle mensilità già fatturate o incassate. Solo token semantici (`text-muted-foreground`), nessun colore scritto a mano.

## 4. Segnalazione in tabella

Nella colonna Imponibile dello scadenzario, accanto all'importo di una riga il cui imponibile è diverso dal canone del contratto compare un piccolo segno (icona) con testo al passaggio del mouse che dichiara solo questo: l'importo di questa riga è diverso dal canone del contratto. Nessuna promessa sul comportamento futuro — su una riga di un mese passato o già fatturata sarebbe vera per motivi diversi da quello dichiarato. Nessuna colonna nuova.

## 5. Resoconto

A fine lavoro: lo statement SQL della funzione aggiornata e l'elenco puntuale delle righe modificate in `ContrattoPage.tsx`.

## Fuori perimetro

Nessuna modifica ad altre funzioni, tabelle, policy o dati; nessun intervento sulla generazione iniziale dello scadenzario né su `salvaRiga`.
