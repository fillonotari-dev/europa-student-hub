CREATE OR REPLACE FUNCTION public.consume_candidatura_upload_slot(p_temp_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_id uuid;
BEGIN
  UPDATE public.candidatura_sessioni
  SET upload_count = upload_count + 1
  WHERE temp_id = p_temp_id
    AND consumata_il IS NULL
    AND created_at > now() - interval '30 minutes'
    AND upload_count < 4
  RETURNING temp_id INTO updated_id;
  RETURN updated_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_candidatura_upload_slot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_candidatura_upload_slot(uuid) TO service_role;