CREATE TABLE public.fic_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  operazione text NOT NULL,
  metodo text NOT NULL,
  endpoint text NOT NULL,
  http_status integer,
  esito text NOT NULL,
  messaggio text,
  payload_ridotto jsonb
);

COMMENT ON TABLE public.fic_log IS 'Registro delle chiamate verso Fatture in Cloud. Scrive solo il server (service_role); l''applicazione legge soltanto. Il token non deve mai finire in questa tabella.';

GRANT SELECT ON public.fic_log TO authenticated;
GRANT ALL ON public.fic_log TO service_role;

ALTER TABLE public.fic_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read fic_log"
  ON public.fic_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));