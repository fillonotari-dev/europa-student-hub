ALTER TABLE public.candidature
  ADD COLUMN origine text NOT NULL DEFAULT 'form_pubblico';

ALTER TABLE public.candidature
  ADD CONSTRAINT candidature_origine_chk
  CHECK (origine IN ('form_pubblico', 'inserimento_manuale'));

CREATE OR REPLACE FUNCTION public.crea_persona_manuale(
  p_studente jsonb,
  p_candidatura jsonb,
  p_assegnazione jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_studente_id uuid;
  v_candidatura_id uuid;
  v_assegnazione_id uuid;
BEGIN
  IF p_studente IS NULL OR jsonb_typeof(p_studente) <> 'object' THEN
    RAISE EXCEPTION 'dati_persona_mancanti: indicare i dati della persona';
  END IF;
  IF p_candidatura IS NULL OR jsonb_typeof(p_candidatura) <> 'object' THEN
    RAISE EXCEPTION 'dati_candidatura_mancanti: indicare i dati della candidatura';
  END IF;
  IF NULLIF(trim(p_studente->>'nome'), '') IS NULL
     OR NULLIF(trim(p_studente->>'cognome'), '') IS NULL
     OR NULLIF(trim(p_studente->>'email'), '') IS NULL THEN
    RAISE EXCEPTION 'dati_persona_incompleti: nome, cognome ed email sono obbligatori';
  END IF;

  INSERT INTO public.studenti (
    nome, cognome, email, telefono, data_nascita, nazionalita,
    codice_fiscale, cf_non_disponibile,
    indirizzo_via, indirizzo_civico, indirizzo_cap, indirizzo_comune,
    indirizzo_provincia, indirizzo_nazione,
    universita, corso_di_studi, anno_di_corso, matricola, email_fattura
  )
  VALUES (
    trim(p_studente->>'nome'),
    trim(p_studente->>'cognome'),
    lower(trim(p_studente->>'email')),
    NULLIF(trim(p_studente->>'telefono'), ''),
    NULLIF(trim(p_studente->>'data_nascita'), '')::date,
    NULLIF(trim(p_studente->>'nazionalita'), ''),
    NULLIF(trim(p_studente->>'codice_fiscale'), ''),
    COALESCE((p_studente->>'cf_non_disponibile')::boolean, false),
    NULLIF(trim(p_studente->>'indirizzo_via'), ''),
    NULLIF(trim(p_studente->>'indirizzo_civico'), ''),
    NULLIF(trim(p_studente->>'indirizzo_cap'), ''),
    NULLIF(trim(p_studente->>'indirizzo_comune'), ''),
    NULLIF(trim(p_studente->>'indirizzo_provincia'), ''),
    NULLIF(trim(p_studente->>'indirizzo_nazione'), ''),
    NULLIF(trim(p_studente->>'universita'), ''),
    NULLIF(trim(p_studente->>'corso_di_studi'), ''),
    NULLIF(trim(p_studente->>'anno_di_corso'), ''),
    NULLIF(trim(p_studente->>'matricola'), ''),
    NULLIF(trim(p_studente->>'email_fattura'), '')
  )
  RETURNING id INTO v_studente_id;

  INSERT INTO public.candidature (
    studente_id, stato, origine, versione_form, lingua,
    struttura_preferita_id, tipo_camera_preferito,
    periodo_inizio, periodo_fine, anno_accademico,
    note_admin, messaggio, priorita
  )
  VALUES (
    v_studente_id, 'accolta', 'inserimento_manuale', 'pre_screening',
    COALESCE(p_candidatura->>'lingua', 'it'),
    NULLIF(trim(p_candidatura->>'struttura_preferita_id'), '')::uuid,
    NULLIF(trim(p_candidatura->>'tipo_camera_preferito'), ''),
    NULLIF(trim(p_candidatura->>'periodo_inizio'), '')::date,
    NULLIF(trim(p_candidatura->>'periodo_fine'), '')::date,
    NULLIF(trim(p_candidatura->>'anno_accademico'), ''),
    NULLIF(trim(p_candidatura->>'note_admin'), ''),
    NULLIF(trim(p_candidatura->>'messaggio'), ''),
    NULLIF(trim(p_candidatura->>'priorita'), '')::integer
  )
  RETURNING id INTO v_candidatura_id;

  INSERT INTO public.log_stato_candidature (
    candidatura_id, stato_precedente, stato_nuovo, cambiato_da, note
  )
  VALUES (
    v_candidatura_id, NULL, 'accolta', auth.uid(),
    'Persona inserita manualmente dall''amministrazione'
  );

  IF p_assegnazione IS NOT NULL THEN
    IF jsonb_typeof(p_assegnazione) <> 'object' THEN
      RAISE EXCEPTION 'dati_assegnazione_non_validi: l''assegnazione non e'' nel formato atteso';
    END IF;
    IF NULLIF(trim(p_assegnazione->>'data_inizio'), '') IS NULL THEN
      RAISE EXCEPTION 'data_inizio_mancante: indicare la data di inizio dell''assegnazione';
    END IF;

    INSERT INTO public.assegnazioni (
      studente_id, candidatura_id, camera_id, posto,
      data_inizio, data_fine, stato, note
    )
    VALUES (
      v_studente_id, v_candidatura_id,
      NULLIF(trim(p_assegnazione->>'camera_id'), '')::uuid,
      NULLIF(trim(p_assegnazione->>'posto'), '')::integer,
      (p_assegnazione->>'data_inizio')::date,
      NULLIF(trim(p_assegnazione->>'data_fine'), '')::date,
      'attiva',
      NULLIF(trim(p_assegnazione->>'note'), '')
    )
    RETURNING id INTO v_assegnazione_id;
  END IF;

  RETURN jsonb_build_object(
    'studente_id', v_studente_id,
    'candidatura_id', v_candidatura_id,
    'assegnazione_id', v_assegnazione_id
  );

EXCEPTION
  WHEN unique_violation THEN
    IF v_studente_id IS NULL THEN
      RAISE EXCEPTION 'esiste_gia_persona: esiste già una persona registrata con questa email';
    END IF;
    RAISE;
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'posto_occupato: il posto è già assegnato a un''altra persona nel periodo indicato';
END;
$function$;

REVOKE ALL ON FUNCTION public.crea_persona_manuale(jsonb, jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crea_persona_manuale(jsonb, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.crea_persona_manuale(jsonb, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.crea_persona_manuale(jsonb, jsonb, jsonb) TO authenticated;