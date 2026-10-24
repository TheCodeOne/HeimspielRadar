import * as React from 'react';
import type { Match, Venue } from '@sundayleague/shared-types';
import { compareMatchesChronologically } from '@/lib/date-utils';

export interface VenueGroup {
  venueId: number;
  venue: Venue;
  matches: Match[];
  isSelected: boolean;
}

export interface VenueCluster {
  id: string;
  isCluster: boolean;
  latitude: number;
  longitude: number;
  venueGroups: VenueGroup[];
  matches: Match[];
  matchCount: number;
  isSelected: boolean;
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}

export function isSameVenue(
  a?: Venue | Match | null,
  b?: Venue | Match | null,
): boolean {
  if (!a || !b) {
    return false;
  }

  const venueA = 'venue' in a ? a.venue : a;
  const venueB = 'venue' in b ? b.venue : b;

  if (!venueA || !venueB) {
    return false;
  }

  if (venueA.id != null && venueB.id != null && venueA.id === venueB.id) {
    return true;
  }

  return (
    venueA.latitude != null &&
    venueB.latitude != null &&
    venueA.longitude != null &&
    venueB.longitude != null &&
    venueA.latitude === venueB.latitude &&
    venueA.longitude === venueB.longitude
  );
}

export function groupMatchesByVenue(
  matches: Match[],
  selectedMatchId?: number | null,
): VenueGroup[] {
  const groups: VenueGroup[] = [];

  for (const match of matches) {
    if (!match.venue || match.venue.latitude == null || match.venue.longitude == null) {
      continue;
    }

    const existing = groups.find((g) => isSameVenue(g.venue, match.venue));

    if (existing) {
      existing.matches.push(match);

      if (match.id === selectedMatchId) {
        existing.isSelected = true;
      }
    } else {
      groups.push({
        venueId: match.venue.id,
        venue: match.venue,
        matches: [match],
        isSelected: match.id === selectedMatchId,
      });
    }
  }

  for (const group of groups) {
    group.matches.sort(compareMatchesChronologically);
  }

  return groups;
}

export type ValidVenueGroup = VenueGroup & {
  venue: Venue & { latitude: number; longitude: number };
};

function isValidVenueGroup(group: VenueGroup): group is ValidVenueGroup {
  return group.venue.latitude != null && group.venue.longitude != null;
}

export function latLngToMercatorPixels(
  lat: number,
  lng: number,
  zoom: number,
): [number, number] {
  const x = ((lng + 180) / 360) * 256 * Math.pow(2, zoom);
  const sinLat = Math.max(-0.9999, Math.min(0.9999, Math.sin((lat * Math.PI) / 180)));

  const y =
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) *
    256 *
    Math.pow(2, zoom);

  return [x, y];
}

export function clusterVenueGroups(
  groups: VenueGroup[],
  zoom: number,
  clusterRadiusPixels = 48,
): VenueCluster[] {
  if (groups.length === 0) {
    return [];
  }

  const validGroups = groups.filter(isValidVenueGroup);

  // If zoomed in close (zoom >= 15), keep all venues individual
  if (zoom >= 15) {
    return validGroups.map((group) => ({
      id: `venue-${group.venueId}`,
      isCluster: false,
      latitude: group.venue.latitude,
      longitude: group.venue.longitude,
      venueGroups: [group],
      matches: group.matches,
      matchCount: group.matches.length,
      isSelected: group.isSelected,
      bounds: {
        minLat: group.venue.latitude,
        maxLat: group.venue.latitude,
        minLng: group.venue.longitude,
        maxLng: group.venue.longitude,
      },
    }));
  }

  interface InternalCluster {
    groups: ValidVenueGroup[];
    pixelX: number;
    pixelY: number;
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  }

  const internalClusters: InternalCluster[] = [];

  for (const group of validGroups) {
    const lat = group.venue.latitude;
    const lng = group.venue.longitude;
    const [px, py] = latLngToMercatorPixels(lat, lng, zoom);

    let closestCluster: InternalCluster | null = null;
    let closestDistSq = clusterRadiusPixels * clusterRadiusPixels;

    for (const cluster of internalClusters) {
      const dx = cluster.pixelX - px;
      const dy = cluster.pixelY - py;
      const distSq = dx * dx + dy * dy;

      if (distSq <= closestDistSq) {
        closestDistSq = distSq;
        closestCluster = cluster;
      }
    }

    if (closestCluster) {
      closestCluster.groups.push(group);
      closestCluster.minLat = Math.min(closestCluster.minLat, lat);
      closestCluster.maxLat = Math.max(closestCluster.maxLat, lat);
      closestCluster.minLng = Math.min(closestCluster.minLng, lng);
      closestCluster.maxLng = Math.max(closestCluster.maxLng, lng);

      const count = closestCluster.groups.length;
      closestCluster.pixelX = (closestCluster.pixelX * (count - 1) + px) / count;
      closestCluster.pixelY = (closestCluster.pixelY * (count - 1) + py) / count;
    } else {
      internalClusters.push({
        groups: [group],
        pixelX: px,
        pixelY: py,
        minLat: lat,
        maxLat: lat,
        minLng: lng,
        maxLng: lng,
      });
    }
  }

  return internalClusters.map((cluster, index) => {
    const isCluster = cluster.groups.length > 1;
    const allMatches: Match[] = [];
    let isSelected = false;
    let sumLat = 0;
    let sumLng = 0;

    for (const g of cluster.groups) {
      allMatches.push(...g.matches);

      if (g.isSelected) {
        isSelected = true;
      }

      sumLat += g.venue.latitude;
      sumLng += g.venue.longitude;
    }

    allMatches.sort(compareMatchesChronologically);

    const lat = sumLat / cluster.groups.length;
    const lng = sumLng / cluster.groups.length;

    return {
      id: isCluster ? `cluster-${index}` : `venue-${cluster.groups[0].venueId}`,
      isCluster,
      latitude: lat,
      longitude: lng,
      venueGroups: cluster.groups,
      matches: allMatches,
      matchCount: allMatches.length,
      isSelected,
      bounds: {
        minLat: cluster.minLat,
        maxLat: cluster.maxLat,
        minLng: cluster.minLng,
        maxLng: cluster.maxLng,
      },
    };
  });
}

export function formatLeagueName(leagueId: number, leagueName?: string): string {
  if (leagueName) {
    return leagueName;
  }

  if (leagueId === 1) {
    return 'Oberliga Württemberg';
  }

  if (leagueId === 2) {
    return 'Landesliga';
  }

  return `Liga #${leagueId}`;
}

export function calculateRadiusInPixels(
  lat: number,
  zoom: number,
  radiusKm: number,
): number {
  const metersPerPixel =
    (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);

  return (radiusKm * 1000) / metersPerPixel;
}

export interface GeoJsonCircleFeature {
  type: 'Feature';
  properties: Record<string, string | number | boolean>;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}

export function createGeoJsonCircle(
  center: [number, number], // [lng, lat]
  radiusKm: number,
  points = 64,
): GeoJsonCircleFeature {
  const [lng, lat] = center;
  const coords: number[][] = [];
  const distanceX = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const distanceY = radiusKm / 110.574;

  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lng + x, lat + y]);
  }

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
  };
}

export function getBasketballPinSvg(isSelected: boolean): string {
  const pinColor = isSelected ? '#2563eb' : '#0f172a';

  return `<svg width="34" height="40" viewBox="0 0 36 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 0C8.05888 0 0 8.05888 0 18C0 28.5 18 42 18 42C18 42 36 28.5 36 18C36 8.05888 27.9411 0 18 0Z" fill="${pinColor}"/><circle cx="18" cy="18" r="11" fill="#ffffff"/><circle cx="18" cy="18" r="9.5" fill="#f97316" stroke="#0f172a" stroke-width="0.8"/><line x1="18" y1="8.5" x2="18" y2="27.5" stroke="#0f172a" stroke-width="0.9" stroke-linecap="round"/><line x1="8.5" y1="18" x2="27.5" y2="18" stroke="#0f172a" stroke-width="0.9" stroke-linecap="round"/><path d="M 11.3 11.3 C 15.3 14.7 15.3 21.3 11.3 24.7" stroke="#0f172a" stroke-width="0.9" stroke-linecap="round" fill="none"/><path d="M 24.7 11.3 C 20.7 14.7 20.7 21.3 24.7 24.7" stroke="#0f172a" stroke-width="0.9" stroke-linecap="round" fill="none"/></svg>`;
}

export function BasketballPinSvg({ isSelected }: { isSelected: boolean }) {
  const pinColor = isSelected ? '#2563eb' : '#0f172a';

  return (
    <svg
      width="34"
      height="40"
      viewBox="0 0 36 42"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M18 0C8.05888 0 0 8.05888 0 18C0 28.5 18 42 18 42C18 42 36 28.5 36 18C36 8.05888 27.9411 0 18 0Z"
        fill={pinColor}
      />
      <circle cx="18" cy="18" r="11" fill="#ffffff" />
      <circle cx="18" cy="18" r="9.5" fill="#f97316" stroke="#0f172a" strokeWidth="0.8" />
      <line x1="18" y1="8.5" x2="18" y2="27.5" stroke="#0f172a" strokeWidth="0.9" strokeLinecap="round" />
      <line x1="8.5" y1="18" x2="27.5" y2="18" stroke="#0f172a" strokeWidth="0.9" strokeLinecap="round" />
      <path
        d="M 11.3 11.3 C 15.3 14.7 15.3 21.3 11.3 24.7"
        stroke="#0f172a"
        strokeWidth="0.9"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 24.7 11.3 C 20.7 14.7 20.7 21.3 24.7 24.7"
        stroke="#0f172a"
        strokeWidth="0.9"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function getBasketballPinHtml(isSelected: boolean, matchCount: number): string {
  const scale = isSelected ? 'scale(1.2)' : 'scale(1)';
  const zIndex = isSelected ? '30' : '10';

  const badgeHtml =
    matchCount > 1
      ? `<span class="pin-match-badge" style="position:absolute;top:-4px;right:-4px;background:#0f172a;color:#ffffff;font-size:10px;font-weight:700;width:18px;height:18px;border-radius:9999px;display:flex;align-items:center;justify-content:center;border:2px solid #ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.3);">${matchCount}</span>`
      : '';

  return `
    <div style="transform:${scale};transition:transform 0.2s;position:relative;display:flex;align-items:center;justify-content:center;width:34px;height:40px;z-index:${zIndex};">
      ${getBasketballPinSvg(isSelected)}
      ${badgeHtml}
    </div>
  `;
}

export function getClusterBadgeHtml(matchCount: number, isSelected: boolean): string {
  const borderStyle = isSelected
    ? 'border:3px solid #2563eb;box-shadow:0 0 0 2px #ffffff, 0 4px 14px rgba(37,99,235,0.5);'
    : 'border:3px solid #ffffff;box-shadow:0 4px 12px rgba(234,88,12,0.45), 0 2px 4px rgba(0,0,0,0.2);';

  return `
    <div class="cluster-badge" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:46px;height:46px;padding:0 8px;border-radius:9999px;background:linear-gradient(135deg, #f97316 0%, #ea580c 100%);color:#ffffff;${borderStyle}cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;user-select:none;transform:scale(1);">
      <div style="display:flex;align-items:center;gap:3px;">
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none" style="flex-shrink:0;">
          <circle cx="10" cy="10" r="9" fill="#ffffff"/>
          <circle cx="10" cy="10" r="7.5" fill="#f97316" stroke="#0f172a" stroke-width="0.8"/>
          <line x1="10" y1="2.5" x2="10" y2="17.5" stroke="#0f172a" stroke-width="0.8"/>
          <line x1="2.5" y1="10" x2="17.5" y2="10" stroke="#0f172a" stroke-width="0.8"/>
          <path d="M 4.7 4.7 C 7.8 7.4 7.8 12.6 4.7 15.3" stroke="#0f172a" stroke-width="0.8" fill="none"/>
          <path d="M 15.3 4.7 C 12.2 7.4 12.2 12.6 15.3 15.3" stroke="#0f172a" stroke-width="0.8" fill="none"/>
        </svg>
        <span style="font-size:12px;font-weight:800;letter-spacing:-0.02em;line-height:1;font-family:system-ui,sans-serif;">${matchCount}</span>
      </div>
      <span style="font-size:9px;font-weight:700;opacity:0.95;line-height:1;margin-top:1px;font-family:system-ui,sans-serif;">${matchCount === 1 ? 'Spiel' : 'Spiele'}</span>
    </div>
  `;
}

export function getSearchCenterPinHtml(cityName: string): string {
  return `
    <div class="search-center-marker" style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:default;user-select:none;pointer-events:auto;">
      <div style="background:#0f172a;color:#ffffff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:9999px;border:1.5px solid #ef4444;box-shadow:0 2px 6px rgba(0,0,0,0.3);white-space:nowrap;margin-bottom:2px;display:flex;align-items:center;gap:4px;">
        <span style="color:#ef4444;font-size:10px;">🎯</span>
        <span>${cityName}</span>
      </div>
      <div style="position:relative;width:32px;height:38px;display:flex;align-items:center;justify-content:center;">
        <svg width="32" height="38" viewBox="0 0 36 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 0C8.05888 0 0 8.05888 0 18C0 28.5 18 42 18 42C18 42 36 28.5 36 18C36 8.05888 27.9411 0 18 0Z" fill="#ef4444"/>
          <circle cx="18" cy="18" r="10" fill="#ffffff"/>
          <circle cx="18" cy="18" r="7" fill="#dc2626"/>
          <circle cx="18" cy="18" r="3.5" fill="#ffffff"/>
          <circle cx="18" cy="18" r="1.8" fill="#dc2626"/>
          <line x1="18" y1="8" x2="18" y2="12" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="18" y1="24" x2="18" y2="28" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="8" y1="18" x2="12" y2="18" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="24" y1="18" x2="28" y2="18" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
    </div>
  `;
}

export function getUserLocationPinHtml(): string {
  return `
    <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
      <span class="user-location-ping" style="position:absolute;width:24px;height:24px;border-radius:9999px;background-color:#3b82f6;"></span>
      <span style="position:relative;width:14px;height:14px;border-radius:9999px;background-color:#2563eb;border:2.5px solid #ffffff;box-shadow:0 0 8px rgba(37,99,235,0.8);"></span>
    </div>
  `;
}

export function createVenueMarkerElement(clusterOrGroup: {
  isSelected: boolean;
  matchCount?: number;
  matches?: Match[];
}): HTMLElement {
  const matchCount =
    clusterOrGroup.matchCount ?? clusterOrGroup.matches?.length ?? 1;

  const isSelected = clusterOrGroup.isSelected;

  const el = document.createElement('div');
  el.className = 'cursor-pointer transition-transform duration-200';
  el.style.zIndex = isSelected ? '30' : '10';
  el.innerHTML = getBasketballPinHtml(isSelected, matchCount);

  return el;
}

export function createClusterMarkerElement(cluster: {
  matchCount: number;
  isSelected: boolean;
}): HTMLElement {
  const el = document.createElement('div');
  el.className = 'cursor-pointer transition-transform duration-200';
  el.style.zIndex = cluster.isSelected ? '30' : '20';
  el.innerHTML = getClusterBadgeHtml(cluster.matchCount, cluster.isSelected);

  return el;
}

export function createSearchCenterMarkerElement(cityName: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'search-center-marker pointer-events-auto';
  el.innerHTML = getSearchCenterPinHtml(cityName);

  return el;
}

export function createUserLocationMarkerElement(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'user-location-marker pointer-events-none';
  el.innerHTML = getUserLocationPinHtml();

  return el;
}

export function BasketballPinMarker({
  isSelected,
  matchCount,
}: {
  isSelected: boolean;
  matchCount: number;
}) {
  const scale = isSelected ? 'scale(1.2)' : 'scale(1)';

  return (
    <div
      className="relative flex items-center justify-center transition-transform duration-200"
      style={{ transform: scale }}
    >
      <BasketballPinSvg isSelected={isSelected} />

      {matchCount > 1 && (
        <span className="pin-match-badge absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-[10px] font-bold text-white shadow-xs">
          {matchCount}
        </span>
      )}
    </div>
  );
}

export function ClusterBadgeMarker({
  matchCount,
  isSelected,
}: {
  matchCount: number;
  isSelected: boolean;
}) {
  const borderClasses = isSelected
    ? 'border-3 border-blue-600 shadow-[0_0_0_2px_#ffffff,0_4px_14px_rgba(37,99,235,0.5)]'
    : 'border-3 border-white shadow-[0_4px_12px_rgba(234,88,12,0.45),0_2px_4px_rgba(0,0,0,0.2)]';

  return (
    <div
      className={`cluster-badge flex flex-col items-center justify-center min-w-[46px] h-[46px] px-2 rounded-full bg-linear-to-br from-orange-500 to-orange-600 text-white select-none transition-transform active:scale-95 cursor-pointer ${borderClasses}`}
    >
      <div className="flex items-center gap-0.5">
        <svg
          width="13"
          height="13"
          viewBox="0 0 20 20"
          fill="none"
          className="shrink-0"
        >
          <circle cx="10" cy="10" r="9" fill="#ffffff" />
          <circle cx="10" cy="10" r="7.5" fill="#f97316" stroke="#0f172a" strokeWidth="0.8" />
          <line x1="10" y1="2.5" x2="10" y2="17.5" stroke="#0f172a" strokeWidth="0.8" />
          <line x1="2.5" y1="10" x2="17.5" y2="10" stroke="#0f172a" strokeWidth="0.8" />
          <path d="M 4.7 4.7 C 7.8 7.4 7.8 12.6 4.7 15.3" stroke="#0f172a" strokeWidth="0.8" fill="none" />
          <path d="M 15.3 4.7 C 12.2 7.4 12.2 12.6 15.3 15.3" stroke="#0f172a" strokeWidth="0.8" fill="none" />
        </svg>
        <span className="font-extrabold text-xs tracking-tight leading-none font-sans">
          {matchCount}
        </span>
      </div>
      <span className="font-bold text-[9px] leading-none mt-0.5 opacity-95 font-sans">
        {matchCount === 1 ? 'Spiel' : 'Spiele'}
      </span>
    </div>
  );
}

export function SearchCenterMarker({ cityName }: { cityName: string }) {
  return (
    <div className="search-center-marker relative flex flex-col items-center select-none pointer-events-auto">
      <div className="mb-0.5 flex items-center gap-1 rounded-full border border-red-500 bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white shadow-md whitespace-nowrap">
        <span className="text-[10px] text-red-500">🎯</span>
        <span>{cityName}</span>
      </div>
      <div className="relative flex h-[38px] w-[32px] items-center justify-center">
        <svg width="32" height="38" viewBox="0 0 36 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M18 0C8.05888 0 0 8.05888 0 18C0 28.5 18 42 18 42C18 42 36 28.5 36 18C36 8.05888 27.9411 0 18 0Z"
            fill="#ef4444"
          />
          <circle cx="18" cy="18" r="10" fill="#ffffff" />
          <circle cx="18" cy="18" r="7" fill="#dc2626" />
          <circle cx="18" cy="18" r="3.5" fill="#ffffff" />
          <circle cx="18" cy="18" r="1.8" fill="#dc2626" />
          <line x1="18" y1="8" x2="18" y2="12" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="18" y1="24" x2="18" y2="28" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="8" y1="18" x2="12" y2="18" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="24" y1="18" x2="28" y2="18" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

export function UserLocationMarker() {
  return (
    <div className="relative flex h-6 w-6 items-center justify-center pointer-events-none" title="📍 Mein Standort">
      <span className="user-location-ping absolute h-6 w-6 rounded-full bg-blue-500 opacity-75" />
      <span className="relative h-3.5 w-3.5 rounded-full border-2 border-white bg-blue-600 shadow-md" />
    </div>
  );
}
