import { supabase } from '@/integrations/supabase/client';
import { codiceDestinatarioProposto } from '@shared/fic-anagrafica';
import { anaDaRiga, anaVuota, type AnaState } from './AnagraficaFatturazioneFields';

/**
 * Dati di fatturazione dello studente: la sua anagrafica se esiste, altrimenti
 * una precompilazione a partire dalla scheda anagrafica.
 *
 * Un solo punto per la regola: la usano la creazione contratto e la modifica
 * dell'intestazione, così i due percorsi non possono divergere.
 * Solleva l'errore: chi chiama torna alla modalità di partenza e lo mostra.
 */
export async function caricaAnaStudente(
  studenteId: string,
): Promise<{ id: string | null; ana: AnaState }> {
  const [{ data: anagrafica, error: errA }, { data: studente, error: errS }] = await Promise.all([
    supabase.from('anagrafiche_fatturazione').select('*').eq('studente_id', studenteId).maybeSingle(),
    supabase.from('studenti').select('*').eq('id', studenteId).maybeSingle(),
  ]);
  if (errA) throw errA;
  if (errS) throw errS;

  if (anagrafica) return { id: anagrafica.id, ana: anaDaRiga(anagrafica) };

  if (!studente) return { id: null, ana: { ...anaVuota(), tipo: 'persona_fisica' } };

  return {
    id: null,
    ana: {
      ...anaVuota(),
      tipo: 'persona_fisica',
      nome: studente.nome ?? '',
      cognome: studente.cognome ?? '',
      codice_fiscale: studente.codice_fiscale ?? '',
      indirizzo_via: studente.indirizzo_via ?? '',
      indirizzo_civico: studente.indirizzo_civico ?? '',
      indirizzo_cap: studente.indirizzo_cap ?? '',
      indirizzo_comune: studente.indirizzo_comune ?? '',
      indirizzo_provincia: studente.indirizzo_provincia ?? '',
      indirizzo_nazione: studente.indirizzo_nazione ?? 'IT',
      codice_destinatario: codiceDestinatarioProposto(studente.indirizzo_nazione),
      email_recapito: (studente as any).email_fattura || studente.email || '',
    },
  };
}
