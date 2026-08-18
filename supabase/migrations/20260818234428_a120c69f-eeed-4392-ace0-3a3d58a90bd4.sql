REVOKE ALL ON FUNCTION public.attiva_contratto(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.attiva_contratto(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.attiva_contratto(uuid, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.aggiorna_canone_contratto(uuid, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.aggiorna_canone_contratto(uuid, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.aggiorna_canone_contratto(uuid, numeric) TO authenticated;

REVOKE ALL ON FUNCTION public.chiudi_contratto(uuid, date, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.chiudi_contratto(uuid, date, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.chiudi_contratto(uuid, date, text) TO authenticated;

REVOKE ALL ON FUNCTION public.riporta_contratto_in_bozza(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.riporta_contratto_in_bozza(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.riporta_contratto_in_bozza(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.imposta_listino(
  p_struttura_id uuid,
  p_tipo_camera text,
  p_importo numeric,
  p_valido_dal date
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_conf record;
  v_id uuid;
BEGIN
  IF p_tipo_camera IS NULL OR p_tipo_camera NOT IN ('singola','doppia') THEN
    RAISE EXCEPTION 'tipo_camera_non_valido: il tipo camera deve essere singola o doppia';
  END IF;
  IF p_importo IS NULL OR p_importo < 0 THEN
    RAISE EXCEPTION 'importo_non_valido: l''importo mensile deve essere maggiore o uguale a zero';
  END IF;
  IF p_valido_dal IS NULL THEN
    RAISE EXCEPTION 'decorrenza_mancante: indicare la data di decorrenza del nuovo prezzo';
  END IF;
  IF p_struttura_id IS NULL THEN
    RAISE EXCEPTION 'struttura_mancante: indicare la sede';
  END IF;

  SELECT * INTO v_conf
  FROM public.listini
  WHERE struttura_id = p_struttura_id
    AND tipo_camera = p_tipo_camera
    AND valido_dal >= p_valido_dal
  ORDER BY valido_dal
  LIMIT 1;

  IF v_conf.id IS NOT NULL THEN
    RAISE EXCEPTION 'decorrenza_non_successiva: esiste gia'' un prezzo con decorrenza % per questa sede e tipo camera; il nuovo prezzo deve partire dopo, oppure va corretto quello esistente', to_char(v_conf.valido_dal, 'DD/MM/YYYY');
  END IF;

  UPDATE public.listini
     SET valido_al = p_valido_dal - 1
   WHERE struttura_id = p_struttura_id
     AND tipo_camera = p_tipo_camera
     AND valido_al IS NULL;

  SELECT * INTO v_conf
  FROM public.listini
  WHERE struttura_id = p_struttura_id
    AND tipo_camera = p_tipo_camera
    AND daterange(valido_dal, valido_al, '[]') && daterange(p_valido_dal, NULL, '[]')
  ORDER BY valido_dal
  LIMIT 1;

  IF v_conf.id IS NOT NULL THEN
    RAISE EXCEPTION 'periodo_sovrapposto: esiste gia'' un prezzo valido dal % al % per questa sede e tipo camera; scegliere una decorrenza successiva alla fine di quel periodo', to_char(v_conf.valido_dal, 'DD/MM/YYYY'), COALESCE(to_char(v_conf.valido_al, 'DD/MM/YYYY'), 'oggi');
  END IF;

  INSERT INTO public.listini (struttura_id, tipo_camera, importo_mensile, valido_dal, valido_al)
  VALUES (p_struttura_id, p_tipo_camera, p_importo, p_valido_dal, NULL)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.imposta_listino(uuid, text, numeric, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.imposta_listino(uuid, text, numeric, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.imposta_listino(uuid, text, numeric, date) TO authenticated;