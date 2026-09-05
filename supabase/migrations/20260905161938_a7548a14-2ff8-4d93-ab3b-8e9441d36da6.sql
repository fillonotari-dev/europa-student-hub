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