CREATE TABLE public.impostazioni (
  id                smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  contatto_email    text,
  contatto_telefono text,
  contatto_whatsapp text,
  contatto_orari    text,
  notifica_email    text,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.impostazioni TO authenticated;
GRANT ALL ON public.impostazioni TO service_role;

ALTER TABLE public.impostazioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "impostazioni_admin_all"
  ON public.impostazioni
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_impostazioni_updated_at
  BEFORE UPDATE ON public.impostazioni
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.impostazioni (id, notifica_email)
  VALUES (1, 'studentatoeuropa@gmail.com')
  ON CONFLICT (id) DO NOTHING;