# Multi-Spike Map Architecture

> **Status:** Superseded by [ADR-0003: MapLibre GL Consolidation & useMapViewModel](0003-maplibre-consolidation.md)

To evaluate rendering performance, bundle size, developer experience, and styling capabilities, the frontend will implement a polymorphic Map Engine interface allowing live switching between four distinct map spikes: MapLibre GL JS (vector tiles), Leaflet (raster tiles), Pigeon Maps (zero-dependency pure React), and OpenLayers (GIS grade). This enables empirical comparison in the live proof of concept before locking into a single mapping library.
