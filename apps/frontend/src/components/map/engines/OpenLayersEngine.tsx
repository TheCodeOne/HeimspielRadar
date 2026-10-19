import * as React from 'react';
import 'ol/ol.css';
import { Map as OlMap, Overlay, View } from 'ol';
import { boundingExtent } from 'ol/extent';
import Feature from 'ol/Feature';
import { circular as circularPolygon } from 'ol/geom/Polygon';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import { fromLonLat } from 'ol/proj';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import { Fill, Stroke, Style } from 'ol/style';
import type { MapEngineProps } from '../map-engine.types';
import {
  clusterVenueGroups,
  getBasketballPinHtml,
  getClusterBadgeHtml,
  getSearchCenterPinHtml,
  getUserLocationPinHtml,
  groupMatchesByVenue,
  type VenueCluster,
} from '../map-utils';

function createOlMarkerElement(cluster: VenueCluster): HTMLElement {
  const el = document.createElement('div');
  el.className = 'cursor-pointer transition-transform duration-200';
  el.style.zIndex = cluster.isSelected ? '30' : '10';
  el.innerHTML = getBasketballPinHtml(cluster.isSelected, cluster.matchCount);

  return el;
}

function createOlClusterElement(cluster: VenueCluster): HTMLElement {
  const el = document.createElement('div');
  el.className = 'cursor-pointer transition-transform duration-200';
  el.style.zIndex = cluster.isSelected ? '30' : '20';
  el.innerHTML = getClusterBadgeHtml(cluster.matchCount, cluster.isSelected);

  return el;
}

function createSearchCenterOlElement(cityName: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'search-center-overlay pointer-events-auto';
  el.innerHTML = getSearchCenterPinHtml(cityName);

  return el;
}

function createUserLocationOlElement(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'user-location-overlay pointer-events-none';
  el.innerHTML = getUserLocationPinHtml();

  return el;
}

export function OpenLayersEngine({
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
  const mapRef = React.useRef<OlMap | null>(null);
  const [currentZoom, setCurrentZoom] = React.useState<number>(zoom);

  const markerOverlaysRef = React.useRef<Overlay[]>([]);
  const userLocationOverlayRef = React.useRef<Overlay | null>(null);
  const searchCenterOverlayRef = React.useRef<Overlay | null>(null);
  const radiusVectorLayerRef = React.useRef<VectorLayer<VectorSource> | null>(null);

  const groups = React.useMemo(
    () => groupMatchesByVenue(matches, selectedMatchId),
    [matches, selectedMatchId],
  );

  const clusters = React.useMemo(
    () => clusterVenueGroups(groups, currentZoom),
    [groups, currentZoom],
  );

  // Initialize OpenLayers Map
  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const osmSource = new OSM();

    osmSource.on('tileloaderror', (e) => {
      console.error('OpenLayers tile error:', e);
    });

    const radiusSource = new VectorSource();

    const radiusLayer = new VectorLayer({
      source: radiusSource,
      zIndex: 1,
      style: new Style({
        stroke: new Stroke({
          color: '#ea580c',
          width: 1.5,
          lineDash: [6, 4],
        }),
        fill: new Fill({
          color: 'rgba(234, 88, 12, 0.08)',
        }),
      }),
    });

    radiusVectorLayerRef.current = radiusLayer;

    const map = new OlMap({
      target: containerRef.current,
      layers: [
        new TileLayer({
          source: osmSource,
        }),
        radiusLayer,
      ],
      view: new View({
        center: fromLonLat([center[1], center[0]]), // [lng, lat]
        zoom,
      }),
    });

    mapRef.current = map;

    // Listen to zoom / resolution changes
    map.getView().on('change:resolution', () => {
      const z = map.getView().getZoom();

      if (z != null) {
        setCurrentZoom(Math.round(z));
      }
    });

    map.updateSize();

    requestAnimationFrame(() => {
      map.updateSize();
    });

    setTimeout(() => {
      map.updateSize();
    }, 100);

    const resizeObserver = new ResizeObserver(() => {
      map.updateSize();
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.dispose();
      mapRef.current = null;
    };
  }, []);

  // Update center smoothly when center coordinate changes
  React.useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    map.getView().animate({
      center: fromLonLat([center[1], center[0]]),
      duration: 600,
    });
  }, [center[0], center[1]]);

  // Update User Location Overlay
  React.useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (userLocationOverlayRef.current) {
      map.removeOverlay(userLocationOverlayRef.current);
      userLocationOverlayRef.current = null;
    }

    if (!userLocation) {
      return;
    }

    const userElement = createUserLocationOlElement();

    const overlay = new Overlay({
      element: userElement,
      positioning: 'center-center',
      stopEvent: false,
    });

    overlay.setPosition(fromLonLat([userLocation[1], userLocation[0]]));
    map.addOverlay(overlay);
    userLocationOverlayRef.current = overlay;
  }, [userLocation]);

  // Update Search Center Marker Overlay
  React.useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (searchCenterOverlayRef.current) {
      map.removeOverlay(searchCenterOverlayRef.current);
      searchCenterOverlayRef.current = null;
    }

    if (!searchLocation || searchLocation.name === 'Mein Standort') {
      return;
    }

    const searchElement = createSearchCenterOlElement(searchLocation.name);

    const overlay = new Overlay({
      element: searchElement,
      positioning: 'bottom-center',
      stopEvent: false,
    });

    overlay.setPosition(fromLonLat([searchLocation.lng, searchLocation.lat]));
    map.addOverlay(overlay);
    searchCenterOverlayRef.current = overlay;
  }, [searchLocation]);

  // Update Radius Circle Vector Feature
  React.useEffect(() => {
    const layer = radiusVectorLayerRef.current;

    if (!layer) {
      return;
    }

    const source = layer.getSource();

    if (!source) {
      return;
    }

    source.clear();

    if (
      !showRadiusCircle ||
      !searchLocation ||
      radiusKm == null ||
      radiusKm <= 0
    ) {
      return;
    }

    const circlePoly = circularPolygon(
      [searchLocation.lng, searchLocation.lat],
      radiusKm * 1000,
      64,
    ).transform('EPSG:4326', 'EPSG:3857');

    const feature = new Feature({
      geometry: circlePoly,
    });

    source.addFeature(feature);
  }, [searchLocation, radiusKm, showRadiusCircle]);

  // Update Markers & Cluster Overlays
  React.useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    // Clean up previous marker overlays
    for (const overlay of markerOverlaysRef.current) {
      map.removeOverlay(overlay);
    }

    markerOverlaysRef.current = [];

    for (const cluster of clusters) {
      const coordinates = fromLonLat([cluster.longitude, cluster.latitude]);

      if (cluster.isCluster) {
        const clusterEl = createOlClusterElement(cluster);

        const overlay = new Overlay({
          element: clusterEl,
          positioning: 'center-center',
          stopEvent: true,
        });

        overlay.setPosition(coordinates);
        map.addOverlay(overlay);
        markerOverlaysRef.current.push(overlay);

        clusterEl.addEventListener('click', (e) => {
          e.stopPropagation();

          const isSinglePoint =
            Math.abs(cluster.bounds.maxLat - cluster.bounds.minLat) < 0.0001 &&
            Math.abs(cluster.bounds.maxLng - cluster.bounds.minLng) < 0.0001;

          if (currentZoom >= 15 || isSinglePoint) {
            onMarkerClick(cluster.matches[0]);
          } else {
            const extent = boundingExtent([
              fromLonLat([cluster.bounds.minLng, cluster.bounds.minLat]),
              fromLonLat([cluster.bounds.maxLng, cluster.bounds.maxLat]),
            ]);

            map.getView().fit(extent, {
              padding: [50, 50, 50, 50],
              maxZoom: 15,
              duration: 500,
            });
          }
        });
      } else {
        const markerEl = createOlMarkerElement(cluster);

        const overlay = new Overlay({
          element: markerEl,
          className: cluster.isSelected
            ? 'ol-overlay-container ol-selectable ol-marker-overlay ol-marker-selected'
            : 'ol-overlay-container ol-selectable ol-marker-overlay',
          positioning: 'bottom-center',
          stopEvent: true,
        });

        overlay.setPosition(coordinates);
        map.addOverlay(overlay);
        markerOverlaysRef.current.push(overlay);

        markerEl.addEventListener('click', (e) => {
          e.stopPropagation();
          onMarkerClick(cluster.matches[0]);
        });

        if (cluster.isSelected) {
          map.getView().animate({
            center: coordinates,
            duration: 600,
          });
        }
      }
    }
  }, [clusters, currentZoom, onMarkerClick]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
    />
  );
}
