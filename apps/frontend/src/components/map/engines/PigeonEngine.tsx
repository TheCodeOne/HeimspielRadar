import * as React from 'react';
import { Map, Overlay, ZoomControl } from 'pigeon-maps';
import type { MapEngineProps } from '../map-engine.types';
import { groupMatchesByVenue } from '../map-utils';
import { VenuePopup } from '../VenuePopup';

function osmSubdomainProvider(x: number, y: number, z: number): string {
  const subdomains = ['a', 'b', 'c'];
  const s = subdomains[Math.abs(x + y) % subdomains.length];

  return `https://${s}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

export function PigeonEngine({
  matches,
  selectedMatchId,
  center,
  zoom,
  userLocation,
  onMarkerClick,
  className = 'w-full h-full min-h-[400px]',
}: MapEngineProps) {
  const [mapCenter, setMapCenter] = React.useState<[number, number]>(center);
  const [mapZoom, setMapZoom] = React.useState<number>(zoom);
  const [activePopupVenueId, setActivePopupVenueId] = React.useState<number | null>(null);

  const groups = groupMatchesByVenue(matches, selectedMatchId);

  // Sync center when center prop changes
  React.useEffect(() => {
    setMapCenter(center);
  }, [center[0], center[1]]);

  // Sync center when selection changes

  React.useEffect(() => {
    const selectedGroup = groups.find((g) => g.isSelected);

    if (
      selectedGroup &&
      selectedGroup.venue.latitude != null &&
      selectedGroup.venue.longitude != null
    ) {
      setMapCenter([selectedGroup.venue.latitude, selectedGroup.venue.longitude]);
    }
  }, [selectedMatchId]);

  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`}>
      <Map
        center={mapCenter}
        zoom={mapZoom}
        height={450}
        provider={osmSubdomainProvider}
        onBoundsChanged={({ center: newCenter, zoom: newZoom }) => {
          setMapCenter(newCenter);
          setMapZoom(newZoom);
        }}
      >
        <ZoomControl />

        {userLocation && (
          <Overlay anchor={userLocation} offset={[12, 12]}>
            <div
              className="relative flex h-6 w-6 items-center justify-center pointer-events-none"
              title="📍 Mein Standort"
            >
              <span className="user-location-ping absolute h-6 w-6 rounded-full bg-blue-500 opacity-75" />
              <span className="relative h-3.5 w-3.5 rounded-full border-2 border-white bg-blue-600 shadow-md" />
            </div>
          </Overlay>
        )}

        {groups.map((group) => {
          if (group.venue.latitude == null || group.venue.longitude == null) {
            return null;
          }

          const isSelected = group.isSelected;
          const pinColor = isSelected ? '#2563eb' : '#0f172a';
          const scale = isSelected ? 'scale(1.2)' : 'scale(1)';
          const isPopupOpen = activePopupVenueId === group.venueId;

          return (
            <Overlay
              key={group.venueId}
              anchor={[group.venue.latitude, group.venue.longitude]}
              offset={[17, 40]}
            >
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    onMarkerClick(group.matches[0]);
                    setActivePopupVenueId(
                      activePopupVenueId === group.venueId ? null : group.venueId,
                    );
                  }}
                  className="cursor-pointer transition-transform duration-200 focus:outline-none"
                  style={{ transform: scale }}
                  aria-label={`${group.venue.name} (${group.matches.length} Spiele)`}
                >
                  <div className="relative flex items-center justify-center">
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
                      <circle cx="18" cy="18" r="10" fill="#ffffff" />
                      <circle cx="18" cy="18" r="8" fill={pinColor} />
                      <path
                        d="M18 10V26M10 18H26"
                        stroke="#ffffff"
                        strokeWidth="1.2"
                      />
                    </svg>

                    {group.matches.length > 1 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-[10px] font-bold text-white shadow-xs">
                        {group.matches.length}
                      </span>
                    )}
                  </div>
                </button>

                {isPopupOpen && (
                  <div className="absolute bottom-full left-1/2 z-50 mb-3 -translate-x-1/2">
                    <VenuePopup
                      group={group}
                      onMarkerClick={onMarkerClick}
                      onClose={() => setActivePopupVenueId(null)}
                    />
                  </div>
                )}
              </div>
            </Overlay>
          );
        })}
      </Map>
    </div>
  );
}
