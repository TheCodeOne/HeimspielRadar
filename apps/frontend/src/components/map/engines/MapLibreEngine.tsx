import * as React from 'react';
import {
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  NavigationControl,
  Popup as MapLibrePopup,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Match } from '@sundayleague/shared-types';
import type { MapEngineProps } from '../map-engine.types';
import { formatLeagueName, groupMatchesByVenue, type VenueGroup } from '../map-utils';

function createMarkerElement(group: VenueGroup, isSelected: boolean): HTMLElement {
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

function createPopupContent(
  group: VenueGroup,
  onMarkerClick: (match: Match) => void,
): HTMLElement {
  const container = document.createElement('div');
  container.style.padding = '8px';
  container.style.fontSize = '12px';
  container.style.maxWidth = '250px';

  const primaryMatch = group.matches[0];
  const leagueName = formatLeagueName(primaryMatch.leagueId);

  const scoreHtml = primaryMatch.result
    ? `<div style="text-align:center;font-weight:700;margin:4px 0;color:#2563eb;">${primaryMatch.result}</div>`
    : '';

  container.innerHTML = `
    <div style="font-size:10px;font-weight:600;color:#64748b;margin-bottom:4px;">${leagueName}</div>
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

  const btn = container.querySelector('.select-btn');

  btn?.addEventListener('click', () => {
    onMarkerClick(primaryMatch);
  });

  return container;
}

function createUserLocationMapLibreElement(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'user-location-marker pointer-events-none';
  el.innerHTML = `
    <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
      <span class="user-location-ping" style="position:absolute;width:24px;height:24px;border-radius:9999px;background-color:#3b82f6;"></span>
      <span style="position:relative;width:14px;height:14px;border-radius:9999px;background-color:#2563eb;border:2.5px solid #ffffff;box-shadow:0 0 8px rgba(37,99,235,0.8);"></span>
    </div>
  `;

  return el;
}

export function MapLibreEngine({
  matches,
  selectedMatchId,
  center,
  zoom,
  userLocation,
  onMarkerClick,
  className = 'w-full h-full min-h-[400px]',
}: MapEngineProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const markersRef = React.useRef<MapLibreMarker[]>([]);
  const userMarkerRef = React.useRef<MapLibreMarker | null>(null);

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

    map.addControl(new NavigationControl(), 'top-right');
    mapRef.current = map;

    return () => {
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

    const el = createUserLocationMapLibreElement();

    const marker = new MapLibreMarker({ element: el })
      .setLngLat([userLocation[1], userLocation[0]])
      .addTo(map);

    userMarkerRef.current = marker;
  }, [userLocation]);

  // Update markers
  React.useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    // Clean up previous markers
    for (const marker of markersRef.current) {
      marker.remove();
    }

    markersRef.current = [];

    const groups = groupMatchesByVenue(matches, selectedMatchId);

    for (const group of groups) {
      if (group.venue.latitude == null || group.venue.longitude == null) {
        continue;
      }

      const el = createMarkerElement(group, group.isSelected);

      el.addEventListener('click', () => {
        onMarkerClick(group.matches[0]);
      });

      const popup = new MapLibrePopup({ offset: 25, closeButton: true });
      popup.setDOMContent(createPopupContent(group, onMarkerClick));

      const marker = new MapLibreMarker({ element: el })
        .setLngLat([group.venue.longitude, group.venue.latitude])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);

      if (group.isSelected) {
        map.flyTo({
          center: [group.venue.longitude, group.venue.latitude],
          duration: 600,
        });
      }
    }
  }, [matches, selectedMatchId, onMarkerClick]);

  return <div ref={containerRef} className={className} />;
}
