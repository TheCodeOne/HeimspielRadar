# ADR-0003: Consolidation on MapLibre GL and Introduction of useMapViewModel

## Status
Accepted (Supersedes [ADR-0002: Multi-Spike Map Architecture](0002-multi-spike-map-architecture.md))

## Context & Problem
In ADR-0002, HeimspielRadar adopted a 4-engine polymorphic spike architecture (`LeafletEngine`, `OpenLayersEngine`, `MapLibreEngine`, `PigeonEngine`) to empirically compare rendering performance, developer ergonomics, visual styling, bundle footprint, and mobile responsiveness across open-source map stacks.

While effective for evaluating tradeoffs, maintaining four parallel map engines incurred significant ongoing friction:
1. **Logic Duplication:** Every engine independently computed venue coordinate validation (`validVenues`), match grouping (`groups = groupMatchesByVenue(...)`), dynamic zoom-dependent clustering (`clusters = clusterVenueGroups(...)`), and team query bounding boxes (`fitBounds`).
2. **Triple Marker Pipeline:** Map markers were implemented across three incompatible paradigms: HTML strings for Leaflet `L.divIcon`, DOM elements for OpenLayers and MapLibre `document.createElement`, and custom React component wrappers for Pigeon Maps. Visual enhancements (pulsing glow, info indicators, match count badges) required three synchronized implementations.
3. **Bundle Weight & Dependency Surface:** Bundling OpenLayers (`ol`), Leaflet (`leaflet`, `react-leaflet`, `@types/leaflet`), and Pigeon Maps (`pigeon-maps`) introduced multiple large mapping libraries and legacy CSS rules into the production artifact.

## Decision
1. **Conclude ADR-0002 Multi-Spike Phase:**
   Declare **MapLibre GL JS** (`MapLibreEngine.tsx`) with OpenFreeMap Bright vector tiles as the single, canonical map engine for HeimspielRadar Web:
   - **Performance:** Hardware-accelerated WebGL vector rendering achieves 60fps pan/zoom animations, dynamic pitch/bearing support, and crisp rendering across all mobile and high-DPI displays without tile-blur artifacts.
   - **Independence & Cost:** OpenFreeMap vector tiles require zero API keys, no monthly cost, and no request rate limits.
   - **Clean Retirement:** Remove `ol`, `leaflet`, `@types/leaflet`, `react-leaflet`, and `pigeon-maps` from `package.json`. Delete `LeafletEngine.tsx`, `OpenLayersEngine.tsx`, and `PigeonEngine.tsx`, along with their CSS overrides.

2. **Introduce `useMapViewModel` Deep Module:**
   Extract and centralize all map calculation and state logic into `apps/frontend/src/components/map/useMapViewModel.ts`:
   - Validates coordinates and deduplicates co-located venues (`extractValidVenues`).
   - Groups matches chronologically by venue (`groups`).
   - Calculates dynamic Mercator-pixel clustering based on current zoom (`clusters`).
   - Generates GeoJSON circle FeatureCollections for search radius visualization (`radiusGeoJson` / `getRadiusCircleGeoJson`).
   - Computes bounding boxes and single-venue focus coordinates for team searches (`teamBounds`).
   - Manages current zoom level and synchronizes with MapLibre's `zoomend` event (`currentZoom`, `onZoomChange`).
   - Reduces `MapLibreEngine.tsx` to a declarative, passive view adapter.

3. **Consolidate Marker Pipeline:**
   Standardize on a single DOM element factory backed by canonical HTML/SVG string templates:
   - Templates: `getBasketballPinHtml`, `getClusterBadgeHtml`, `getSearchCenterPinHtml`, `getUserLocationPinHtml`.
   - Element Factories: `createVenueMarkerElement`, `createClusterMarkerElement`, `createSearchCenterMarkerElement`, `createUserLocationMarkerElement`.
   - Retire unused parallel React marker components (`BasketballPinMarker`, `ClusterBadgeMarker`, `SearchCenterMarker`, `UserLocationMarker`).

4. **Streamline UI & Settings:**
   - Remove the floating engine selector pill from `MapContainer.tsx`.
   - Remove engine selection options from `/settings` (`SettingsView.tsx`), retaining the radius circle toggle and diagnostics.
   - Remove `mapEngine` and `setMapEngine` from filter state and persistence (`use-match-filters.ts`).

## Consequences
- **Developer Ergonomics:** Single source of truth for markers, clustering, and map interactions. Zero need to maintain multi-engine parity rules.
- **Performance:** Reduced bundle size and dependency overhead; consistent 60fps vector map experience.
- **Simplicity:** Declarative view architecture with high test coverage via `useMapViewModel.spec.tsx` and `map-utils.spec.ts`.
