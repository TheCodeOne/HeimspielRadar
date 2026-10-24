import * as React from 'react';
import { Map, Overlay, ZoomControl } from 'pigeon-maps';
import type { MapEngineProps } from '../map-engine.types';
import {
  BasketballPinMarker,
  calculateRadiusInPixels,
  ClusterBadgeMarker,
  clusterVenueGroups,
  groupMatchesByVenue,
  SearchCenterMarker,
  UserLocationMarker,
  type VenueCluster,
} from '../map-utils';

function osmSubdomainProvider(x: number, y: number, z: number): string {
  const subdomains = ['a', 'b', 'c'];
  const s = subdomains[Math.abs(x + y) % subdomains.length];

  return `https://${s}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

export function PigeonEngine({
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
  className = 'w-full h-full',
}: MapEngineProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = React.useState<{ width?: number; height?: number }>({});
  const [mapCenter, setMapCenter] = React.useState<[number, number]>(center);
  const [mapZoom, setMapZoom] = React.useState<number>(zoom);

  const groups = React.useMemo(
    () => venueGroups ?? groupMatchesByVenue(matches, selectedMatchId),
    [venueGroups, matches, selectedMatchId],
  );

  const clusters = React.useMemo(
    () => clusterVenueGroups(groups, Math.round(mapZoom)),
    [groups, mapZoom],
  );

  React.useEffect(() => {
    const el = containerRef.current;

    if (!el) {
      return;
    }

    const updateDimensions = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        setDimensions({
          width: el.clientWidth,
          height: el.clientHeight,
        });
      }
    };

    updateDimensions();

    const observer = new ResizeObserver(() => {
      updateDimensions();
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

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

  const handleClusterClick = (cluster: VenueCluster) => {
    if (cluster.isCluster) {
      const isSinglePoint =
        Math.abs(cluster.bounds.maxLat - cluster.bounds.minLat) < 0.0001 &&
        Math.abs(cluster.bounds.maxLng - cluster.bounds.minLng) < 0.0001;

      if (mapZoom >= 15 || isSinglePoint) {
        onMarkerClick(cluster.matches[0]);
      } else {
        setMapCenter([cluster.latitude, cluster.longitude]);
        setMapZoom((z) => Math.min(z + 2, 15));
      }
    } else {
      onMarkerClick(cluster.matches[0]);
    }
  };

  const shouldRenderSearchCenter =
    searchLocation != null && searchLocation.name !== 'Mein Standort';

  const radiusPx =
    showRadiusCircle && searchLocation != null && radiusKm != null && radiusKm > 0
      ? Math.round(calculateRadiusInPixels(searchLocation.lat, mapZoom, radiusKm))
      : 0;

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      <Map
        center={mapCenter}
        zoom={mapZoom}
        width={dimensions.width}
        height={dimensions.height ?? 800}
        provider={osmSubdomainProvider}
        onBoundsChanged={({ center: newCenter, zoom: newZoom }) => {
          setMapCenter(newCenter);
          setMapZoom(newZoom);
        }}
      >
        <ZoomControl />

        {/* Radius circle overlay */}
        {radiusPx > 0 && searchLocation && (
          <Overlay
            anchor={[searchLocation.lat, searchLocation.lng]}
            offset={[radiusPx, radiusPx]}
          >
            <svg
              width={radiusPx * 2}
              height={radiusPx * 2}
              className="pointer-events-none"
              style={{ overflow: 'visible' }}
            >
              <circle
                cx={radiusPx}
                cy={radiusPx}
                r={radiusPx}
                fill="rgba(234, 88, 12, 0.08)"
                stroke="#ea580c"
                strokeWidth={1.5}
                strokeDasharray="6 4"
              />
            </svg>
          </Overlay>
        )}

        {/* User GPS location marker */}
        {userLocation && (
          <Overlay anchor={userLocation} offset={[12, 12]}>
            <UserLocationMarker />
          </Overlay>
        )}

        {/* Search center marker */}
        {shouldRenderSearchCenter && (
          <Overlay
            anchor={[searchLocation.lat, searchLocation.lng]}
            offset={[0, 0]}
          >
            <div className="-translate-x-1/2 -translate-y-full">
              <SearchCenterMarker cityName={searchLocation.name} />
            </div>
          </Overlay>
        )}

        {/* Venue markers and cluster badges */}
        {clusters.map((cluster) => {
          if (cluster.isCluster) {
            return (
              <Overlay
                key={cluster.id}
                anchor={[cluster.latitude, cluster.longitude]}
                offset={[23, 23]}
              >
                <button
                  type="button"
                  onClick={() => handleClusterClick(cluster)}
                  className="cursor-pointer focus:outline-none"
                  aria-label={`Cluster mit ${cluster.matchCount} Spielen`}
                >
                  <ClusterBadgeMarker
                    matchCount={cluster.matchCount}
                    isSelected={cluster.isSelected}
                  />
                </button>
              </Overlay>
            );
          }

          return (
            <Overlay
              key={cluster.id}
              anchor={[cluster.latitude, cluster.longitude]}
              offset={[17, 40]}
            >
              <div
                className="relative"
                style={{ zIndex: cluster.isSelected ? 30 : 10 }}
              >
                <button
                  type="button"
                  onClick={() => handleClusterClick(cluster)}
                  className="cursor-pointer focus:outline-none"
                  aria-label={`${cluster.venueGroups[0]?.venue.name ?? 'Halle'} (${cluster.matchCount} Spiele)`}
                >
                  <BasketballPinMarker
                    isSelected={cluster.isSelected}
                    matchCount={cluster.matchCount}
                  />
                </button>
              </div>
            </Overlay>
          );
        })}
      </Map>
    </div>
  );
}
