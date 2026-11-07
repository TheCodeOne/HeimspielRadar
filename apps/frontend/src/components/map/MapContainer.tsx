import * as React from 'react';
import { Loader2, LocateFixed } from 'lucide-react';
import type { Match } from '@sundayleague/shared-types';
import { MapLibreEngine } from './engines';
import type { MapEngineProps } from './map-engine.types';
import { groupMatchesByVenue, type VenueGroup } from './map-utils';

export interface MapContainerProps {
  matches: Match[];
  venueGroups?: VenueGroup[];
  selectedMatchId?: number | null;
  center?: [number, number];
  zoom?: number;
  userLocation?: [number, number] | null;
  searchLocation?: { lat: number; lng: number; name: string } | null;
  radiusKm?: number;
  showRadiusCircle?: boolean;
  onMarkerClick: (match: Match) => void;
  onLocateUser?: () => void;
  isLocating?: boolean;
  className?: string;
  mapHeightClassName?: string;
  teamQuery?: string;
}

export function MapContainer({
  matches,
  venueGroups: propVenueGroups,
  selectedMatchId,
  center = [49.15, 9.85],
  zoom = 9,
  userLocation,
  searchLocation,
  radiusKm,
  showRadiusCircle = true,
  onMarkerClick,
  onLocateUser,
  isLocating = false,
  className = '',
  mapHeightClassName,
  teamQuery,
}: MapContainerProps) {
  const venueGroups = React.useMemo(
    () => propVenueGroups ?? groupMatchesByVenue(matches, selectedMatchId),
    [propVenueGroups, matches, selectedMatchId],
  );

  const engineProps: MapEngineProps = {
    matches,
    venueGroups,
    selectedMatchId,
    center,
    zoom,
    userLocation,
    searchLocation,
    radiusKm,
    showRadiusCircle: showRadiusCircle && !teamQuery,
    onMarkerClick,
    teamQuery,
    className: mapHeightClassName ?? 'w-full h-full',
  };

  return (
    <div className={`relative flex-1 w-full h-full min-h-0 overflow-hidden ${className}`}>
      {/* Full-bleed map canvas occupying 100% width and height in an isolated z-0 stacking context */}
      <div className="absolute inset-0 z-0 isolate w-full h-full">
        <MapLibreEngine {...engineProps} />
      </div>

      {onLocateUser && (
        <button
          type="button"
          onClick={onLocateUser}
          disabled={isLocating}
          className="absolute top-[5.75rem] left-3 z-20 flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card/95 text-foreground shadow-md backdrop-blur-md transition-all hover:bg-muted active:scale-95 disabled:opacity-60 cursor-pointer"
          title="Auf meinen Standort zentrieren"
          aria-label="Auf meinen Standort zentrieren"
        >
          {isLocating ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <LocateFixed className="h-4 w-4 text-primary" />
          )}
        </button>
      )}
    </div>
  );
}
