import * as React from 'react';
import 'ol/ol.css';
import { Map as OlMap, Overlay, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import { fromLonLat } from 'ol/proj';
import OSM from 'ol/source/OSM';
import type { MapEngineProps } from '../map-engine.types';
import { groupMatchesByVenue, type VenueGroup } from '../map-utils';

function createOlMarkerElement(group: VenueGroup, isSelected: boolean): HTMLElement {
  const el = document.createElement('div');
  el.className = 'cursor-pointer transition-transform duration-200';

  const badgeHtml =
    group.matches.length > 1
      ? `<span style="position:absolute;top:-4px;right:-4px;background:#0f172a;color:#ffffff;font-size:10px;font-weight:700;width:18px;height:18px;border-radius:9999px;display:flex;align-items:center;justify-content:center;border:2px solid #ffffff;">${group.matches.length}</span>`
      : '';

  const pinColor = isSelected ? '#2563eb' : '#0f172a';
  const scale = isSelected ? 'scale(1.2)' : 'scale(1)';

  el.style.transform = scale;
  el.style.zIndex = isSelected ? '30' : '10';
  el.innerHTML = `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;">
      <svg width="34" height="40" viewBox="0 0 36 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 0C8.05888 0 0 8.05888 0 18C0 28.5 18 42 18 42C18 42 36 28.5 36 18C36 8.05888 27.9411 0 18 0Z" fill="${pinColor}"/>
        <circle cx="18" cy="18" r="10" fill="#ffffff"/>
        <circle cx="18" cy="18" r="8" fill="${pinColor}"/>
        <path d="M18 10V26M10 18H26" stroke="#ffffff" stroke-width="1.2"/>
      </svg>
      ${badgeHtml}
    </div>
  `;

  return el;
}

function createUserLocationOlElement(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'user-location-overlay pointer-events-none';
  el.innerHTML = `
    <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
      <span class="user-location-ping" style="position:absolute;width:24px;height:24px;border-radius:9999px;background-color:#3b82f6;"></span>
      <span style="position:relative;width:14px;height:14px;border-radius:9999px;background-color:#2563eb;border:2.5px solid #ffffff;box-shadow:0 0 8px rgba(37,99,235,0.8);"></span>
    </div>
  `;

  return el;
}

export function OpenLayersEngine({
  matches,
  selectedMatchId,
  center,
  zoom,
  userLocation,
  onMarkerClick,
  className = 'w-full h-full min-h-[400px]',
}: MapEngineProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<OlMap | null>(null);
  const markerOverlaysRef = React.useRef<Overlay[]>([]);
  const userLocationOverlayRef = React.useRef<Overlay | null>(null);

  // Initialize OpenLayers Map
  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const osmSource = new OSM();

    osmSource.on('tileloaderror', (e) => {
      console.error('OpenLayers tile error:', e);
    });

    const map = new OlMap({
      target: containerRef.current,
      layers: [
        new TileLayer({
          source: osmSource,
        }),
      ],
      view: new View({
        center: fromLonLat([center[1], center[0]]), // [lng, lat]
        zoom,
      }),
    });

    mapRef.current = map;

    // Trigger updateSize across multiple frames to guarantee container is ready
    map.updateSize();

    requestAnimationFrame(() => {
      map.updateSize();
    });

    setTimeout(() => {
      map.updateSize();
    }, 100);

    // ResizeObserver ensures OpenLayers updates size when switching tabs
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

  // Update Markers & Selection
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

    const groups = groupMatchesByVenue(matches, selectedMatchId);

    for (const group of groups) {
      if (group.venue.latitude == null || group.venue.longitude == null) {
        continue;
      }

      const coordinates = fromLonLat([group.venue.longitude, group.venue.latitude]);
      const markerEl = createOlMarkerElement(group, group.isSelected);

      const overlay = new Overlay({
        element: markerEl,
        className: group.isSelected
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
        onMarkerClick(group.matches[0]);
      });

      if (group.isSelected) {
        map.getView().animate({
          center: coordinates,
          duration: 600,
        });
      }
    }
  }, [matches, selectedMatchId, onMarkerClick]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
    />
  );
}
