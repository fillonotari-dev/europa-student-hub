-- Domini stato (idempotenti)
ALTER TABLE public.candidature DROP CONSTRAINT IF EXISTS candidature_stato_check;
ALTER TABLE public.candidature ADD CONSTRAINT candidature_stato_check
  CHECK (stato IN ('ricevuta','in_valutazione','in_completamento','completata','approvata','rifiutata','ritirata','sostituita'));

ALTER TABLE public.assegnazioni DROP CONSTRAINT IF EXISTS assegnazioni_stato_check;
ALTER TABLE public.assegnazioni ADD CONSTRAINT assegnazioni_stato_check
  CHECK (stato IN ('attiva','conclusa','annullata'));

ALTER TABLE public.camere DROP CONSTRAINT IF EXISTS camere_stato_check;
ALTER TABLE public.camere ADD CONSTRAINT camere_stato_check
  CHECK (stato IN ('libera','parzialmente_occupata','occupata','manutenzione','non_disponibile'));

CREATE UNIQUE INDEX IF NOT EXISTS assegnazioni_camera_posto_attive_uq
  ON public.assegnazioni (camera_id, posto) WHERE stato = 'attiva';

-- Trigger A
CREATE OR REPLACE FUNCTION public.camere_check_posti()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE occ INTEGER;
BEGIN
  IF NEW.posti IS DISTINCT FROM OLD.posti THEN
    SELECT count(*) INTO occ FROM public.assegnazioni WHERE camera_id = NEW.id AND stato = 'attiva';
    IF NEW.posti < occ THEN
      RAISE EXCEPTION 'posti_inferiori_a_occupanti: la camera ha % occupanti attivi, impossibile impostare posti=%', occ, NEW.posti;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_camere_check_posti ON public.camere;
CREATE TRIGGER trg_camere_check_posti BEFORE UPDATE ON public.camere
FOR EACH ROW EXECUTE FUNCTION public.camere_check_posti();

-- Trigger B
CREATE OR REPLACE FUNCTION public.assegnazioni_check_overbooking()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE cam RECORD; attive INTEGER;
BEGIN
  IF NEW.stato <> 'attiva' THEN RETURN NEW; END IF;
  SELECT posti, stato INTO cam FROM public.camere WHERE id = NEW.camera_id;
  IF cam IS NULL THEN RAISE EXCEPTION 'camera_inesistente'; END IF;
  IF NEW.posto < 1 OR NEW.posto > cam.posti THEN
    RAISE EXCEPTION 'posto_fuori_range: la camera ha % posti, ricevuto posto=%', cam.posti, NEW.posto;
  END IF;
  IF cam.stato IN ('manutenzione','non_disponibile') THEN
    RAISE EXCEPTION 'camera_non_disponibile: la camera è in stato %', cam.stato;
  END IF;
  SELECT count(*) INTO attive FROM public.assegnazioni
    WHERE camera_id = NEW.camera_id AND stato = 'attiva' AND id <> NEW.id;
  IF attive >= cam.posti THEN
    RAISE EXCEPTION 'overbooking: camera già piena (% / %)', attive, cam.posti;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_assegnazioni_check_overbooking ON public.assegnazioni;
CREATE TRIGGER trg_assegnazioni_check_overbooking BEFORE INSERT OR UPDATE ON public.assegnazioni
FOR EACH ROW EXECUTE FUNCTION public.assegnazioni_check_overbooking();

-- Trigger C
CREATE OR REPLACE FUNCTION public.candidature_check_stato_vs_assegnazione()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE ha_attiva BOOLEAN;
BEGIN
  IF OLD.stato = 'approvata'
     AND NEW.stato IN ('rifiutata','ritirata','in_valutazione','ricevuta','in_completamento','completata') THEN
    SELECT EXISTS (SELECT 1 FROM public.assegnazioni WHERE candidatura_id = OLD.id AND stato = 'attiva') INTO ha_attiva;
    IF ha_attiva THEN
      RAISE EXCEPTION 'candidatura_con_assegnazione_attiva: chiudere prima l''assegnazione in Residenti';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_candidature_check_stato ON public.candidature;
CREATE TRIGGER trg_candidature_check_stato BEFORE UPDATE OF stato ON public.candidature
FOR EACH ROW EXECUTE FUNCTION public.candidature_check_stato_vs_assegnazione();

-- Trigger E: log auto
CREATE OR REPLACE FUNCTION public.candidature_log_stato()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.stato IS DISTINCT FROM NEW.stato THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.log_stato_candidature
      WHERE candidatura_id = NEW.id
        AND stato_nuovo = NEW.stato
        AND stato_precedente IS NOT DISTINCT FROM OLD.stato
        AND created_at > now() - interval '5 seconds'
    ) THEN
      INSERT INTO public.log_stato_candidature
        (candidatura_id, stato_precedente, stato_nuovo, cambiato_da)
      VALUES (NEW.id, OLD.stato, NEW.stato, auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_candidature_log_stato ON public.candidature;
CREATE TRIGGER trg_candidature_log_stato AFTER UPDATE OF stato ON public.candidature
FOR EACH ROW EXECUTE FUNCTION public.candidature_log_stato();

-- Trigger F: sync stato camera
CREATE OR REPLACE FUNCTION public.camere_sync_stato()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE cam_id UUID; attive INTEGER; posti_tot INTEGER; stato_attuale TEXT; nuovo TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN cam_id := OLD.camera_id; ELSE cam_id := NEW.camera_id; END IF;
  SELECT posti, stato INTO posti_tot, stato_attuale FROM public.camere WHERE id = cam_id;
  IF posti_tot IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF stato_attuale IN ('manutenzione','non_disponibile') THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT count(*) INTO attive FROM public.assegnazioni WHERE camera_id = cam_id AND stato = 'attiva';
  IF attive = 0 THEN nuovo := 'libera';
  ELSIF attive >= posti_tot THEN nuovo := 'occupata';
  ELSE nuovo := 'parzialmente_occupata';
  END IF;
  IF nuovo <> stato_attuale THEN UPDATE public.camere SET stato = nuovo WHERE id = cam_id; END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_assegnazioni_sync_stato ON public.assegnazioni;
CREATE TRIGGER trg_assegnazioni_sync_stato AFTER INSERT OR UPDATE OR DELETE ON public.assegnazioni
FOR EACH ROW EXECUTE FUNCTION public.camere_sync_stato();
