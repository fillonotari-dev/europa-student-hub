import { useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { campiMancantiPerFattura, codiceDestinatarioProposto } from '@shared/fic-anagrafica';

export type Modalita = 'studente' | 'terzo';

export type AnaState = {
  tipo: string;
  denominazione: string;
  nome: string;
  cognome: string;
  codice_fiscale: string;
  partita_iva: string;
  indirizzo_via: string;
  indirizzo_civico: string;
  indirizzo_cap: string;
  indirizzo_comune: string;
  indirizzo_provincia: string;
  indirizzo_nazione: string;
  codice_destinatario: string;
  pec: string;
  email_recapito: string;
};

/**
 * Campo etichettato. Definito a livello di modulo e non dentro un componente:
 * una definizione annidata viene ricreata a ogni render e gli input perdono
 * il focus a ogni carattere digitato.
 */
export const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>
);

export const anaVuota = (): AnaState => ({
  tipo: 'persona_fisica',
  denominazione: '',
  nome: '',
  cognome: '',
  codice_fiscale: '',
  partita_iva: '',
  indirizzo_via: '',
  indirizzo_civico: '',
  indirizzo_cap: '',
  indirizzo_comune: '',
  indirizzo_provincia: '',
  indirizzo_nazione: 'IT',
  codice_destinatario: '0000000',
  pec: '',
  email_recapito: '',
});

/**
 * Stato per "intesta a un altro soggetto": i campi identificativi vanno svuotati,
 * altrimenti i dati della persona precedente finiscono sulla riga del terzo.
 */
export const anaTerzoVuota = (): AnaState => ({ ...anaVuota(), tipo: 'soggetto_giuridico', codice_destinatario: '' });

/** Riga di anagrafiche_fatturazione → stato del form. */
export const anaDaRiga = (r: any): AnaState => ({
  tipo: r?.tipo ?? 'persona_fisica',
  denominazione: r?.denominazione ?? '',
  nome: r?.nome ?? '',
  cognome: r?.cognome ?? '',
  codice_fiscale: r?.codice_fiscale ?? '',
  partita_iva: r?.partita_iva ?? '',
  indirizzo_via: r?.indirizzo_via ?? '',
  indirizzo_civico: r?.indirizzo_civico ?? '',
  indirizzo_cap: r?.indirizzo_cap ?? '',
  indirizzo_comune: r?.indirizzo_comune ?? '',
  indirizzo_provincia: r?.indirizzo_provincia ?? '',
  indirizzo_nazione: r?.indirizzo_nazione ?? 'IT',
  codice_destinatario: r?.codice_destinatario ?? '',
  pec: r?.pec ?? '',
  email_recapito: r?.email_recapito ?? '',
});

const nz = (v: string | null | undefined) => (String(v ?? '').trim() === '' ? null : String(v).trim());

/** Stato del form → payload per anagrafiche_fatturazione. */
export const payloadAnagrafica = (ana: AnaState, modalita: Modalita, studenteId: string | null) => ({
  tipo: ana.tipo,
  denominazione: ana.tipo === 'soggetto_giuridico' ? nz(ana.denominazione) : null,
  nome: ana.tipo === 'persona_fisica' ? nz(ana.nome) : null,
  cognome: ana.tipo === 'persona_fisica' ? nz(ana.cognome) : null,
  codice_fiscale: nz(ana.codice_fiscale),
  partita_iva: nz(ana.partita_iva),
  indirizzo_via: nz(ana.indirizzo_via),
  indirizzo_civico: nz(ana.indirizzo_civico),
  indirizzo_cap: nz(ana.indirizzo_cap),
  indirizzo_comune: nz(ana.indirizzo_comune),
  indirizzo_provincia: nz(ana.indirizzo_provincia),
  indirizzo_nazione: ana.indirizzo_nazione || 'IT',
  codice_destinatario: nz(ana.codice_destinatario?.toUpperCase()),
  pec: nz(ana.pec),
  email_recapito: nz(ana.email_recapito),
  studente_id: modalita === 'studente' ? studenteId : null,
});

/** Validazione minima, identica in creazione e in modifica. */
export const erroreAnagrafica = (ana: AnaState): string | null => {
  if (ana.tipo === 'soggetto_giuridico' && !ana.denominazione.trim())
    return 'La denominazione è obbligatoria per un soggetto giuridico.';
  if (ana.tipo === 'persona_fisica' && (!ana.nome.trim() || !ana.cognome.trim()))
    return 'Nome e cognome sono obbligatori per una persona fisica.';
  return null;
};

type Props = {
  modalita: Modalita;
  /**
   * Il cambio di modalità ricarica i dati: il componente non tocca lo stato,
   * decide il chiamante (anagrafica dello studente oppure campi svuotati).
   */
  onModalitaChange: (m: Modalita) => void;
  ana: AnaState;
  onAnaChange: (aggiorna: (a: AnaState) => AnaState) => void;
  /** Nota "esiste già un'anagrafica per questa persona: verrà aggiornata". */
  mostraNotaAnagraficaEsistente?: boolean;
  /** Campi in sola lettura durante il ricaricamento, per non salvare uno stato intermedio. */
  disabilitato?: boolean;
};

export function AnagraficaFatturazioneFields({
  modalita, onModalitaChange, ana, onAnaChange, mostraNotaAnagraficaEsistente, disabilitato,
}: Props) {
  // Proposta del codice destinatario al cambio nazione (solo se non compilato a mano).
  const proposto = codiceDestinatarioProposto(ana.indirizzo_nazione);
  useEffect(() => {
    onAnaChange(prev =>
      prev.codice_destinatario === '' || prev.codice_destinatario === '0000000' || prev.codice_destinatario === 'XXXXXXX'
        ? { ...prev, codice_destinatario: proposto }
        : prev,
    );
    // onAnaChange è stabile nei consumatori (setState di React).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposto]);

  // Soglia fattura, non sincronizzazione: avvisa senza bloccare su cosa
  // mancherà per emettere (email di recapito inclusa).
  const datiFiscaliMancanti = useMemo(() => campiMancantiPerFattura(ana), [ana]);

  return (
    <fieldset disabled={disabilitato} className="contents">
      <Select value={modalita} onValueChange={(v: Modalita) => onModalitaChange(v)}>
        <SelectTrigger className="w-full sm:w-[320px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="studente">Intesta allo studente</SelectItem>
          <SelectItem value="terzo">Intesta a un altro soggetto</SelectItem>
        </SelectContent>
      </Select>

      {modalita === 'studente' && mostraNotaAnagraficaEsistente && (
        <p className="text-xs text-muted-foreground">
          Esiste già un'anagrafica di fatturazione per questa persona: verrà aggiornata con i dati qui sotto.
        </p>
      )}


      {modalita === 'terzo' && (
        <F label="Tipo soggetto">
          <Select value={ana.tipo} onValueChange={v => onAnaChange(a => ({ ...a, tipo: v }))}>
            <SelectTrigger className="mt-1.5 w-full sm:w-[320px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="soggetto_giuridico">Società o ente</SelectItem>
              <SelectItem value="persona_fisica">Persona fisica</SelectItem>
            </SelectContent>
          </Select>
        </F>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ana.tipo === 'soggetto_giuridico' ? (
          <F label="Denominazione *"><Input className="mt-1.5" value={ana.denominazione} onChange={e => onAnaChange(a => ({ ...a, denominazione: e.target.value }))} /></F>
        ) : (
          <>
            <F label="Nome *"><Input className="mt-1.5" value={ana.nome} onChange={e => onAnaChange(a => ({ ...a, nome: e.target.value }))} /></F>
            <F label="Cognome *"><Input className="mt-1.5" value={ana.cognome} onChange={e => onAnaChange(a => ({ ...a, cognome: e.target.value }))} /></F>
          </>
        )}
        <F label="Codice fiscale"><Input className="mt-1.5" value={ana.codice_fiscale} onChange={e => onAnaChange(a => ({ ...a, codice_fiscale: e.target.value.toUpperCase() }))} /></F>
        <F label="Partita IVA"><Input className="mt-1.5" value={ana.partita_iva} onChange={e => onAnaChange(a => ({ ...a, partita_iva: e.target.value }))} /></F>
        <F label="Via"><Input className="mt-1.5" value={ana.indirizzo_via} onChange={e => onAnaChange(a => ({ ...a, indirizzo_via: e.target.value }))} /></F>
        <F label="Civico"><Input className="mt-1.5" value={ana.indirizzo_civico} onChange={e => onAnaChange(a => ({ ...a, indirizzo_civico: e.target.value }))} /></F>
        <F label="CAP"><Input className="mt-1.5" value={ana.indirizzo_cap} onChange={e => onAnaChange(a => ({ ...a, indirizzo_cap: e.target.value }))} /></F>
        <F label="Comune"><Input className="mt-1.5" value={ana.indirizzo_comune} onChange={e => onAnaChange(a => ({ ...a, indirizzo_comune: e.target.value }))} /></F>
        <F label="Provincia"><Input className="mt-1.5" maxLength={2} value={ana.indirizzo_provincia} onChange={e => onAnaChange(a => ({ ...a, indirizzo_provincia: e.target.value.toUpperCase() }))} /></F>
        <F label="Nazione"><Input className="mt-1.5" maxLength={2} value={ana.indirizzo_nazione} onChange={e => onAnaChange(a => ({ ...a, indirizzo_nazione: e.target.value.toUpperCase() }))} /></F>
        <F label="Codice destinatario"><Input className="mt-1.5" maxLength={7} value={ana.codice_destinatario} onChange={e => onAnaChange(a => ({ ...a, codice_destinatario: e.target.value.toUpperCase() }))} /></F>
        <F label="PEC"><Input className="mt-1.5" value={ana.pec} onChange={e => onAnaChange(a => ({ ...a, pec: e.target.value }))} /></F>
        <F label="Email di recapito"><Input className="mt-1.5" value={ana.email_recapito} onChange={e => onAnaChange(a => ({ ...a, email_recapito: e.target.value }))} /></F>
      </div>

      {datiFiscaliMancanti.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">
            Dati fiscali mancanti: {datiFiscaliMancanti.join(', ')}. Si può salvare lo stesso,
            ma serviranno al momento della fattura.
          </p>
        </div>
      )}
    </fieldset>
  );
}
