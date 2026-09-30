ALTER TABLE public.impostazioni
  ADD COLUMN fic_ei_metodo_pagamento text NOT NULL DEFAULT 'MP05'
  CHECK (fic_ei_metodo_pagamento ~ '^MP[0-9]{2}$');
COMMENT ON COLUMN public.impostazioni.fic_ei_metodo_pagamento IS
  'Codice SDI ModalitaPagamento (MP01..MP23) per ei_data.payment_method della fattura elettronica';