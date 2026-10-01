CREATE OR REPLACE FUNCTION public.riallinea_fattura(p_fattura_id uuid, p_esiste boolean, p_numero integer, p_numerazione text, p_data date, p_imponibile numeric, p_iva numeric, p_totale numeric, p_ei_status text, p_url text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_f public.fatture%ROWTYPE;
  v_campi text[] := ARRAY[]::text[];
  v_mancanti text[] := ARRAY[]::text[];
  v_mensilita jsonb;
  v_canone_totale numeric;
BEGIN
  PERFORM set_config('app.riallineamento', 'on', true);

  SELECT * INTO v_f FROM public.fatture WHERE id = p_fattura_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'fattura_inesistente: la fattura non esiste';
  END IF;
  IF v_f.stato <> 'emessa' THEN
    RAISE EXCEPTION 'fattura_non_emessa: la fattura e'' in stato % e non si riallinea', v_f.stato;
  END IF;

  IF NOT p_esiste THEN
    IF v_f.ei_status IS NOT NULL AND v_f.ei_status <> 'not_sent' THEN
      RAISE EXCEPTION 'documento_trasmesso_scomparso: il documento risulta trasmesso allo SDI (stato %) ma non esiste piu'' su Fatture in Cloud; nessuna modifica', v_f.ei_status;
    END IF;
    IF EXISTS (SELECT 1 FROM public.canoni WHERE fattura_id = p_fattura_id AND stato <> 'fatturato') THEN
      RAISE EXCEPTION 'mensilita_non_fatturata_documento_scomparso: una mensilità collegata non e'' in stato fatturato (per esempio incassata); nessuna modifica';
    END IF;

    SELECT jsonb_agg(id) INTO v_mensilita FROM public.canoni WHERE fattura_id = p_fattura_id;

    UPDATE public.canoni
       SET stato = 'da_fatturare', fattura_id = NULL
     WHERE fattura_id = p_fattura_id AND stato = 'fatturato';

    UPDATE public.fatture
       SET stato = 'annullata',
           annullata_il = now(),
           motivo_annullamento = 'Documento cancellato su Fatture in Cloud prima della trasmissione allo SDI'
     WHERE id = p_fattura_id;

    PERFORM set_config('app.riallineamento', 'off', true);
    RETURN jsonb_build_object('esito', 'annullata', 'mensilita', v_mensilita);
  END IF;

  -- Con p_esiste = true ogni campo da aggiornare è obbligatorio: un NULL
  -- sovrascriverebbe il valore locale con un valore mancante.
  IF p_numero IS NULL THEN v_mancanti := array_append(v_mancanti, 'numero'::text); END IF;
  IF p_numerazione IS NULL THEN v_mancanti := array_append(v_mancanti, 'numerazione'::text); END IF;
  IF p_data IS NULL THEN v_mancanti := array_append(v_mancanti, 'data'::text); END IF;
  IF p_imponibile IS NULL THEN v_mancanti := array_append(v_mancanti, 'imponibile'::text); END IF;
  IF p_iva IS NULL THEN v_mancanti := array_append(v_mancanti, 'iva'::text); END IF;
  IF p_totale IS NULL THEN v_mancanti := array_append(v_mancanti, 'totale'::text); END IF;
  IF cardinality(v_mancanti) > 0 THEN
    RAISE EXCEPTION 'parametri_riallineamento_mancanti: parametri mancanti per l''aggiornamento: %', array_to_string(v_mancanti, ', ');
  END IF;

  IF p_numero IS DISTINCT FROM v_f.numero THEN v_campi := array_append(v_campi, 'numero'::text); END IF;
  IF p_numerazione IS DISTINCT FROM v_f.numerazione THEN v_campi := array_append(v_campi, 'numerazione'::text); END IF;
  IF p_data IS DISTINCT FROM v_f.data THEN v_campi := array_append(v_campi, 'data'::text); END IF;
  IF p_imponibile IS DISTINCT FROM v_f.imponibile THEN v_campi := array_append(v_campi, 'imponibile'::text); END IF;
  IF p_iva IS DISTINCT FROM v_f.iva THEN v_campi := array_append(v_campi, 'iva'::text); END IF;
  IF p_totale IS DISTINCT FROM v_f.totale THEN v_campi := array_append(v_campi, 'totale'::text); END IF;
  -- p_ei_status NULL significa "invariato": non sovrascrive l'ei_status già registrato.
  IF p_ei_status IS NOT NULL AND p_ei_status IS DISTINCT FROM v_f.ei_status THEN v_campi := array_append(v_campi, 'ei_status'::text); END IF;
  IF nullif(v_f.url_documento, '') IS NULL AND nullif(p_url, '') IS NOT NULL THEN
    v_campi := array_append(v_campi, 'url_documento'::text);
  END IF;

  UPDATE public.fatture SET
    numero = CASE WHEN 'numero' = ANY(v_campi) THEN p_numero ELSE numero END,
    numerazione = CASE WHEN 'numerazione' = ANY(v_campi) THEN p_numerazione ELSE numerazione END,
    data = CASE WHEN 'data' = ANY(v_campi) THEN p_data ELSE data END,
    imponibile = CASE WHEN 'imponibile' = ANY(v_campi) THEN p_imponibile ELSE imponibile END,
    iva = CASE WHEN 'iva' = ANY(v_campi) THEN p_iva ELSE iva END,
    totale = CASE WHEN 'totale' = ANY(v_campi) THEN p_totale ELSE totale END,
    ei_status = CASE WHEN 'ei_status' = ANY(v_campi) THEN p_ei_status ELSE ei_status END,
    url_documento = CASE WHEN 'url_documento' = ANY(v_campi) THEN p_url ELSE url_documento END,
    riallineata_il = now()
  WHERE id = p_fattura_id;

  SELECT totale INTO v_canone_totale FROM public.canoni WHERE fattura_id = p_fattura_id LIMIT 1;

  PERFORM set_config('app.riallineamento', 'off', true);
  RETURN jsonb_build_object(
    'esito', CASE WHEN cardinality(v_campi) > 0 THEN 'aggiornata' ELSE 'invariata' END,
    'campi', to_jsonb(v_campi),
    'importo_divergente', v_canone_totale IS NOT NULL
                          AND coalesce(p_totale, v_f.totale) IS DISTINCT FROM v_canone_totale
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.riallineamento', 'off', true);
  RAISE;
END;
$function$;

REVOKE ALL ON FUNCTION public.riallinea_fattura(uuid, boolean, integer, text, date, numeric, numeric, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.riallinea_fattura(uuid, boolean, integer, text, date, numeric, numeric, numeric, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.riallinea_fattura(uuid, boolean, integer, text, date, numeric, numeric, numeric, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.riallinea_fattura(uuid, boolean, integer, text, date, numeric, numeric, numeric, text, text) TO service_role;

COMMENT ON FUNCTION public.riallinea_fattura(uuid, boolean, integer, text, date, numeric, numeric, numeric, text, text) IS 'Con p_esiste = true richiede numero, numerazione, data, imponibile, iva e totale (parametri_riallineamento_mancanti); p_ei_status NULL significa invariato.';