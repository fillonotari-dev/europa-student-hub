## Migrazione: rimozione policy storage residua

Chiudere la falla RLS sul bucket `documenti_studenti` e allineare i limiti del bucket ai controlli già presenti nell'edge function `upload-candidatura-doc`.

### SQL

```sql
DROP POLICY IF EXISTS "Public upload documenti" ON storage.objects;

UPDATE storage.buckets
SET file_size_limit    = 10485760,
    allowed_mime_types = ARRAY['application/pdf','image/jpeg','image/png','image/webp']
WHERE id = 'documenti_studenti';
```

### Note

- La policy "Auth upload documenti" (admin autenticati) resta invariata.
- Le policy di lettura restano invariate.
- Nessun cambio applicativo: entrambi i form caricano già tramite l'edge function `upload-candidatura-doc` con `service_role`, che bypassa RLS.
- Dopo la migrazione, rieseguire il linter per confermare la chiusura del finding.
