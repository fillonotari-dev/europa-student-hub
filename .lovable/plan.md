## Bug
In `src/hooks/usePageTitle.ts`, `usePageTitle` dipende da `ctx`, ma `ctx` è memoizzato su `override`. Ogni cambio titolo → nuova identità di `ctx` → l'effetto si riesegue → cleanup azzera → set rimposta → loop → "Maximum update depth exceeded".

## Fix
Dipendere solo dal setter stabile di `useState`, non dall'intero oggetto contesto.

In `src/hooks/usePageTitle.ts`:

```ts
export function usePageTitle(title: string | null | undefined) {
  const ctx = useContext(PageTitleContext);
  const setOverride = ctx?.setOverride;
  useEffect(() => {
    if (!setOverride) return;
    setOverride(title ?? null);
    return () => setOverride(null);
  }, [setOverride, title]);
}
```

`setOverride` è la funzione restituita da `useState`, quindi ha identità stabile per tutta la vita del provider: niente più loop.

Nessun altro file toccato. Nessun cambio di API pubblica.
