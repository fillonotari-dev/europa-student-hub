ALTER TABLE public.impostazioni
  ADD COLUMN IF NOT EXISTS fic_emette_fatture boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.impostazioni.fic_emette_fatture IS
  'false = documenti proforma senza scritture locali; true = fatture reali, flag e_invoice e scritture in fatture/canoni.';