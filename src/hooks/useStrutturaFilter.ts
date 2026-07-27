import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'admin.strutturaFilter';

export type StrutturaOpt = { id: string; nome: string };

type Ctx = {
  strutturaId: string;
  setStrutturaId: (v: string) => void;
  strutture: StrutturaOpt[];
  nomeSelezionato: string | null;
  isAll: boolean;
};

const StrutturaFilterContext = createContext<Ctx | null>(null);

/**
 * Provider globale del filtro struttura per l'area admin.
 * Un solo stato + un solo listener localStorage per l'intera app: cambiare
 * valore nella top bar propaga a tutti i consumer, che rifetchano i propri
 * dati tramite queryKey.
 */
export function StrutturaFilterProvider({ children }: { children: ReactNode }) {
  const [strutturaId, setStrutturaIdState] = useState<string>(() => {
    if (typeof window === 'undefined') return 'tutti';
    return localStorage.getItem(STORAGE_KEY) || 'tutti';
  });

  const setStrutturaId = useCallback((v: string) => {
    setStrutturaIdState(v);
    try { localStorage.setItem(STORAGE_KEY, v); } catch { /* ignore */ }
  }, []);

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

  const value = useMemo<Ctx>(() => {
    const list = strutture ?? [];
    const selected = list.find(s => s.id === strutturaId);
    return {
      strutturaId,
      setStrutturaId,
      strutture: list,
      nomeSelezionato: selected?.nome ?? null,
      isAll: strutturaId === 'tutti',
    };
  }, [strutturaId, setStrutturaId, strutture]);

  return createElement(StrutturaFilterContext.Provider, { value }, children);
}

export function useStrutturaFilter() {
  const ctx = useContext(StrutturaFilterContext);
  if (!ctx) throw new Error('useStrutturaFilter deve essere usato dentro <StrutturaFilterProvider>');
  return ctx;
}