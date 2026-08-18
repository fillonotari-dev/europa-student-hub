ALTER TABLE public.contratti ADD COLUMN motivo_chiusura text;

ALTER TABLE public.contratti
  ADD CONSTRAINT contratti_motivo_chiusura_chk CHECK (
    (stato IN ('scaduto','risolto','rinnovato')
      AND motivo_chiusura IS NOT NULL
      AND motivo_chiusura IN ('fine_naturale','partenza_anticipata','risoluzione','sostituzione'))
    OR (stato IN ('bozza','attivo') AND motivo_chiusura IS NULL)
  );

CREATE OR REPLACE FUNCTION public.chiudi_contratto(p_contratto_id uuid, p_data_fine date, p_motivo text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_stato text;
  v_inizio date;
  v_nuovo_stato text;
  v_annullate integer;
BEGIN
  IF p_motivo IS NULL OR p_motivo NOT IN ('fine_naturale','partenza_anticipata','risoluzione','sostituzione') THEN
    RAISE EXCEPTION 'motivo_non_valido: il motivo di chiusura % non e'' ammesso', coalesce(p_motivo, 'nullo');
  END IF;

  v_nuovo_stato := CASE p_motivo
    WHEN 'fine_naturale' THEN 'scaduto'
    WHEN 'partenza_anticipata' THEN 'risolto'
    WHEN 'risoluzione' THEN 'risolto'
    WHEN 'sostituzione' THEN 'rinnovato'
  END;

  SELECT stato, data_inizio INTO v_stato, v_inizio FROM public.contratti WHERE id = p_contratto_id;
  IF v_stato IS NULL THEN
    RAISE EXCEPTION 'contratto_inesistente: il contratto non esiste o non e'' accessibile';
  END IF;
  IF v_stato <> 'attivo' THEN
    RAISE EXCEPTION 'contratto_non_attivo: il contratto e'' in stato % e non puo'' essere chiuso', v_stato;
  END IF;

  IF p_data_fine IS NULL THEN
    RAISE EXCEPTION 'data_fine_mancante: indicare la data di fine effettiva';
  END IF;
  IF p_data_fine <= v_inizio THEN
    RAISE EXCEPTION 'data_fine_precedente_inizio: un contratto non puo'' chiudersi prima di cominciare (inizio %); per il contratto mai cominciato usare "Riporta in bozza" e poi eliminarlo', v_inizio;
  END IF;

  UPDATE public.contratti
     SET data_fine = p_data_fine,
         stato = v_nuovo_stato,
         motivo_chiusura = p_motivo
   WHERE id = p_contratto_id;

  UPDATE public.canoni
     SET stato = 'annullato'
   WHERE contratto_id = p_contratto_id
     AND stato = 'da_fatturare'
     AND competenza > date_trunc('month', p_data_fine)::date;

  GET DIAGNOSTICS v_annullate = ROW_COUNT;
  RETURN v_annullate;
END;
$$;

REVOKE ALL ON FUNCTION public.chiudi_contratto(uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chiudi_contratto(uuid, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.riporta_contratto_in_bozza(p_contratto_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_stato text;
  v_dep text;
BEGIN
  SELECT stato, deposito_stato INTO v_stato, v_dep FROM public.contratti WHERE id = p_contratto_id;
  IF v_stato IS NULL THEN
    RAISE EXCEPTION 'contratto_inesistente: il contratto non esiste o non e'' accessibile';
  END IF;
  IF v_stato <> 'attivo' THEN
    RAISE EXCEPTION 'contratto_non_attivo: il contratto e'' in stato % e non puo'' essere riportato in bozza', v_stato;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.canoni
    WHERE contratto_id = p_contratto_id AND stato IN ('fatturato','incassato')
  ) THEN
    RAISE EXCEPTION 'canoni_gia_fatturati: il contratto ha gia'' prodotto documenti fiscali e puo'' solo essere chiuso';
  END IF;

  IF v_dep IS NOT NULL AND v_dep <> 'atteso' THEN
    RAISE EXCEPTION 'deposito_gia_movimentato: il deposito e'' in stato % e il contratto puo'' solo essere chiuso', v_dep;
  END IF;

  DELETE FROM public.canoni WHERE contratto_id = p_contratto_id;

  UPDATE public.contratti
     SET stato = 'bozza',
         motivo_chiusura = NULL
   WHERE id = p_contratto_id;
END;
$$;

REVOKE ALL ON FUNCTION public.riporta_contratto_in_bozza(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.riporta_contratto_in_bozza(uuid) TO authenticated;