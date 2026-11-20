# Restore Nocturne or simplify Glass Studio

Baseline before this refinement: `1cece00`, preserved on `baseline/nocturne-ui-2026-11-20`. Work branch: `feat/glass-studio-and-anatomy-motion`.

Stop the running frontend dev server first. From the existing project directory, preserve any new work before switching:

```sh
cd "/Users/parsaalikhani/Desktop/AI Product Engineer"
git status --short
# Commit or otherwise preserve any new edits first.
git switch baseline/nocturne-ui-2026-11-20
npm --prefix frontend ci
npm --prefix frontend run dev
```

The backend, database and source archives need no rollback. No migration was introduced. To return to Glass Studio, stop Vite and run:

```sh
git switch feat/glass-studio-and-anatomy-motion
npm --prefix frontend ci
npm --prefix frontend run dev
```

No reset, force push, history rewrite or database downgrade is needed. The older bright baseline is still independently available on `baseline/bright-ui-2026-11-20`.

## Independent enhancement switches

There is **no genuine 3D mesh renderer active** in this version; matching verified meshes were not obtained. The existing depth switch controls the optional photographic depth/rotation treatment. After stopping Vite, disable only that enhancement with:

```sh
VITE_ENABLE_DEPTH=false npm --prefix frontend run dev
```

Glass styling, catalog data, navigation, color galleries and the anatomy layer animation stay available. Disable only desktop pinned scrolling with:

```sh
VITE_ENABLE_SCROLL_SHOWCASE=false npm --prefix frontend run dev
```

All four shoes then appear in normal document flow. Both flags are independent. For persistent settings, edit the corresponding `VITE_` variable in the private root `.env`; Vite's `envDir` reads that directory. Restart Vite or rebuild after changing a flag. The same prefixes work with `npm --prefix frontend run build`.

System reduced motion bypasses the pin and makes layer poses immediate without changing the design or deleting content.
