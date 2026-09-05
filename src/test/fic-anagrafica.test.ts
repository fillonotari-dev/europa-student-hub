import { describe, it, expect } from 'vitest';
import {
  campiMancantiPerFicSync,
  campiMancantiPerFattura,
  mappaAnagraficaPerFic,
  TAX_ID_EXTRA_UE,
  type AnagraficaFic,
} from '../../supabase/functions/_shared/fic-anagrafica';

// Le regole di mappatura vengono dalla guida esterna di Fatture in Cloud e non
// si ricostruiscono a memoria: se regrediscono, il sintomo è una fattura
// scartata dallo SDI settimane dopo. Questa suite le fissa.

const baseItalia: AnagraficaFic = {
  tipo: 'persona_fisica',
  nome: 'Mario',
  cognome: 'Rossi',
  codice_fiscale: 'RSSMRA00A01F205X',
  indirizzo_via: 'Via Roma',
  indirizzo_civico: '1',
  indirizzo_cap: '41121',
  indirizzo_comune: 'Modena',
  indirizzo_provincia: 'MO',
  indirizzo_nazione: 'IT',
  email_recapito: 'mario@example.com',
};

const baseEstera: AnagraficaFic = {
  tipo: 'persona_fisica',
  nome: 'Anna',
  cognome: 'Schmidt',
  indirizzo_via: 'Hauptstrasse',
  indirizzo_civico: '12',
  indirizzo_comune: 'Berlin',
  indirizzo_nazione: 'DE',
  email_recapito: 'anna@example.com',
};

const baseSocieta: AnagraficaFic = {
  tipo: 'soggetto_giuridico',
  denominazione: 'Edil Studenti Srl',
  partita_iva: '01234560365',
  indirizzo_via: 'Via Emilia',
  indirizzo_civico: '100',
  indirizzo_cap: '41121',
  indirizzo_comune: 'Modena',
  indirizzo_provincia: 'MO',
  indirizzo_nazione: 'IT',
  email_recapito: 'amministrazione@edilstudenti.example.com',
};

describe('mappaAnagraficaPerFic — anagrafica estera', () => {
  it('omette il codice fiscale anche se presente', () => {
    const m = mappaAnagraficaPerFic({ ...baseEstera, codice_fiscale: 'RSSMRA00A01F205X' });
    expect(m.data.tax_code).toBe('');
    expect(m.trasformazioni.join(' ')).toContain('codice fiscale non inviato');
  });

  it('invia CAP 00000 e accoda il CAP reale all\'indirizzo', () => {
    const m = mappaAnagraficaPerFic({ ...baseEstera, indirizzo_cap: '10115' });
    expect(m.data.address_postal_code).toBe('00000');
    expect(m.data.address_street).toContain('10115');
    expect(m.data.address_street).toContain('Hauptstrasse 12');
  });

  it('invia provincia EE quando assente', () => {
    const m = mappaAnagraficaPerFic(baseEstera);
    expect(m.data.address_province).toBe('EE');
  });

  it('usa la partita IVA convenzionale per un paese Extra-UE', () => {
    const m = mappaAnagraficaPerFic({ ...baseEstera, indirizzo_nazione: 'US' });
    expect(m.data.vat_number).toBe(TAX_ID_EXTRA_UE);
  });

  it('lascia la partita IVA vuota per un paese UE senza identificativo', () => {
    const m = mappaAnagraficaPerFic(baseEstera);
    expect(m.data.vat_number).toBe('');
  });
});

describe('mappaAnagraficaPerFic — ei_code', () => {
  it('ripiega su 0000000 per l\'Italia senza codice destinatario', () => {
    const m = mappaAnagraficaPerFic({ ...baseItalia, codice_destinatario: '' });
    expect(m.data.ei_code).toBe('0000000');
  });

  it('ripiega su XXXXXXX per l\'estero senza codice destinatario', () => {
    const m = mappaAnagraficaPerFic(baseEstera);
    expect(m.data.ei_code).toBe('XXXXXXX');
  });
});

describe('mappaAnagraficaPerFic — invariante sul payload', () => {
  it('nessuna proprietà del payload è null né undefined (FIC rifiuta il null esplicito; undefined ometterebbe la chiave)', () => {
    for (const a of [baseItalia, baseEstera, baseSocieta]) {
      const { data } = mappaAnagraficaPerFic(a);
      expect(Object.values(data).some((v) => v == null)).toBe(false);
    }
  });
});

describe('campiMancantiPerFicSync — soglie Italia', () => {
  it('segnala il CAP mancante', () => {
    expect(campiMancantiPerFicSync({ ...baseItalia, indirizzo_cap: '' })).toContain('CAP');
  });

  it('segnala la provincia mancante', () => {
    expect(campiMancantiPerFicSync({ ...baseItalia, indirizzo_provincia: '' })).toContain('provincia');
  });

  it('segnala la mancanza di entrambi gli identificativi fiscali', () => {
    const m = campiMancantiPerFicSync({ ...baseItalia, codice_fiscale: '', partita_iva: '' });
    expect(m).toContain('codice fiscale o partita IVA');
  });

  it('non segnala nulla con anagrafica completa', () => {
    expect(campiMancantiPerFicSync(baseItalia)).toEqual([]);
  });
});

describe('differenza fra sincronizzazione e fattura', () => {
  it('differiscono solo sull\'email di recapito', () => {
    const senzaEmail = { ...baseItalia, email_recapito: '' };
    expect(campiMancantiPerFicSync(senzaEmail)).toEqual([]);
    expect(campiMancantiPerFattura(senzaEmail)).toEqual(['email di recapito']);
  });

  it('con email presente restituiscono la stessa lista', () => {
    const incompleta = { ...baseItalia, indirizzo_cap: '' };
    expect(campiMancantiPerFattura(incompleta)).toEqual(campiMancantiPerFicSync(incompleta));
  });
});
