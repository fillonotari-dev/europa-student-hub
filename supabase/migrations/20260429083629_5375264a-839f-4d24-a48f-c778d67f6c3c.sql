-- Tabella campi custom del form di candidatura
CREATE TABLE public.form_campi_custom (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chiave text NOT NULL UNIQUE,
  tipo text NOT NULL CHECK (tipo IN ('text','textarea','number','date','boolean','select','multiselect')),
  label_it text NOT NULL,
  label_en text NOT NULL,
  descrizione_it text,
  descrizione_en text,
  opzioni jsonb,
  obbligatorio boolean NOT NULL DEFAULT false,
  attivo boolean NOT NULL DEFAULT true,
  ordine integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.form_campi_custom ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access form_campi_custom"
  ON public.form_campi_custom FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public read attivi form_campi_custom"
  ON public.form_campi_custom FOR SELECT TO anon
  USING (attivo = true);

CREATE TRIGGER update_form_campi_custom_updated_at
  BEFORE UPDATE ON public.form_campi_custom
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabella documenti custom del form di candidatura
CREATE TABLE public.form_documenti_custom (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chiave text NOT NULL UNIQUE,
  label_it text NOT NULL,
  label_en text NOT NULL,
  descrizione_it text,
  descrizione_en text,
  obbligatorio boolean NOT NULL DEFAULT false,
  attivo boolean NOT NULL DEFAULT true,
  ordine integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.form_documenti_custom ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access form_documenti_custom"
  ON public.form_documenti_custom FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public read attivi form_documenti_custom"
  ON public.form_documenti_custom FOR SELECT TO anon
  USING (attivo = true);

CREATE TRIGGER update_form_documenti_custom_updated_at
  BEFORE UPDATE ON public.form_documenti_custom
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Colonna risposte_custom su candidature
ALTER TABLE public.candidature
  ADD COLUMN risposte_custom jsonb NOT NULL DEFAULT '{}'::jsonb;