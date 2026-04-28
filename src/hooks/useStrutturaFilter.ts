import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'admin.strutturaFilter';

export type StrutturaOpt = { id: string; nome: string };

/**
 * Hook condiviso per il filtro struttura nelle pagine admin.
 * Persiste la selezione in localStorage così rimane coerente tra Dashboard,
 * Camere, Residenti, Candidature e Storico.
 * Valore "tutti" = nessun filtro (aggregato su tutte le strutture attive).
 */
export function useStrutturaFilter() {
  const [strutturaId, setStrutturaIdState] = useState<string>(() => {
    if (typeof window === 'undefined') return 'tutti';
    return localStorage.getItem(STORAGE_KEY) || 'tutti';
  });

  const setStrutturaId = (v: string) => {
    setStrutturaIdState(v);
    try { localStorage.setItem(STORAGE_KEY, v); } catch { /* ignore */ }
  };

  // Sync tra tab (utile se l'admin apre più pagine)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) setStrutturaIdState(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const { data: strutture } = useQuery({
    queryKey: ['strutture-filter'],
    queryFn: async () => {
      const { data } = await supabase
        .from('strutture')
        .select('id, nome')
        .eq('attiva', true)
        .order('nome');
      return (data ?? []) as StrutturaOpt[];
    },
  });

  const selected = strutture?.find(s => s.id === strutturaId);
  const nomeSelezionato = selected?.nome ?? null;

  return {
    strutturaId,
    setStrutturaId,
    strutture: strutture ?? [],
    nomeSelezionato,           // null quando "tutti"
    isAll: strutturaId === 'tutti',
  };
}