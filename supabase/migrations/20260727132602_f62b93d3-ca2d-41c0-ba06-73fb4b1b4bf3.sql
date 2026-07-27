-- Precheck: nessuna candidatura deve essere in 'in_valutazione'
DO $$
DECLARE n INT;
BEGIN
  SELECT count(*) INTO n FROM public.candidature WHERE stato = 'in_valutazione';
  IF n > 0 THEN
    RAISE EXCEPTION 'Impossibile rimuovere lo stato in_valutazione: % candidature ancora in questo stato', n;
  END IF;
END $$;

-- Nuovo CHECK constraint senza 'in_valutazione'
ALTER TABLE public.candidature DROP CONSTRAINT IF EXISTS candidature_stato_check;
ALTER TABLE public.candidature ADD CONSTRAINT candidature_stato_check
  CHECK (stato IN ('ricevuta','in_completamento','completata','approvata','rifiutata','ritirata','sostituita'));

-- Trigger function ridichiarata identica, senza 'in_valutazione' fra gli stati vietati
CREATE OR REPLACE FUNCTION public.candidature_check_stato_vs_assegnazione()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE ha_attiva BOOLEAN;
BEGIN
  IF OLD.stato = 'approvata'
     AND NEW.stato IN ('rifiutata','ritirata','ricevuta','in_completamento','completata') THEN
    SELECT EXISTS (SELECT 1 FROM public.assegnazioni WHERE candidatura_id = OLD.id AND stato = 'attiva') INTO ha_attiva;
    IF ha_attiva THEN
      RAISE EXCEPTION 'candidatura_con_assegnazione_attiva: chiudere prima l''assegnazione in Residenti';
    END IF;
  END IF;
  RETURN NEW;
END; $function$;