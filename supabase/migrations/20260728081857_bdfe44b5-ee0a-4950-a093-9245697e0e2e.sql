ALTER TABLE public.assegnazioni
  DROP CONSTRAINT IF EXISTS assegnazioni_motivo_chiusura_chk;

ALTER TABLE public.assegnazioni
  ADD CONSTRAINT assegnazioni_motivo_chiusura_chk CHECK (
    (stato = 'conclusa' AND motivo_chiusura = ANY (ARRAY[
      'fine_naturale','partenza_anticipata','mai_arrivato','allontanato','trasferimento'
    ]))
    OR (stato = 'attiva' AND motivo_chiusura IS NULL)
  );