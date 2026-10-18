import * as React from 'react';
import 'ol/ol.css';
import { Map as OlMap, Overlay, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import { fromLonLat } from 'ol/proj';
import OSM from 'ol/source/OSM';
import type { Match } from '@sundayleague/shared-types';
import type { MapEngineProps } from '../map-engine.types';
import { formatLeagueName, groupMatchesByVenue, type VenueGroup } from '../map-utils';

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

function renderOlPopupHtml(
  group: VenueGroup,
  onMarkerClick: (match: Match) => void,
  onClose: () => void,
): HTMLElement {
  const container = document.createElement('div');

  container.className =
    'rounded-lg bg-white p-3 text-slate-900 shadow-xl border border-slate-200 text-xs w-64';

  const primaryMatch = group.matches[0];
  const leagueName = formatLeagueName(primaryMatch.leagueId, primaryMatch.league?.name);

  const scoreHtml = primaryMatch.result
    ? `<div style="text-align:center;font-weight:700;margin:4px 0;color:#2563eb;">${primaryMatch.result}</div>`
    : '';

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:between;margin-bottom:4px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">
      <span style="font-size:10px;font-weight:600;color:#64748b;flex:1;">${leagueName}</span>
      <button type="button" class="close-popup-btn" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:12px;padding:0 2px;">✕</button>
    </div>
    <div style="font-weight:700;font-size:13px;margin-bottom:2px;">${primaryMatch.homeTeam.name} vs. ${primaryMatch.guestTeam.name}</div>
    ${scoreHtml}
    <div style="font-size:11px;color:#475569;margin-top:4px;">
      <div>🕒 ${primaryMatch.kickoffTime} Uhr (${primaryMatch.kickoffDate})</div>
      <div style="margin-top:2px;">📍 <strong>${group.venue.name}</strong></div>
      <div style="color:#94a3b8;font-size:10px;">${group.venue.street}, ${group.venue.city}</div>
    </div>
    <button type="button" class="select-btn" style="width:100%;margin-top:8px;padding:6px 8px;background:#2563eb;color:#ffffff;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600;">
      Spiel auswählen
    </button>
  `;

  const closeBtn = container.querySelector('.close-popup-btn');

  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    onClose();
  });

  const selectBtn = container.querySelector('.select-btn');

  selectBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    onMarkerClick(primaryMatch);
  });

  return container;
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
  const popupOverlayRef = React.useRef<Overlay | null>(null);
  const popupContainerRef = React.useRef<HTMLDivElement | null>(null);

  // Initialize OpenLayers Map
  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const popupContainer = document.createElement('div');
    popupContainerRef.current = popupContainer;

    const popupOverlay = new Overlay({
      element: popupContainer,
      className: 'ol-overlay-container ol-selectable ol-popup-overlay',
      positioning: 'bottom-center',
      offset: [0, -45],
      stopEvent: false,
    });

    popupOverlayRef.current = popupOverlay;

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
      overlays: [popupOverlay],
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
    const popupOverlay = popupOverlayRef.current;
    const popupContainer = popupContainerRef.current;

    if (!map || !popupOverlay || !popupContainer) {
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
        className: 'ol-overlay-container ol-selectable ol-marker-overlay',
        positioning: 'bottom-center',
        stopEvent: true,
      });

      overlay.setPosition(coordinates);
      map.addOverlay(overlay);
      markerOverlaysRef.current.push(overlay);

      const showPopup = () => {
        popupContainer.innerHTML = '';

        const popupContent = renderOlPopupHtml(
          group,
          onMarkerClick,
          () => popupOverlay.setPosition(undefined),
        );

        popupContainer.appendChild(popupContent);
        popupOverlay.setPosition(coordinates);
      };

      markerEl.addEventListener('click', (e) => {
        e.stopPropagation();
        onMarkerClick(group.matches[0]);
        showPopup();
      });

      if (group.isSelected) {
        map.getView().animate({
          center: coordinates,
          duration: 600,
        });
      }
    }

    // Keep popupOverlay last in DOM order so it always renders above all marker pins
    map.removeOverlay(popupOverlay);
    map.addOverlay(popupOverlay);
  }, [matches, selectedMatchId, onMarkerClick]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
    />
  );
}
