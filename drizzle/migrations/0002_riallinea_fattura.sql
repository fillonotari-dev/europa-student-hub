-- Stato 'annullata' (allargamento autorizzato del vincolo) e colonne di riallineamento
ALTER TABLE public.fatture DROP CONSTRAINT fatture_stato_check;
ALTER TABLE public.fatture ADD CONSTRAINT fatture_stato_check
  CHECK (stato = ANY (ARRAY['in_invio'::text, 'emessa'::text, 'errore'::text, 'annullata'::text]));

ALTER TABLE public.fatture
  ADD COLUMN IF NOT EXISTS riallineata_il timestamptz,
  ADD COLUMN IF NOT EXISTS annullata_il timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_annullamento text;

COMMENT ON COLUMN public.fatture.riallineata_il IS 'Ultima verifica riuscita con Fatture in Cloud (riallinea_fattura).';
COMMENT ON COLUMN public.fatture.annullata_il IS 'Momento in cui la fattura è passata ad annullata (solo da riallinea_fattura).';
COMMENT ON COLUMN public.fatture.motivo_annullamento IS 'Motivo dell''annullamento (solo da riallinea_fattura).';

-- Protezione fatture: identica a prima, più il varco del riallineamento
CREATE OR REPLACE FUNCTION public.fatture_protect_emesse()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_segnale boolean := coalesce(current_setting('app.riallineamento', true), '') = 'on'
                       AND current_user NOT IN ('anon', 'authenticated');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.stato = 'annullata' THEN
      RAISE EXCEPTION 'fattura_annullata_non_ammessa: una fattura non puo'' nascere annullata; lo stato annullata si raggiunge solo da emessa tramite riallineamento';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.stato = 'emessa' THEN
      RAISE EXCEPTION 'fattura_gia_emessa: la fattura e'' stata emessa e corrisponde a un documento fiscale reale; non puo'' essere cancellata';
    END IF;
    IF OLD.stato = 'annullata' THEN
      RAISE EXCEPTION 'fattura_annullata: la fattura annullata e'' conservata come traccia e non puo'' essere cancellata';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF OLD.stato = 'annullata' THEN
    RAISE EXCEPTION 'fattura_annullata: la fattura annullata e'' immutabile';
  END IF;

  IF NEW.stato = 'annullata' AND NOT (OLD.stato = 'emessa' AND v_segnale) THEN
    RAISE EXCEPTION 'fattura_annullata_non_ammessa: lo stato annullata si raggiunge solo da emessa tramite riallineamento con Fatture in Cloud';
  END IF;

  IF OLD.stato = 'emessa' THEN
    IF v_segnale THEN
      IF NEW.fic_document_id IS DISTINCT FROM OLD.fic_document_id
         OR NEW.contratto_id IS DISTINCT FROM OLD.contratto_id THEN
        RAISE EXCEPTION 'fattura_gia_emessa: identificativo del documento e contratto non sono modificabili, nemmeno dal riallineamento';
      END IF;
      IF NEW.stato IS DISTINCT FROM OLD.stato AND NEW.stato <> 'annullata' THEN
        RAISE EXCEPTION 'fattura_gia_emessa: dal riallineamento e'' ammesso solo il passaggio emessa -> annullata';
      END IF;
      IF NEW.stato = 'emessa' AND (NEW.annullata_il IS DISTINCT FROM OLD.annullata_il
         OR NEW.motivo_annullamento IS DISTINCT FROM OLD.motivo_annullamento) THEN
        RAISE EXCEPTION 'fattura_gia_emessa: data e motivo di annullamento si impostano solo con il passaggio ad annullata';
      END IF;
      RETURN NEW;
    END IF;

    IF NEW.fic_document_id IS DISTINCT FROM OLD.fic_document_id
       OR NEW.numero IS DISTINCT FROM OLD.numero
       OR NEW.numerazione IS DISTINCT FROM OLD.numerazione
       OR NEW.data IS DISTINCT FROM OLD.data
       OR NEW.imponibile IS DISTINCT FROM OLD.imponibile
       OR NEW.iva IS DISTINCT FROM OLD.iva
       OR NEW.totale IS DISTINCT FROM OLD.totale
       OR NEW.contratto_id IS DISTINCT FROM OLD.contratto_id
       OR NEW.riallineata_il IS DISTINCT FROM OLD.riallineata_il
       OR NEW.annullata_il IS DISTINCT FROM OLD.annullata_il
       OR NEW.motivo_annullamento IS DISTINCT FROM OLD.motivo_annullamento THEN
      RAISE EXCEPTION 'fattura_gia_emessa: la fattura e'' stata emessa; numero, data, importi, contratto e identificativo del documento non sono piu'' modificabili. Si possono aggiornare solo lo stato dell''invio elettronico e il link al documento';
    END IF;

    IF NEW.stato IS DISTINCT FROM OLD.stato THEN
      RAISE EXCEPTION 'fattura_gia_emessa: la fattura e'' emessa e il suo stato non puo'' piu'' essere cambiato';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER fatture_protect_insert
  BEFORE INSERT ON public.fatture
  FOR EACH ROW EXECUTE FUNCTION public.fatture_protect_emesse();

-- Protezione mensilità: identica a prima, più il solo ritorno fatturato -> da_fatturare
CREATE OR REPLACE FUNCTION public.canoni_protect_fatturati()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_segnale boolean := coalesce(current_setting('app.riallineamento', true), '') = 'on'
                       AND current_user NOT IN ('anon', 'authenticated');
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.stato IN ('fatturato','incassato') THEN
      RAISE EXCEPTION 'canone_gia_fatturato: la mensilità è in stato % e corrisponde a un documento fiscale emesso; non può essere cancellata', OLD.stato;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.stato IN ('fatturato','incassato') THEN
    -- Varco del riallineamento: documento cancellato su Fatture in Cloud
    IF v_segnale
       AND OLD.stato = 'fatturato' AND NEW.stato = 'da_fatturare'
       AND OLD.fattura_id IS NOT NULL AND NEW.fattura_id IS NULL
       AND NEW.contratto_id IS NOT DISTINCT FROM OLD.contratto_id
       AND NEW.competenza IS NOT DISTINCT FROM OLD.competenza
       AND NEW.imponibile IS NOT DISTINCT FROM OLD.imponibile
       AND NEW.aliquota_iva IS NOT DISTINCT FROM OLD.aliquota_iva
       AND NEW.scadenza IS NOT DISTINCT FROM OLD.scadenza
       AND NEW.id IS NOT DISTINCT FROM OLD.id
       AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at THEN
      RETURN NEW;
    END IF;

    IF NEW.contratto_id IS DISTINCT FROM OLD.contratto_id
       OR NEW.competenza IS DISTINCT FROM OLD.competenza
       OR NEW.imponibile IS DISTINCT FROM OLD.imponibile
       OR NEW.aliquota_iva IS DISTINCT FROM OLD.aliquota_iva
       OR NEW.scadenza IS DISTINCT FROM OLD.scadenza
       OR NEW.id IS DISTINCT FROM OLD.id
       OR NEW.fattura_id IS DISTINCT FROM OLD.fattura_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'canone_gia_fatturato: la mensilità è in stato % e corrisponde a un documento fiscale emesso; si possono aggiornare solo le note e registrare l''incasso', OLD.stato;
    END IF;

    IF NEW.stato IS DISTINCT FROM OLD.stato
       AND NOT (OLD.stato = 'fatturato' AND NEW.stato = 'incassato') THEN
      RAISE EXCEPTION 'canone_transizione_non_ammessa: da % è ammesso solo il passaggio a incassato', OLD.stato;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Unico varco: riservato al sincronizzatore (service_role)
CREATE OR REPLACE FUNCTION public.riallinea_fattura(
  p_fattura_id uuid, p_esiste boolean, p_numero integer, p_numerazione text, p_data date,
  p_imponibile numeric, p_iva numeric, p_totale numeric, p_ei_status text, p_url text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_f public.fatture%ROWTYPE;
  v_campi text[] := ARRAY[]::text[];
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

  IF p_numero IS DISTINCT FROM v_f.numero THEN v_campi := v_campi || 'numero'; END IF;
  IF p_numerazione IS DISTINCT FROM v_f.numerazione THEN v_campi := v_campi || 'numerazione'; END IF;
  IF p_data IS DISTINCT FROM v_f.data THEN v_campi := v_campi || 'data'; END IF;
  IF p_imponibile IS DISTINCT FROM v_f.imponibile THEN v_campi := v_campi || 'imponibile'; END IF;
  IF p_iva IS DISTINCT FROM v_f.iva THEN v_campi := v_campi || 'iva'; END IF;
  IF p_totale IS DISTINCT FROM v_f.totale THEN v_campi := v_campi || 'totale'; END IF;
  IF p_ei_status IS DISTINCT FROM v_f.ei_status THEN v_campi := v_campi || 'ei_status'; END IF;
  IF nullif(v_f.url_documento, '') IS NULL AND nullif(p_url, '') IS NOT NULL THEN
    v_campi := v_campi || 'url_documento';
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

REVOKE EXECUTE ON FUNCTION public.riallinea_fattura(uuid, boolean, integer, text, date, numeric, numeric, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.riallinea_fattura(uuid, boolean, integer, text, date, numeric, numeric, numeric, text, text) TO service_role;
