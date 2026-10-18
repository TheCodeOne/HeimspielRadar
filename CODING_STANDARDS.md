# HeimspielRadar Coding Standards & Architectural Invariants

Consult this reference during implementation and code review (`/code-review`, `review-pr`). Mechanical rules are enforced by `npx oxlint`, `npm run db:check`, and `npm run lockfile:check`; architectural invariants below govern cross-file consistency.

---

## 1. AST & Anti-Slop Rules (`npx oxlint`)

1. **Justified Type Assertions (`anti-slop`)**:
   Precede every `as <Type>` cast with a `// SAFETY: <reason>` comment explaining why the runtime shape is guaranteed:
   ```typescript
   // SAFETY: DBB REST API guarantees DbbSpielplanResponse structure
   const data = (await res.json()) as DbbSpielplanResponse;
   ```
2. **Readable Spacing (`anti-slop/require-readable-spacing`)**:
   Insert a blank line before control-flow statements (`if`, `for`, `switch`, `return`) and multiline variable declarations.
3. **Explicit Primitive Checks (`anti-slop/no-runtime-typeof`)**:
   In domain and storage modules (such as `apps/frontend/src/lib/filter-storage.ts`), compare booleans and known union literals explicitly (`val === true || val === false`) rather than using runtime `typeof`.
4. **Zero Dead Code**:
   Remove unused imports, orphaned components (e.g. replaced popups), and unreachable branches before committing.

---

## 2. Frontend, Viewport & Map Engine Invariants

1. **Mobile Dynamic Viewport Lock (`100dvh`)**:
   - The root app shell (`apps/frontend/src/App.tsx`, `apps/frontend/src/index.css`) and slide-over drawers (`FilterBar.tsx`) use `h-dvh` (`height: 100dvh`), `overflow-hidden`, and `overscroll-none` / `overscroll-contain`.
   - Use `h-dvh` rather than `h-screen` (`100vh`) so mobile browser address/navigation bars never allow vertical page scrolling that pushes `<header>` off-screen.
2. **Map Stacking Context Isolation (`isolate z-0`)**:
   - Third-party map engines (especially Leaflet's `.leaflet-pane`, `.leaflet-top`, `.leaflet-bottom` with `z-index: 400–1000`) must stay trapped inside a `z-0` stacking context.
   - Keep `isolate z-0` on the map canvas wrapper in `apps/frontend/src/components/map/MapContainer.tsx` and `isolation: isolate; z-index: 0 !important;` on `.leaflet-container` in `apps/frontend/src/index.css` so map layers never overlap the header (`z-30`), floating map pills (`z-20`), bottom Venue Overlay (`z-20`), or Filter Drawer (`z-50`).
3. **4-Engine Map Spike Parity ([ADR-0002](docs/adr/0002-multi-spike-map-architecture.md))**:
   - All four engines in `apps/frontend/src/components/map/engines/` (`OpenLayersEngine.tsx`, `MapLibreEngine.tsx`, `LeafletEngine.tsx`, `PigeonEngine.tsx`) implement `MapEngineProps`.
   - Clicking a venue pin calls `onMarkerClick(group.matches[0])` to open the bottom Multi-Match Venue Overlay without rendering a duplicate in-map popup.
   - Selected venue pins render with a higher `z-index` than neighboring unselected pins.

---

## 3. Domain, Timezone & Database Invariants

1. **German Local Time (`Europe/Berlin`) for DBB Kickoffs**:
   - DBB `kickoffDate` (`YYYY-MM-DD`) and `kickoffTime` (`HH:mm`) are stored in local German time (`Europe/Berlin`).
   - Compute any relative date or live-game cutoff (such as the 2-hour `onlyUpcoming` cutoff in `MatchesService.findMatches` and `date-utils.ts`) using `Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', ... })` rather than UTC `new Date().toISOString()`.
2. **Chronological Match Ordering**:
   - Multiple matches at the same venue (`groupMatchesByVenue`, `selectedVenueMatches`) and API responses (`MatchesService.findMatches`) sort chronologically by `kickoffDate` ascending, then `kickoffTime` ascending (with `null` or `'00:00'` placed last).
3. **Filter Parity (`MatchesService` ↔ `use-matches.ts`)**:
   - `apps/frontend/src/lib/use-matches.ts` includes a client-side fallback filter for sample matches. Whenever a query parameter is added or modified in `apps/backend/src/app/matches/matches.service.ts`, update the fallback filter in `use-matches.ts` in lockstep.
4. **Drizzle Schema ↔ Migration Sync**:
   - `DatabaseModule.onModuleInit` (`apps/backend/src/app/database/database.module.ts`) executes SQL migrations from `drizzle/migrations/` on backend startup.
   - Every change to `apps/backend/src/app/database/schema.ts` must include a generated migration via `npm run db:generate` and pass `npm run db:check`.
