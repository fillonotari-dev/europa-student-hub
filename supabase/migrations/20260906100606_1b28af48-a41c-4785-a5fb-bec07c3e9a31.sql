CREATE OR REPLACE FUNCTION public.fatture_protect_emesse()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
      RAISE EXCEPTION 'fattura_gia_emessa: la fattura e'' stata emessa; numero, data, importi, contratto e identificativo del documento non sono piu'' modificabili. Si possono aggiornare solo lo stato dell''invio elettronico e il link al documento';
    END IF;

    -- Da 'emessa' non esiste transizione legittima: il documento fiscale esiste
    -- e nessuno stato successivo lo descrive meglio. Debito lasciato aperto in D1.
    IF NEW.stato IS DISTINCT FROM OLD.stato THEN
      RAISE EXCEPTION 'fattura_gia_emessa: la fattura e'' emessa e il suo stato non puo'' piu'' essere cambiato';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;