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
  createGeoJsonCircle,
  getBasketballPinHtml,
  getClusterBadgeHtml,
  getSearchCenterPinHtml,
  getUserLocationPinHtml,
  groupMatchesByVenue,
  type VenueCluster,
} from '../map-utils';

// Configure MapLibre Web Worker for Vite
setWorkerUrl(workerUrl);

function createVenueMarkerElement(cluster: VenueCluster): HTMLElement {
  const el = document.createElement('div');
  el.className = 'cursor-pointer transition-transform duration-200';
  el.style.zIndex = cluster.isSelected ? '30' : '10';
  el.innerHTML = getBasketballPinHtml(cluster.isSelected, cluster.matchCount);

  return el;
}

function createClusterMarkerElement(cluster: VenueCluster): HTMLElement {
  const el = document.createElement('div');
  el.className = 'cursor-pointer transition-transform duration-200';
  el.style.zIndex = cluster.isSelected ? '30' : '20';
  el.innerHTML = getClusterBadgeHtml(cluster.matchCount, cluster.isSelected);

  return el;
}

function createSearchCenterElement(cityName: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'search-center-marker pointer-events-auto';
  el.innerHTML = getSearchCenterPinHtml(cityName);

  return el;
}

function createUserLocationElement(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'user-location-marker pointer-events-none';
  el.innerHTML = getUserLocationPinHtml();

  return el;
}

export function MapLibreEngine({
  matches,
  selectedMatchId,
  center,
  zoom,
  userLocation,
  searchLocation,
  radiusKm,
  showRadiusCircle = true,
  onMarkerClick,
  className = 'w-full h-full min-h-[400px]',
}: MapEngineProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const markersRef = React.useRef<MapLibreMarker[]>([]);
  const userMarkerRef = React.useRef<MapLibreMarker | null>(null);
  const searchMarkerRef = React.useRef<MapLibreMarker | null>(null);
  const isLoadedRef = React.useRef<boolean>(false);
  const [currentZoom, setCurrentZoom] = React.useState<number>(zoom);

  const groups = React.useMemo(
    () => groupMatchesByVenue(matches, selectedMatchId),
    [matches, selectedMatchId],
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

  // Update center smoothly when center coordinate changes
  React.useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    map.flyTo({
      center: [center[1], center[0]],
      duration: 600,
    });
  }, [center[0], center[1]]);

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

    const el = createUserLocationElement();

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

    const el = createSearchCenterElement(searchLocation.name);

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
