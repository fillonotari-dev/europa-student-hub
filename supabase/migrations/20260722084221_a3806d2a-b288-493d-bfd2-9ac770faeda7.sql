
ALTER TABLE public.candidature
  ADD COLUMN IF NOT EXISTS lingua text NOT NULL DEFAULT 'it',
  ADD COLUMN IF NOT EXISTS esito_email_stato text,
  ADD COLUMN IF NOT EXISTS esito_email_nota text,
  ADD COLUMN IF NOT EXISTS esito_email_inviata_il timestamptz;

ALTER TABLE public.candidature
  DROP CONSTRAINT IF EXISTS candidature_lingua_check;
ALTER TABLE public.candidature
  ADD CONSTRAINT candidature_lingua_check CHECK (lingua IN ('it','en'));

ALTER TABLE public.candidature
  DROP CONSTRAINT IF EXISTS candidature_esito_email_stato_check;
ALTER TABLE public.candidature
  ADD CONSTRAINT candidature_esito_email_stato_check
  CHECK (esito_email_stato IS NULL OR esito_email_stato IN ('da_inviare','inviata'));

CREATE OR REPLACE FUNCTION public.candidature_flag_esito_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.stato IS DISTINCT FROM OLD.stato
     AND NEW.stato IN ('approvata','rifiutata') THEN
    NEW.esito_email_stato := 'da_inviare';
    NEW.esito_email_nota := NULL;
    NEW.esito_email_inviata_il := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_candidature_flag_esito_email ON public.candidature;
CREATE TRIGGER trg_candidature_flag_esito_email
BEFORE UPDATE OF stato ON public.candidature
FOR EACH ROW
EXECUTE FUNCTION public.candidature_flag_esito_email();
