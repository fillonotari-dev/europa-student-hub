import { supabase } from '@/integrations/supabase/client';

/**
 * Riga finale usata dalle liste della scheda persona (Candidature, Residenti).
 * Unisce v_studenti_stadio con i dettagli di candidatura / assegnazione /
 * struttura necessari per la lista senza costringere ogni pagina a
 * ricomporre join ad hoc.
 */
export type StadioRow = {
  studente_id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  stadio: string;
  candidatura_id: string | null;
  candidatura_stato: string | null;
  priorita: number | null;
  assegnazione_id: string | null;
  camera_id: string | null;
  camera_numero: string | null;
  posto: number | null;
  data_inizio: string | null;
  data_fine: string | null;
  struttura_id: string | null;
  struttura_nome: string | null;
  // Dettagli aggiuntivi dalla candidatura corrente
  versione_form?: string | null;
  esito_email_inviata_il?: string | null;
  token_scade_il?: string | null;
  completata_il?: string | null;
  anno_accademico?: string | null;
  created_at?: string | null;
  origine?: string | null;
};

export async function fetchStadi(stadi: string[]): Promise<StadioRow[]> {
  const { data: base, error } = await supabase
    .from('v_studenti_stadio')
    .select('*')
    .in('stadio', stadi);
  if (error) throw error;

  const rows = (base ?? []) as any[];
  if (rows.length === 0) return [];

  const candIds = Array.from(new Set(rows.map(r => r.candidatura_id).filter(Boolean)));
  const strutturaIds = Array.from(new Set(rows.map(r => r.struttura_id).filter(Boolean)));

  const [candDetails, strutture] = await Promise.all([
    candIds.length
      ? supabase.from('candidature')
          .select('id, versione_form, esito_email_inviata_il, token_scade_il, completata_il, anno_accademico, created_at, origine')
          .in('id', candIds)
      : Promise.resolve({ data: [] as any[] }),
    strutturaIds.length
      ? supabase.from('strutture').select('id, nome').in('id', strutturaIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const cMap = new Map((candDetails.data ?? []).map((c: any) => [c.id, c]));
  const sMap = new Map((strutture.data ?? []).map((s: any) => [s.id, s.nome]));

  return rows.map(r => {
    const c = r.candidatura_id ? cMap.get(r.candidatura_id) : null;
    return {
      ...r,
      struttura_nome: r.struttura_id ? (sMap.get(r.struttura_id) ?? null) : null,
      versione_form: c?.versione_form ?? null,
      esito_email_inviata_il: c?.esito_email_inviata_il ?? null,
      token_scade_il: c?.token_scade_il ?? null,
      completata_il: c?.completata_il ?? null,
      anno_accademico: c?.anno_accademico ?? null,
      created_at: c?.created_at ?? null,
      origine: c?.origine ?? null,
    } as StadioRow;
  });
}

/** Ricerca globale (top bar): match su nome/cognome/email; limita a 15. */
export async function searchStudenti(q: string): Promise<StadioRow[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const pattern = `%${term}%`;
  const { data } = await supabase
    .from('v_studenti_stadio')
    .select('*')
    .or(`nome.ilike.${pattern},cognome.ilike.${pattern},email.ilike.${pattern}`)
    .limit(15);
  return (data ?? []) as StadioRow[];
}