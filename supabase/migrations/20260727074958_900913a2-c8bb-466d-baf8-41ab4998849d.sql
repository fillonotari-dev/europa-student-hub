DROP TABLE IF EXISTS public.form_campi_custom CASCADE;
DROP TABLE IF EXISTS public.form_documenti_custom CASCADE;

ALTER TABLE public.candidature DROP COLUMN IF EXISTS risposte_custom;

ALTER TABLE public.documenti DROP CONSTRAINT IF EXISTS documenti_tipo_check;
ALTER TABLE public.documenti ADD CONSTRAINT documenti_tipo_check
  CHECK (tipo IN ('documento_identita','certificato_iscrizione','documento_garante','documento_aggiuntivo'));