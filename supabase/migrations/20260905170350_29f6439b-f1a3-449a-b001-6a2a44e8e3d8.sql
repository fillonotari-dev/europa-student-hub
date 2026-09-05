-- Registro fatture e impostazioni di emissione. Intervento additivo.
--
-- Stati non finali di public.fatture, distinzione da rispettare in fase di emissione:
--   'in_invio' = la chiamata a Fatture in Cloud e' partita e non sappiamo com'e' andata
--                (timeout, connessione caduta). Il documento POTREBBE esistere da remoto:
--                la riga va lasciata e riconciliata, mai riprovata alla cieca.
--   'errore'   = Fatture in Cloud ha rifiutato in modo definitivo (tipicamente 4xx di
--                validazione). Il documento SICURAMENTE non esiste: si corregge e si riprova.

CREATE TABLE public.fatture (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contratto_id uuid NOT NULL REFERENCES public.contratti(id),
  fic_document_id bigint,
  numero integer,
  numerazione text,
  data date,
  imponibile numeric(10,2) NOT NULL,
  iva numeric(10,2) NOT NULL,
  totale numeric(10,2) NOT NULL,
  ei_status text,
  url_documento text,
  stato text NOT NULL CHECK (stato IN ('in_invio','emessa','errore')),
  messaggio_errore text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fatture_importi_coerenti CHECK (totale = imponibile + iva),
  CONSTRAINT fatture_id_contratto_uniq UNIQUE (id, contratto_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fatture TO authenticated;
GRANT ALL ON public.fatture TO service_role;

ALTER TABLE public.fatture ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gestisce le fatture"
ON public.fatture FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX fatture_fic_document_id_uniq
ON public.fatture (fic_document_id)
WHERE fic_document_id IS NOT NULL;

CREATE TRIGGER update_fatture_updated_at
BEFORE UPDATE ON public.fatture
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Una fattura emessa corrisponde a un documento fiscale reale: non si cancella
-- e non si riscrive. Restano modificabili ei_status e url_documento, che su
-- Fatture in Cloud cambiano dopo l'emissione.
CREATE OR REPLACE FUNCTION public.fatture_protect_emesse()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.stato = 'emessa' THEN
      RAISE EXCEPTION 'fattura_gia_emessa: la fattura e'' stata emessa e corrisponde a un documento fiscale reale; non puo'' essere cancellata';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.stato = 'emessa' THEN
    IF NEW.fic_document_id IS DISTINCT FROM OLD.fic_document_id
       OR NEW.numero IS DISTINCT FROM OLD.numero
       OR NEW.numerazione IS DISTINCT FROM OLD.numerazione
       OR NEW.data IS DISTINCT FROM OLD.data
       OR NEW.imponibile IS DISTINCT FROM OLD.imponibile
       OR NEW.iva IS DISTINCT FROM OLD.iva
       OR NEW.totale IS DISTINCT FROM OLD.totale
       OR NEW.contratto_id IS DISTINCT FROM OLD.contratto_id THEN
      RAISE EXCEPTION 'fattura_gia_emessa: la fattura e'' stata emessa; numero, data, importi, contratto e identificativo del documento non sono piu'' modificabili. Si possono aggiornare solo lo stato dell''''invio elettronico e il link al documento';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER fatture_protect_emesse
BEFORE UPDATE OR DELETE ON public.fatture
FOR EACH ROW EXECUTE FUNCTION public.fatture_protect_emesse();

-- Collegamento mensilita' -> fattura, vincolato allo stesso contratto dalla FK composta.
ALTER TABLE public.canoni ADD COLUMN fattura_id uuid;

ALTER TABLE public.canoni
ADD CONSTRAINT canoni_fattura_stesso_contratto_fkey
FOREIGN KEY (fattura_id, contratto_id)
REFERENCES public.fatture (id, contratto_id);

-- Aggiunta di fattura_id all'elenco delle colonne immutabili: una volta che la
-- mensilita' e' fatturata, il legame con il documento fiscale e' immutabile
-- quanto l'importo. Il collegamento avviene mentre lo stato e' ancora da_fatturare.
CREATE OR REPLACE FUNCTION public.canoni_protect_fatturati()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
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
       OR NEW.fattura_id IS DISTINCT FROM OLD.fattura_id
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
$$;

-- Impostazioni di emissione: solo ADD COLUMN sulla tabella a riga singola.
ALTER TABLE public.impostazioni ADD COLUMN fic_numerazione text DEFAULT '/S';
ALTER TABLE public.impostazioni ADD COLUMN fic_giorni_scadenza integer DEFAULT 30;
ALTER TABLE public.impostazioni ADD COLUMN fic_giorno_emissione integer DEFAULT 25;
ALTER TABLE public.impostazioni ADD COLUMN fic_iban text;
ALTER TABLE public.impostazioni ADD COLUMN fic_metodo_pagamento text DEFAULT 'bonifico';