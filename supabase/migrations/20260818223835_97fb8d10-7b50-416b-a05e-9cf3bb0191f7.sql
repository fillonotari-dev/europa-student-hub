ALTER TABLE public.contratti
  ADD COLUMN giorno_scadenza smallint NOT NULL DEFAULT 1
    CHECK (giorno_scadenza BETWEEN 1 AND 28);

ALTER TABLE public.contratti DROP COLUMN tipo;

CREATE POLICY "Admin legge contratti firmati"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'contratti' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin carica contratti firmati"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'contratti'
  AND public.has_role(auth.uid(), 'admin'::app_role)
  AND lower(storage.extension(name)) = 'pdf'
);

CREATE POLICY "Admin aggiorna contratti firmati"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'contratti' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (
  bucket_id = 'contratti'
  AND public.has_role(auth.uid(), 'admin'::app_role)
  AND lower(storage.extension(name)) = 'pdf'
);

CREATE POLICY "Admin elimina contratti firmati"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'contratti' AND public.has_role(auth.uid(), 'admin'::app_role));