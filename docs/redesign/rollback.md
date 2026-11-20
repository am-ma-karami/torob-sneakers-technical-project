# Redesign baseline and rollback

Baseline: `f8e7231f7434179212ea57739761bccfc4837a3b` on preserved branch `baseline/bright-ui-2026-11-20`. Redesign work is isolated on `feat/dark-shoe-experience`. Before screenshots are in `docs/redesign/before/` (desktop/mobile captures refreshed before editing).

Restore the previous interface without rewriting history:

Stop the running frontend dev server first.

```sh
cd "/Users/parsaalikhani/Desktop/AI Product Engineer"
git status --short
# Commit or otherwise preserve any new work first, then:
git switch baseline/bright-ui-2026-11-20
npm --prefix frontend ci
npm --prefix frontend run dev
```

The database and raw source data are not rolled back or deleted. Return to the redesign using `git switch feat/dark-shoe-experience` followed by `npm --prefix frontend ci`. No reset, forced push, or migration downgrade is needed.

The redesign exposes independent build flags: `VITE_ENABLE_DEPTH=false` disables lightweight 2.5D presentation; `VITE_ENABLE_SCROLL_SHOWCASE=false` disables pinned/scroll-driven editorial behavior. All products remain accessible as normal-flow cards. Flags are read by Vite at start/build, so restart the dev server or rebuild after changing them. System reduced-motion and mobile layouts also bypass the pinned effect automatically.


After stopping Vite, run either command from the repository root:

```sh
# Disable depth only; preserve the dark design and scroll showcase.
VITE_ENABLE_DEPTH=false npm --prefix frontend run dev
```

```sh
# Disable enhanced scrolling only; preserve depth and all four products.
VITE_ENABLE_SCROLL_SHOWCASE=false npm --prefix frontend run dev
```

For persistent configuration, set the corresponding `VITE_` variable in the private root `.env`. Vite's `envDir` explicitly points there. The same prefix works for `npm --prefix frontend run build`. Removing the override restores the default, unless the private `.env` specifies a different value.
