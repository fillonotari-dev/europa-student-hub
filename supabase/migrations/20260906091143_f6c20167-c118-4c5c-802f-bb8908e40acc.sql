ALTER TABLE public.impostazioni
  ADD COLUMN IF NOT EXISTS fic_metodo_pagamento_id integer NULL,
  ADD COLUMN IF NOT EXISTS fic_vat_id integer NULL,
  ADD COLUMN IF NOT EXISTS fic_vat_valore numeric NULL;

COMMENT ON COLUMN public.impostazioni.fic_metodo_pagamento_id IS 'Id del metodo di pagamento nel registro dell''azienda su Fatture in Cloud: payment_method.id, unico parametro accettato dal documento.';
COMMENT ON COLUMN public.impostazioni.fic_vat_id IS 'Id dell''aliquota IVA nel registro dell''azienda su Fatture in Cloud: vat.id della riga documento.';
COMMENT ON COLUMN public.impostazioni.fic_vat_valore IS 'Valore percentuale dell''aliquota scelta: deve coincidere con canoni.aliquota_iva, altrimenti l''emissione si ferma.';