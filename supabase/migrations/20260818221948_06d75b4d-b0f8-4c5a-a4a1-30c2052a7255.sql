-- ============================================================
-- Contratti, scadenzario, deposito e anagrafica di fatturazione
-- Migration puramente additiva.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ------------------------------------------------------------
-- 1. anagrafiche_fatturazione
-- ------------------------------------------------------------
CREATE TABLE public.anagrafiche_fatturazione (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  denominazione text,
  nome text,
  cognome text,
  codice_fiscale text,
  partita_iva text,
  indirizzo_via text,
  indirizzo_civico text,
  indirizzo_cap text,
  indirizzo_comune text,
  indirizzo_provincia text,
  indirizzo_nazione text NOT NULL DEFAULT 'IT',
  codice_destinatario text,
  pec text,
  email_recapito text,
  studente_id uuid REFERENCES public.studenti(id),
  fic_entity_id bigint,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT anagrafiche_fatt_tipo_chk
    CHECK (tipo IN ('persona_fisica','soggetto_giuridico')),
  CONSTRAINT anagrafiche_fatt_nominativo_chk CHECK (
    (tipo = 'persona_fisica' AND nome IS NOT NULL AND cognome IS NOT NULL)
    OR (tipo = 'soggetto_giuridico' AND denominazione IS NOT NULL)
  ),
  CONSTRAINT anagrafiche_fatt_cod_dest_chk
    CHECK (codice_destinatario IS NULL OR codice_destinatario ~ '^[A-Z0-9]{7}$')
);

CREATE UNIQUE INDEX anagrafiche_fatt_studente_uniq
  ON public.anagrafiche_fatturazione (studente_id)
  WHERE studente_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.anagrafiche_fatturazione TO authenticated;
GRANT ALL ON public.anagrafiche_fatturazione TO service_role;
ALTER TABLE public.anagrafiche_fatturazione ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access anagrafiche_fatturazione"
  ON public.anagrafiche_fatturazione FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_anagrafiche_fatturazione_updated_at
  BEFORE UPDATE ON public.anagrafiche_fatturazione
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 2. contratti (include l'intero ciclo del deposito)
-- ------------------------------------------------------------
CREATE TABLE public.contratti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studente_id uuid NOT NULL REFERENCES public.studenti(id),
  assegnazione_id uuid REFERENCES public.assegnazioni(id),
  struttura_id uuid NOT NULL REFERENCES public.strutture(id),
  anagrafica_fatturazione_id uuid NOT NULL REFERENCES public.anagrafiche_fatturazione(id),
  tipo text NOT NULL,
  data_inizio date NOT NULL,
  data_fine date NOT NULL,
  canone_mensile numeric(10,2) NOT NULL,
  canone_note text,
  aliquota_iva numeric(4,2) NOT NULL DEFAULT 10.00,
  deposito_richiesto boolean NOT NULL DEFAULT true,
  deposito_importo numeric(10,2),
  deposito_motivo_esenzione text,
  deposito_stato text,
  deposito_data_incasso date,
  deposito_modalita text,
  deposito_importo_restituito numeric(10,2),
  deposito_motivo_trattenuta text,
  garante_nome text,
  garante_relazione text,
  garante_telefono text,
  garante_email text,
  stato text NOT NULL DEFAULT 'bozza',
  contratto_precedente_id uuid REFERENCES public.contratti(id),
  file_firmato_path text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contratti_tipo_chk CHECK (tipo IN ('breve','lunga')),
  CONSTRAINT contratti_stato_chk
    CHECK (stato IN ('bozza','attivo','scaduto','risolto','rinnovato')),
  CONSTRAINT contratti_periodo_chk CHECK (data_fine > data_inizio),
  CONSTRAINT contratti_durata_max_chk
    CHECK (data_fine <= (data_inizio + INTERVAL '12 months' - INTERVAL '1 day')::date),
  CONSTRAINT contratti_canone_chk CHECK (canone_mensile >= 0),
  CONSTRAINT contratti_deposito_stato_chk CHECK (
    deposito_stato IS NULL
    OR deposito_stato IN ('atteso','incassato','da_restituire','restituito','trattenuto')
  ),
  CONSTRAINT contratti_deposito_coerenza_chk CHECK (
    (deposito_richiesto
      AND deposito_importo IS NOT NULL AND deposito_importo > 0
      AND deposito_stato IS NOT NULL
      AND deposito_motivo_esenzione IS NULL)
    OR
    (NOT deposito_richiesto
      AND deposito_importo IS NULL
      AND deposito_stato IS NULL
      AND deposito_motivo_esenzione IS NOT NULL)
  )
);

CREATE INDEX contratti_studente_idx ON public.contratti (studente_id);
CREATE INDEX contratti_struttura_idx ON public.contratti (struttura_id);
CREATE INDEX contratti_assegnazione_idx ON public.contratti (assegnazione_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratti TO authenticated;
GRANT ALL ON public.contratti TO service_role;
ALTER TABLE public.contratti ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access contratti"
  ON public.contratti FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_contratti_updated_at
  BEFORE UPDATE ON public.contratti
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 3. canoni (scadenzario)
-- ------------------------------------------------------------
CREATE TABLE public.canoni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contratto_id uuid NOT NULL REFERENCES public.contratti(id) ON DELETE CASCADE,
  competenza date NOT NULL,
  imponibile numeric(10,2) NOT NULL,
  aliquota_iva numeric(4,2) NOT NULL,
  totale numeric(10,2) GENERATED ALWAYS AS
    (round(imponibile * (1 + aliquota_iva / 100), 2)) STORED,
  scadenza date NOT NULL,
  stato text NOT NULL DEFAULT 'da_fatturare',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT canoni_competenza_chk CHECK (extract(day from competenza) = 1),
  CONSTRAINT canoni_imponibile_chk CHECK (imponibile >= 0),
  CONSTRAINT canoni_stato_chk
    CHECK (stato IN ('da_fatturare','fatturato','incassato','annullato')),
  CONSTRAINT canoni_contratto_competenza_uniq UNIQUE (contratto_id, competenza)
);

CREATE INDEX canoni_scadenza_idx ON public.canoni (scadenza);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.canoni TO authenticated;
GRANT ALL ON public.canoni TO service_role;
ALTER TABLE public.canoni ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access canoni"
  ON public.canoni FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_canoni_updated_at
  BEFORE UPDATE ON public.canoni
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 4. listini
-- ------------------------------------------------------------
CREATE TABLE public.listini (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  struttura_id uuid NOT NULL REFERENCES public.strutture(id),
  tipo_camera text NOT NULL,
  importo_mensile numeric(10,2) NOT NULL,
  valido_dal date NOT NULL,
  valido_al date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listini_tipo_camera_chk CHECK (tipo_camera IN ('singola','doppia')),
  CONSTRAINT listini_importo_chk CHECK (importo_mensile >= 0),
  CONSTRAINT listini_validita_chk CHECK (valido_al IS NULL OR valido_al >= valido_dal),
  CONSTRAINT listini_no_overlap EXCLUDE USING gist (
    struttura_id WITH =,
    tipo_camera WITH =,
    daterange(valido_dal, valido_al, '[]') WITH &&
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listini TO authenticated;
GRANT ALL ON public.listini TO service_role;
ALTER TABLE public.listini ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access listini"
  ON public.listini FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ------------------------------------------------------------
-- Regola a: una mensilità fatturata/incassata non si riscrive
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.canoni_protect_fatturati()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.stato IN ('fatturato','incassato') THEN
      RAISE EXCEPTION 'canone_gia_fatturato: la mensilità è in stato % e corrisponde a un documento fiscale emesso; non può essere cancellata', OLD.stato;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.stato IN ('fatturato','incassato') THEN
    IF NEW.contratto_id IS DISTINCT FROM OLD.contratto_id
       OR NEW.competenza IS DISTINCT FROM OLD.competenza
       OR NEW.imponibile IS DISTINCT FROM OLD.imponibile
       OR NEW.aliquota_iva IS DISTINCT FROM OLD.aliquota_iva
       OR NEW.scadenza IS DISTINCT FROM OLD.scadenza
       OR NEW.id IS DISTINCT FROM OLD.id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'canone_gia_fatturato: la mensilità è in stato % e corrisponde a un documento fiscale emesso; si possono aggiornare solo le note e registrare l''incasso', OLD.stato;
    END IF;

    IF NEW.stato IS DISTINCT FROM OLD.stato
       AND NOT (OLD.stato = 'fatturato' AND NEW.stato = 'incassato') THEN
      RAISE EXCEPTION 'canone_transizione_non_ammessa: da % è ammesso solo il passaggio a incassato', OLD.stato;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_canoni_protect_fatturati
  BEFORE UPDATE OR DELETE ON public.canoni
  FOR EACH ROW EXECUTE FUNCTION public.canoni_protect_fatturati();

-- ------------------------------------------------------------
-- Regola b: un contratto si cancella solo se è ancora bozza
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contratti_protect_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.stato <> 'bozza' THEN
    RAISE EXCEPTION 'contratto_non_in_bozza: il contratto è in stato % e non può essere cancellato; usare uno stato di chiusura (risolto, scaduto)', OLD.stato;
  END IF;
  RETURN OLD;
END;
$function$;

CREATE TRIGGER trg_contratti_protect_delete
  BEFORE DELETE ON public.contratti
  FOR EACH ROW EXECUTE FUNCTION public.contratti_protect_delete();