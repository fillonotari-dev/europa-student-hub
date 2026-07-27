import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Titolo mostrato nella top bar admin.
 *
 * Precedenza:
 *  1. Override esplicito impostato da una pagina tramite `usePageTitle(label)`
 *     (necessario per rotte con parametri variabili, es. /admin/candidature/:id).
 *  2. Mappa statica route → label per le rotte fisse note.
 *  3. Fallback: stringa vuota (nessun placeholder).
 */

const ROUTE_TITLES: Record<string, string> = {
  '/admin': 'Home',
  '/admin/candidature': 'Candidature',
  '/admin/residenti': 'Residenti',
  '/admin/camere': 'Camere',
  '/admin/strutture': 'Strutture',
  '/admin/storico/candidature': 'Storico · Candidature',
  '/admin/storico/residenti': 'Storico · Residenti',
  '/admin/storico/camere': 'Storico · Camere',
};

type Ctx = {
  override: string | null;
  setOverride: (v: string | null) => void;
};

const PageTitleContext = createContext<Ctx | null>(null);

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<string | null>(null);
  const value = useMemo(() => ({ override, setOverride }), [override]);
  return createElement(PageTitleContext.Provider, { value }, children);
}

/** Chiamato dal layout per calcolare il titolo attivo. */
export function useResolvedPageTitle(): string {
  const ctx = useContext(PageTitleContext);
  const { pathname } = useLocation();
  if (ctx?.override) return ctx.override;
  const clean = pathname.replace(/\/+$/, '') || '/admin';
  return ROUTE_TITLES[clean] ?? '';
}

/**
 * Da usare in pagine di dettaglio con rotte parametrizzate.
 * Il titolo viene resettato all'unmount.
 */
export function usePageTitle(title: string | null | undefined) {
  const ctx = useContext(PageTitleContext);
  const setOverride = ctx?.setOverride;
  useEffect(() => {
    if (!setOverride) return;
    setOverride(title ?? null);
    return () => setOverride(null);
  }, [setOverride, title]);
}