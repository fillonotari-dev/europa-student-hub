
ALTER TABLE public.candidature
  ADD COLUMN IF NOT EXISTS versione_form text NOT NULL DEFAULT 'pre_screening',
  ADD COLUMN IF NOT EXISTS completata_il timestamptz,
  ADD COLUMN IF NOT EXISTS completamento_token_hash text,
  ADD COLUMN IF NOT EXISTS token_scade_il timestamptz,
  ADD COLUMN IF NOT EXISTS dichiarazioni jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS indirizzo_residenza text,
  ADD COLUMN IF NOT EXISTS documento_identita_n text,
  ADD COLUMN IF NOT EXISTS tipo_studente text,
  ADD COLUMN IF NOT EXISTS tipo_studente_altro text,
  ADD COLUMN IF NOT EXISTS data_arrivo_prevista date,
  ADD COLUMN IF NOT EXISTS come_conosciuto text,
  ADD COLUMN IF NOT EXISTS come_conosciuto_altro text,
  ADD COLUMN IF NOT EXISTS preferenze_note text,
  ADD COLUMN IF NOT EXISTS lingue_parlate text,
  ADD COLUMN IF NOT EXISTS orari text,
  ADD COLUMN IF NOT EXISTS personalita text,
  ADD COLUMN IF NOT EXISTS personalita_altro text,
  ADD COLUMN IF NOT EXISTS ordine_pulizia text,
  ADD COLUMN IF NOT EXISTS fumatore boolean,
  ADD COLUMN IF NOT EXISTS presentazione text,
  ADD COLUMN IF NOT EXISTS garante_nome text,
  ADD COLUMN IF NOT EXISTS garante_relazione text,
  ADD COLUMN IF NOT EXISTS garante_telefono text,
  ADD COLUMN IF NOT EXISTS garante_email text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_candidature_token_hash
  ON public.candidature(completamento_token_hash)
  WHERE completamento_token_hash IS NOT NULL;

ALTER TABLE public.form_campi_custom
  ADD COLUMN IF NOT EXISTS fase text NOT NULL DEFAULT 'pre_screening';

ALTER TABLE public.form_documenti_custom
  ADD COLUMN IF NOT EXISTS fase text NOT NULL DEFAULT 'pre_screening';
