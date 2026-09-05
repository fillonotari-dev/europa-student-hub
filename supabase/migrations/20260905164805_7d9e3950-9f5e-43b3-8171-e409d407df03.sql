ALTER TABLE public.listini RENAME COLUMN importo_mensile TO importo_mensile_lordo;

-- I prezzi di listino sono e sono sempre stati IVA inclusa: cambia il nome, non il valore.
CREATE OR REPLACE FUNCTION public.imposta_listino(
  p_struttura_id uuid,
  p_tipo_camera text,
  p_importo numeric,
  p_valido_dal date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_conf record;
BEGIN
  IF p_tipo_camera NOT IN ('singola', 'doppia') THEN
    RAISE EXCEPTION 'Tipo camera non valido: deve essere singola o doppia.';
  END IF;
  IF p_importo IS NULL OR p_importo < 0 THEN
    RAISE EXCEPTION 'Importo non valido: indica un importo maggiore o uguale a zero.';
  END IF;
  IF p_valido_dal IS NULL THEN
    RAISE EXCEPTION 'Indica la data di decorrenza del nuovo prezzo.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.listini
    WHERE struttura_id = p_struttura_id
      AND tipo_camera = p_tipo_camera
      AND valido_dal >= p_valido_dal
  ) THEN
    RAISE EXCEPTION 'Esiste già un prezzo con decorrenza uguale o successiva al %: scegli una data posteriore.', to_char(p_valido_dal, 'DD/MM/YYYY');
  END IF;

  UPDATE public.listini
  SET valido_al = p_valido_dal - 1
  WHERE struttura_id = p_struttura_id
    AND tipo_camera = p_tipo_camera
    AND valido_al IS NULL;

  SELECT valido_dal, valido_al INTO v_conf
  FROM public.listini
  WHERE struttura_id = p_struttura_id
    AND tipo_camera = p_tipo_camera
    AND daterange(valido_dal, valido_al, '[]') && daterange(p_valido_dal, NULL, '[]')
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Esiste già un prezzo per questa sede e tipo camera valido dal % al %: non è possibile sovrapporne un altro.',
      to_char(v_conf.valido_dal, 'DD/MM/YYYY'), COALESCE(to_char(v_conf.valido_al, 'DD/MM/YYYY'), 'oggi');
  END IF;

  INSERT INTO public.listini (struttura_id, tipo_camera, importo_mensile_lordo, valido_dal, valido_al)
  VALUES (p_struttura_id, p_tipo_camera, p_importo, p_valido_dal, NULL)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.imposta_listino(uuid, text, numeric, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.imposta_listino(uuid, text, numeric, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.imposta_listino(uuid, text, numeric, date) TO authenticated;

-- Allineamento del contratto in bozza: 300,00 erano intesi come IVA inclusa.
UPDATE public.contratti
SET canone_mensile = 272.73
WHERE id = 'c30621c8-deea-40ce-b4fe-51762fa8646e'
  AND stato = 'bozza'
  AND canone_mensile = 300.00;