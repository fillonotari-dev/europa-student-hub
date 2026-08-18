CREATE OR REPLACE FUNCTION public.attiva_contratto(p_contratto_id uuid, p_righe jsonb)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_stato text;
  v_inserite integer;
BEGIN
  SELECT stato INTO v_stato FROM public.contratti WHERE id = p_contratto_id;
  IF v_stato IS NULL THEN
    RAISE EXCEPTION 'contratto_inesistente: il contratto non esiste o non è accessibile';
  END IF;
  IF v_stato <> 'bozza' THEN
    RAISE EXCEPTION 'contratto_non_in_bozza: il contratto è in stato % e non può essere attivato', v_stato;
  END IF;
  IF EXISTS (SELECT 1 FROM public.canoni WHERE contratto_id = p_contratto_id) THEN
    RAISE EXCEPTION 'scadenzario_gia_presente: esistono già mensilità per questo contratto, probabilmente da un tentativo di attivazione fallito; vanno verificate prima di riprovare';
  END IF;
  IF p_righe IS NULL OR jsonb_typeof(p_righe) <> 'array' OR jsonb_array_length(p_righe) = 0 THEN
    RAISE EXCEPTION 'scadenzario_vuoto: nessuna mensilità da generare';
  END IF;

  INSERT INTO public.canoni (contratto_id, competenza, imponibile, aliquota_iva, scadenza, stato)
  SELECT p_contratto_id,
         (r->>'competenza')::date,
         (r->>'imponibile')::numeric,
         (r->>'aliquota_iva')::numeric,
         (r->>'scadenza')::date,
         'da_fatturare'
  FROM jsonb_array_elements(p_righe) AS r;

  GET DIAGNOSTICS v_inserite = ROW_COUNT;

  UPDATE public.contratti SET stato = 'attivo' WHERE id = p_contratto_id;

  RETURN v_inserite;
END;
$$;

CREATE OR REPLACE FUNCTION public.aggiorna_canone_contratto(p_contratto_id uuid, p_canone numeric)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_esiste boolean;
  v_toccate integer;
BEGIN
  IF p_canone IS NULL OR p_canone < 0 THEN
    RAISE EXCEPTION 'canone_non_valido: il canone deve essere un importo maggiore o uguale a zero';
  END IF;
  SELECT true INTO v_esiste FROM public.contratti WHERE id = p_contratto_id;
  IF v_esiste IS NULL THEN
    RAISE EXCEPTION 'contratto_inesistente: il contratto non esiste o non è accessibile';
  END IF;

  UPDATE public.contratti SET canone_mensile = p_canone WHERE id = p_contratto_id;

  UPDATE public.canoni
     SET imponibile = p_canone
   WHERE contratto_id = p_contratto_id
     AND stato = 'da_fatturare'
     AND competenza >= date_trunc('month', current_date)::date;

  GET DIAGNOSTICS v_toccate = ROW_COUNT;
  RETURN v_toccate;
END;
$$;

REVOKE ALL ON FUNCTION public.attiva_contratto(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aggiorna_canone_contratto(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attiva_contratto(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aggiorna_canone_contratto(uuid, numeric) TO authenticated;