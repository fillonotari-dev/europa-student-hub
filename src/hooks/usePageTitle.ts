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
  '/admin/contratti': 'Contratti',
  '/admin/camere': 'Camere',
  '/admin/strutture': 'Strutture',
  '/admin/impostazioni': 'Impostazioni',
};

type Ctx = {
  override: string | null;
  setOverride: (v: string | null) => void;
  backTo: string | null;
  setBackTo: (v: string | null) => void;
};

const PageTitleContext = createContext<Ctx | null>(null);

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<string | null>(null);
  const [backTo, setBackTo] = useState<string | null>(null);
  const value = useMemo(() => ({ override, setOverride, backTo, setBackTo }), [override, backTo]);
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

export function usePageBackTo(): string | null {
  const ctx = useContext(PageTitleContext);
  return ctx?.backTo ?? null;
}

export function usePageBack(to: string | null | undefined) {
  const ctx = useContext(PageTitleContext);
  const setBackTo = ctx?.setBackTo;
  useEffect(() => {
    if (!setBackTo) return;
    setBackTo(to ?? null);
    return () => setBackTo(null);
  }, [setBackTo, to]);
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