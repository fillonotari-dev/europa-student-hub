# Fix focus loss: move inline helper components to module scope

## Goal
Fix the focus-loss bug in the contract creation dialog and the same anti-pattern in the contract detail page.

## Verified state
- `src/components/admin/contratti/ContrattoDialog.tsx` defines `const F = ({ label, children }) => ...` at line 326 inside the `ContrattoDialog` component body. Every keystroke re-creates `F` with a new identity, so React unmounts and remounts its subtree, destroying focused inputs (including the date pickers).
- `src/pages/admin/ContrattoPage.tsx` defines `const Riga = ({ k, v }) => ...` at line 245 inside the component body. It currently renders only text, but it has the same defect and would reappear if any interactive child is added.

## Work to do
1. Move `F` from inside `ContrattoDialog` to the top level of `src/components/admin/contratti/ContrattoDialog.tsx` (module scope). Keep its prop signature and styling unchanged.
2. Move `Riga` from inside `ContrattoPage` to the top level of `src/pages/admin/ContrattoPage.tsx` (module scope). Keep its rendering and styling unchanged.
3. Run a quick type/build check to ensure no props are broken.

## Not in scope
No functional changes to contracts, validation, storage, or database. Only the component-scope refactor.