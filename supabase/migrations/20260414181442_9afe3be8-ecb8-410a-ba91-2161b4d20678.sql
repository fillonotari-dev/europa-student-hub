
-- Roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'studente');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Admins can read roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Strutture
CREATE TABLE public.strutture (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  indirizzo TEXT,
  piani INTEGER,
  attiva BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.strutture ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_strutture_updated_at BEFORE UPDATE ON public.strutture FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Admins full access strutture" ON public.strutture FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read strutture" ON public.strutture FOR SELECT TO anon USING (attiva = true);

-- Camere
CREATE TABLE public.camere (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  struttura_id UUID REFERENCES public.strutture(id) NOT NULL,
  numero TEXT NOT NULL,
  piano INTEGER,
  tipo TEXT NOT NULL CHECK (tipo IN ('singola', 'doppia')),
  posti INTEGER NOT NULL CHECK (posti IN (1, 2)),
  stato TEXT DEFAULT 'libera' CHECK (stato IN ('libera', 'parzialmente_occupata', 'occupata', 'manutenzione')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.camere ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_camere_updated_at BEFORE UPDATE ON public.camere FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Admins full access camere" ON public.camere FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Studenti
CREATE TABLE public.studenti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id),
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  telefono TEXT,
  data_nascita DATE,
  nazionalita TEXT,
  codice_fiscale TEXT,
  universita TEXT,
  corso_di_studi TEXT,
  anno_di_corso TEXT,
  matricola TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.studenti ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_studenti_updated_at BEFORE UPDATE ON public.studenti FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Admins full access studenti" ON public.studenti FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Candidature
CREATE TABLE public.candidature (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studente_id UUID REFERENCES public.studenti(id) NOT NULL,
  stato TEXT DEFAULT 'ricevuta' CHECK (stato IN ('ricevuta', 'in_valutazione', 'approvata', 'rifiutata', 'ritirata', 'sostituita')),
  struttura_preferita_id UUID REFERENCES public.strutture(id),
  tipo_camera_preferito TEXT CHECK (tipo_camera_preferito IS NULL OR tipo_camera_preferito IN ('singola', 'doppia')),
  periodo_inizio DATE,
  periodo_fine DATE,
  anno_accademico TEXT,
  universita_snapshot TEXT,
  corso_snapshot TEXT,
  anno_corso_snapshot TEXT,
  matricola_snapshot TEXT,
  messaggio TEXT,
  note_admin TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.candidature ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_candidature_updated_at BEFORE UPDATE ON public.candidature FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Admins full access candidature" ON public.candidature FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Assegnazioni
CREATE TABLE public.assegnazioni (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studente_id UUID REFERENCES public.studenti(id) NOT NULL,
  candidatura_id UUID REFERENCES public.candidature(id) NOT NULL,
  camera_id UUID REFERENCES public.camere(id) NOT NULL,
  posto INTEGER NOT NULL CHECK (posto IN (1, 2)),
  data_inizio DATE,
  data_fine DATE,
  stato TEXT DEFAULT 'attiva' CHECK (stato IN ('attiva', 'conclusa', 'annullata')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.assegnazioni ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_assegnazioni_updated_at BEFORE UPDATE ON public.assegnazioni FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Admins full access assegnazioni" ON public.assegnazioni FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Documenti
CREATE TABLE public.documenti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studente_id UUID REFERENCES public.studenti(id) NOT NULL,
  candidatura_id UUID REFERENCES public.candidature(id),
  tipo TEXT CHECK (tipo IN ('documento_identita', 'certificato_iscrizione', 'altro')),
  nome_file TEXT NOT NULL,
  url TEXT NOT NULL,
  caricato_da TEXT DEFAULT 'studente' CHECK (caricato_da IN ('studente', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.documenti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access documenti" ON public.documenti FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Log stato candidature
CREATE TABLE public.log_stato_candidature (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidatura_id UUID REFERENCES public.candidature(id) NOT NULL,
  stato_precedente TEXT,
  stato_nuovo TEXT NOT NULL,
  cambiato_da UUID,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.log_stato_candidature ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access log" ON public.log_stato_candidature FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for student documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documenti_studenti', 'documenti_studenti', false);

-- Anyone can upload to the bucket (for the public form via edge function)
CREATE POLICY "Public upload documenti" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'documenti_studenti');
CREATE POLICY "Auth upload documenti" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documenti_studenti');

-- Only admins can read/download
CREATE POLICY "Admins read documenti" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documenti_studenti' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete documenti" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documenti_studenti' AND public.has_role(auth.uid(), 'admin'));
