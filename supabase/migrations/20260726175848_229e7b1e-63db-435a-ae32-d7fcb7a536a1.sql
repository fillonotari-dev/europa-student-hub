CREATE TABLE public.candidatura_sessioni (
  temp_id uuid PRIMARY KEY,
  origine text NOT NULL CHECK (origine IN ('pubblica','completamento')),
  created_at timestamptz NOT NULL DEFAULT now(),
  upload_count integer NOT NULL DEFAULT 0,
  consumata_il timestamptz
);

GRANT ALL ON public.candidatura_sessioni TO service_role;

ALTER TABLE public.candidatura_sessioni ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_candidatura_sessioni_created_at ON public.candidatura_sessioni (created_at);