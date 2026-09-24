-- Registra nel gestionale una fattura GIA' esistente su Fatture in Cloud e la
-- collega alla mensilita', in un'unica transazione. Additiva: nessun vincolo toccato.
CREATE OR REPLACE FUNCTION public.registra_fattura_esistente(
  p_canone_id uuid,
  p_fic_document_id bigint,
  p_numero integer,
  p_numerazione text,
  p_data date,
  p_ei_status text,
  p_imponibile numeric,
  p_iva numeric,
  p_totale numeric
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_canone record;
  v_fattura_id uuid;
BEGIN
  SELECT id, contratto_id, stato, totale INTO v_canone
  FROM public.canoni WHERE id = p_canone_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mensilità non trovata.';
  END IF;
  IF v_canone.stato <> 'da_fatturare' THEN
    RAISE EXCEPTION 'La mensilità è in stato %: non può essere collegata a una fattura.', v_canone.stato;
  END IF;
  IF p_totale IS DISTINCT FROM v_canone.totale THEN
    RAISE EXCEPTION 'Importo diverso: la fattura vale % €, la mensilità % €. Nessun collegamento eseguito.',
      p_totale, v_canone.totale;
  END IF;

  BEGIN
    INSERT INTO public.fatture (contratto_id, fic_document_id, numero, numerazione, data, ei_status,
                                imponibile, iva, totale, stato)
    VALUES (v_canone.contratto_id, p_fic_document_id, p_numero, p_numerazione, p_data, p_ei_status,
            p_imponibile, p_iva, p_totale, 'emessa')
    RETURNING id INTO v_fattura_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Questo documento di Fatture in Cloud è già registrato nel gestionale.';
  END;

  -- Un'unica UPDATE: fattura_id e stato insieme (canoni_protect_fatturati).
  UPDATE public.canoni SET fattura_id = v_fattura_id, stato = 'fatturato' WHERE id = p_canone_id;

  RETURN v_fattura_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registra_fattura_esistente(uuid, bigint, integer, text, date, text, numeric, numeric, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.registra_fattura_esistente(uuid, bigint, integer, text, date, text, numeric, numeric, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.registra_fattura_esistente(uuid, bigint, integer, text, date, text, numeric, numeric, numeric) TO authenticated;