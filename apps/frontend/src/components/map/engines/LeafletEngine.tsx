import * as React from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import type { MapEngineProps } from '../map-engine.types';
import { groupMatchesByVenue, type VenueGroup } from '../map-utils';
import { VenuePopup } from '../VenuePopup';

function createLeafletDivIcon(group: VenueGroup, isSelected: boolean): L.DivIcon {
  const badgeHtml =
    group.matches.length > 1
      ? `<span style="position:absolute;top:-4px;right:-4px;background:#0f172a;color:#ffffff;font-size:10px;font-weight:700;width:18px;height:18px;border-radius:9999px;display:flex;align-items:center;justify-content:center;border:2px solid #ffffff;">${group.matches.length}</span>`
      : '';

  const pinColor = isSelected ? '#2563eb' : '#0f172a';
  const scale = isSelected ? 'scale(1.2)' : 'scale(1)';

  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div style="transform:${scale};transition:transform 0.2s;position:relative;display:flex;align-items:center;justify-content:center;width:34px;height:40px;">
        <svg width="34" height="40" viewBox="0 0 36 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 0C8.05888 0 0 8.05888 0 18C0 28.5 18 42 18 42C18 42 36 28.5 36 18C36 8.05888 27.9411 0 18 0Z" fill="${pinColor}"/>
          <circle cx="18" cy="18" r="10" fill="#ffffff"/>
          <circle cx="18" cy="18" r="8" fill="${pinColor}"/>
          <path d="M18 10V26M10 18H26" stroke="#ffffff" stroke-width="1.2"/>
        </svg>
        ${badgeHtml}
      </div>
    `,
    iconSize: [34, 40],
    iconAnchor: [17, 40],
    popupAnchor: [0, -36],
  });
}

function LeafletMapController({
  selectedGroup,
}: {
  selectedGroup?: VenueGroup;
}) {
  const map = useMap();

  React.useEffect(() => {
    if (
      !selectedGroup ||
      selectedGroup.venue.latitude == null ||
      selectedGroup.venue.longitude == null
    ) {
      return;
    }

    map.flyTo(
      [selectedGroup.venue.latitude, selectedGroup.venue.longitude],
      Math.max(map.getZoom(), 11),
      {
        duration: 0.6,
      },
    );
  }, [map, selectedGroup]);

  return null;
}

export function LeafletEngine({
  matches,
  selectedMatchId,
  center,
  zoom,
  onMarkerClick,
  className = 'w-full h-full min-h-[400px]',
}: MapEngineProps) {
  const groups = groupMatchesByVenue(matches, selectedMatchId);
  const selectedGroup = groups.find((g) => g.isSelected);

  return (
    <div className={className}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        className="h-full w-full min-h-[400px] rounded-lg"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <LeafletMapController selectedGroup={selectedGroup} />

        {groups.map((group) => {
          if (group.venue.latitude == null || group.venue.longitude == null) {
            return null;
          }

          const icon = createLeafletDivIcon(group, group.isSelected);

          return (
            <Marker
              key={group.venueId}
              position={[group.venue.latitude, group.venue.longitude]}
              icon={icon}
              eventHandlers={{
                click: () => onMarkerClick(group.matches[0]),
              }}
            >
              <Popup className="custom-leaflet-popup">
                <VenuePopup group={group} onMarkerClick={onMarkerClick} />
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
