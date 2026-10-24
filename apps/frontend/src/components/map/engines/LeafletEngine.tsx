import * as React from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Circle, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import type { Match } from '@sundayleague/shared-types';
import type { MapEngineProps } from '../map-engine.types';
import {
  clusterVenueGroups,
  getBasketballPinHtml,
  getClusterBadgeHtml,
  getSearchCenterPinHtml,
  getUserLocationPinHtml,
  groupMatchesByVenue,
  type VenueCluster,
  type VenueGroup,
} from '../map-utils';

function createLeafletVenueDivIcon(isSelected: boolean, matchCount: number): L.DivIcon {
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: getBasketballPinHtml(isSelected, matchCount),
    iconSize: [34, 40],
    iconAnchor: [17, 40],
    popupAnchor: [0, -36],
  });
}

function createLeafletClusterDivIcon(cluster: VenueCluster): L.DivIcon {
  return L.divIcon({
    className: 'custom-cluster-marker',
    html: getClusterBadgeHtml(cluster.matchCount, cluster.isSelected),
    iconSize: [46, 46],
    iconAnchor: [23, 23],
    popupAnchor: [0, -24],
  });
}

function createLeafletSearchCenterDivIcon(cityName: string): L.DivIcon {
  return L.divIcon({
    className: 'custom-search-center-marker',
    html: getSearchCenterPinHtml(cityName),
    iconSize: [140, 64],
    iconAnchor: [70, 60],
  });
}

function createUserLocationDivIcon(): L.DivIcon {
  return L.divIcon({
    className: 'custom-user-location-marker',
    html: getUserLocationPinHtml(),
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

function LeafletZoomWatcher({
  onZoomChange,
}: {
  onZoomChange: (zoom: number) => void;
}) {
  const map = useMap();

  React.useEffect(() => {
    const handleZoom = () => {
      onZoomChange(Math.round(map.getZoom()));
    };

    map.on('zoomend', handleZoom);

    return () => {
      map.off('zoomend', handleZoom);
    };
  }, [map, onZoomChange]);

  return null;
}

function LeafletClusterMarker({
  cluster,
  currentZoom,
  onMarkerClick,
}: {
  cluster: VenueCluster;
  currentZoom: number;
  onMarkerClick: (match: Match) => void;
}) {
  const map = useMap();

  const handleClick = () => {
    if (cluster.isCluster) {
      const isSinglePoint =
        Math.abs(cluster.bounds.maxLat - cluster.bounds.minLat) < 0.0001 &&
        Math.abs(cluster.bounds.maxLng - cluster.bounds.minLng) < 0.0001;

      if (currentZoom >= 15 || isSinglePoint) {
        onMarkerClick(cluster.matches[0]);
      } else {
        map.flyToBounds(
          [
            [cluster.bounds.minLat, cluster.bounds.minLng],
            [cluster.bounds.maxLat, cluster.bounds.maxLng],
          ],
          {
            padding: [50, 50],
            maxZoom: 15,
            duration: 0.5,
          },
        );
      }
    } else {
      onMarkerClick(cluster.matches[0]);
    }
  };

  const icon = cluster.isCluster
    ? createLeafletClusterDivIcon(cluster)
    : createLeafletVenueDivIcon(cluster.isSelected, cluster.matchCount);

  return (
    <Marker
      position={[cluster.latitude, cluster.longitude]}
      icon={icon}
      zIndexOffset={cluster.isSelected ? 1000 : cluster.isCluster ? 500 : 0}
      eventHandlers={{
        click: handleClick,
      }}
    />
  );
}

function LeafletMapController({
  center,
  selectedGroup,
}: {
  center: [number, number];
  selectedGroup?: VenueGroup;
}) {
  const map = useMap();

  React.useEffect(() => {
    if (
      selectedGroup &&
      selectedGroup.venue.latitude != null &&
      selectedGroup.venue.longitude != null
    ) {
      map.flyTo(
        [selectedGroup.venue.latitude, selectedGroup.venue.longitude],
        Math.max(map.getZoom(), 12),
        {
          duration: 0.6,
        },
      );

      return;
    }

    map.flyTo(center, map.getZoom(), {
      duration: 0.6,
    });
  }, [map, center[0], center[1], selectedGroup]);

  return null;
}

export function LeafletEngine({
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
  const [currentZoom, setCurrentZoom] = React.useState<number>(zoom);

  const groups = React.useMemo(
    () => venueGroups ?? groupMatchesByVenue(matches, selectedMatchId),
    [venueGroups, matches, selectedMatchId],
  );

  const clusters = React.useMemo(
    () => clusterVenueGroups(groups, currentZoom),
    [groups, currentZoom],
  );

  const selectedGroup = groups.find((g) => g.isSelected);

  const shouldRenderSearchCenter =
    searchLocation != null && searchLocation.name !== 'Mein Standort';

  const shouldRenderRadiusCircle =
    showRadiusCircle && searchLocation != null && radiusKm != null && radiusKm > 0;

  return (
    <div className={className}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <LeafletZoomWatcher onZoomChange={setCurrentZoom} />
        <LeafletMapController center={center} selectedGroup={selectedGroup} />

        {/* User GPS location marker */}
        {userLocation && (
          <Marker position={userLocation} icon={createUserLocationDivIcon()} zIndexOffset={300} />
        )}

        {/* Search center marker */}
        {shouldRenderSearchCenter && (
          <Marker
            position={[searchLocation.lat, searchLocation.lng]}
            icon={createLeafletSearchCenterDivIcon(searchLocation.name)}
            zIndexOffset={400}
          />
        )}

        {/* Radius circle */}
        {shouldRenderRadiusCircle && (
          <Circle
            center={[searchLocation.lat, searchLocation.lng]}
            radius={radiusKm * 1000}
            pathOptions={{
              color: '#ea580c',
              fillColor: '#ea580c',
              fillOpacity: 0.08,
              weight: 1.5,
              dashArray: '6 4',
            }}
          />
        )}

        {/* Venue markers and cluster badges */}
        {clusters.map((cluster) => (
          <LeafletClusterMarker
            key={cluster.id}
            cluster={cluster}
            currentZoom={currentZoom}
            onMarkerClick={onMarkerClick}
          />
        ))}
      </MapContainer>
    </div>
  );
}
