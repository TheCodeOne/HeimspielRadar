import * as React from 'react';
import {
  type GeoJSONSource,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  NavigationControl,
  setWorkerUrl,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { MapEngineProps } from '../map-engine.types';
import {
  clusterVenueGroups,
  createClusterMarkerElement,
  createGeoJsonCircle,
  createSearchCenterMarkerElement,
  createUserLocationMarkerElement,
  createVenueMarkerElement,
  groupMatchesByVenue,
} from '../map-utils';

// Configure MapLibre Web Worker for Vite
setWorkerUrl(workerUrl);

export function MapLibreEngine({
  matches,
  venueGroups,
  selectedMatchId,
  center,
  zoom,
  userLocation,
  searchLocation,
  radiusKm,
  showRadiusCircle = true,
  onMarkerClick,
  className = 'w-full h-full min-h-[400px]',
  teamQuery,
}: MapEngineProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const markersRef = React.useRef<MapLibreMarker[]>([]);
  const userMarkerRef = React.useRef<MapLibreMarker | null>(null);
  const searchMarkerRef = React.useRef<MapLibreMarker | null>(null);
  const isLoadedRef = React.useRef<boolean>(false);
  const [currentZoom, setCurrentZoom] = React.useState<number>(zoom);

  const validVenues = React.useMemo(() => {
    const venuesList: Array<{ lat: number; lng: number }> = [];
    const seen = new Set<string>();

    for (const m of matches) {
      if (
        m.venue?.latitude != null &&
        m.venue?.longitude != null &&
        !isNaN(m.venue.latitude) &&
        !isNaN(m.venue.longitude)
      ) {
        const key = `${m.venue.latitude.toFixed(5)},${m.venue.longitude.toFixed(5)}`;

        if (!seen.has(key)) {
          seen.add(key);
          venuesList.push({ lat: m.venue.latitude, lng: m.venue.longitude });
        }
      }
    }

    return venuesList;
  }, [matches]);

  const groups = React.useMemo(
    () => venueGroups ?? groupMatchesByVenue(matches, selectedMatchId),
    [venueGroups, matches, selectedMatchId],
  );

  const clusters = React.useMemo(
    () => clusterVenueGroups(groups, currentZoom),
    [groups, currentZoom],
  );

  // Initialize MapLibre
  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new MapLibreMap({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/bright',
      center: [center[1], center[0]], // [lng, lat]
      zoom,
    });

    map.addControl(new NavigationControl({ showCompass: false }), 'top-left');

    map.on('load', () => {
      isLoadedRef.current = true;
      map.resize();

      // Setup radius circle source and layers
      if (!map.getSource('search-radius-source')) {
        map.addSource('search-radius-source', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [],
          },
        });

        map.addLayer({
          id: 'search-radius-fill',
          type: 'fill',
          source: 'search-radius-source',
          paint: {
            'fill-color': '#ea580c',
            'fill-opacity': 0.08,
          },
        });

        map.addLayer({
          id: 'search-radius-line',
          type: 'line',
          source: 'search-radius-source',
          paint: {
            'line-color': '#ea580c',
            'line-width': 1.5,
            'line-dasharray': [2, 2],
          },
        });
      }
    });

    map.on('zoomend', () => {
      setCurrentZoom(Math.round(map.getZoom()));
    });

    map.on('error', (e) => {
      console.error('MapLibre error:', e);
    });

    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      isLoadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update center smoothly when center coordinate changes (only when no teamQuery active)
  React.useEffect(() => {
    const map = mapRef.current;

    if (!map || teamQuery) {
      return;
    }

    map.flyTo({
      center: [center[1], center[0]],
      duration: 600,
    });
  }, [center[0], center[1], teamQuery]);

  // Fit map bounds when teamQuery is active and venues are loaded
  React.useEffect(() => {
    const map = mapRef.current;

    if (!map || !teamQuery || validVenues.length === 0) {
      return;
    }

    if (validVenues.length === 1) {
      map.flyTo({
        center: [validVenues[0].lng, validVenues[0].lat],
        zoom: 12,
        duration: 500,
      });

      return;
    }

    const minLng = Math.min(...validVenues.map((v) => v.lng));
    const maxLng = Math.max(...validVenues.map((v) => v.lng));
    const minLat = Math.min(...validVenues.map((v) => v.lat));
    const maxLat = Math.max(...validVenues.map((v) => v.lat));

    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      {
        padding: 60,
        maxZoom: 14,
        duration: 500,
      },
    );
  }, [teamQuery, validVenues]);

  // Update user location marker
  React.useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (!userLocation) {
      return;
    }

    const el = createUserLocationMarkerElement();

    const marker = new MapLibreMarker({ element: el, anchor: 'center' })
      .setLngLat([userLocation[1], userLocation[0]])
      .addTo(map);

    userMarkerRef.current = marker;
  }, [userLocation]);

  // Update search center marker
  React.useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
      searchMarkerRef.current = null;
    }

    if (!searchLocation || searchLocation.name === 'Mein Standort') {
      return;
    }

    const el = createSearchCenterMarkerElement(searchLocation.name);

    const marker = new MapLibreMarker({ element: el, anchor: 'bottom' })
      .setLngLat([searchLocation.lng, searchLocation.lat])
      .addTo(map);

    searchMarkerRef.current = marker;
  }, [searchLocation]);

  // Update radius circle GeoJSON data
  React.useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const updateSourceData = () => {
      // SAFETY: MapLibre getSource returns GeoJSONSource for geojson type source
      const source = map.getSource('search-radius-source') as GeoJSONSource | undefined;

      if (!source) {
        return;
      }

      if (
        !showRadiusCircle ||
        !searchLocation ||
        radiusKm == null ||
        radiusKm <= 0
      ) {
        source.setData({
          type: 'FeatureCollection',
          features: [],
        });

        return;
      }

      const circleFeature = createGeoJsonCircle(
        [searchLocation.lng, searchLocation.lat],
        radiusKm,
      );

      source.setData({
        type: 'FeatureCollection',
        features: [circleFeature],
      });
    };

    if (isLoadedRef.current) {
      updateSourceData();
    } else {
      map.once('load', updateSourceData);
    }
  }, [searchLocation, radiusKm, showRadiusCircle]);

  // Update venue & cluster markers
  React.useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    for (const marker of markersRef.current) {
      marker.remove();
    }

    markersRef.current = [];

    for (const cluster of clusters) {
      if (cluster.isCluster) {
        const el = createClusterMarkerElement(cluster);

        el.addEventListener('click', (e) => {
          e.stopPropagation();

          const isSinglePoint =
            Math.abs(cluster.bounds.maxLat - cluster.bounds.minLat) < 0.0001 &&
            Math.abs(cluster.bounds.maxLng - cluster.bounds.minLng) < 0.0001;

          if (currentZoom >= 15 || isSinglePoint) {
            onMarkerClick(cluster.matches[0]);
          } else {
            map.fitBounds(
              [
                [cluster.bounds.minLng, cluster.bounds.minLat],
                [cluster.bounds.maxLng, cluster.bounds.maxLat],
              ],
              {
                padding: 50,
                maxZoom: 15,
                duration: 500,
              },
            );
          }
        });

        const marker = new MapLibreMarker({ element: el, anchor: 'center' })
          .setLngLat([cluster.longitude, cluster.latitude])
          .addTo(map);

        markersRef.current.push(marker);
      } else {
        const el = createVenueMarkerElement(cluster);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onMarkerClick(cluster.matches[0]);
        });

        const marker = new MapLibreMarker({ element: el, anchor: 'bottom' })
          .setLngLat([cluster.longitude, cluster.latitude])
          .addTo(map);

        markersRef.current.push(marker);

        if (cluster.isSelected) {
          const flyToSelected = () => {
            map.flyTo({
              center: [cluster.longitude, cluster.latitude],
              duration: 600,
            });
          };

          if (isLoadedRef.current) {
            flyToSelected();
          } else {
            map.once('load', flyToSelected);
          }
        }
      }
    }
  }, [clusters, currentZoom, onMarkerClick]);

  return <div ref={containerRef} className={className} />;
}
