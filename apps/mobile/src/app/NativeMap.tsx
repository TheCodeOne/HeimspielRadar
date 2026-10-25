import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Haptics from 'expo-haptics';
import type { Match } from '@sundayleague/shared-types';
import type { LocationCoordinates } from './data';
import { NativeMarkerPin } from './NativeMarkerPin';

export interface NativeMapProps {
  initialRegion: LocationCoordinates;
  radiusKm: number;
  matches: Match[];
  selectedMatch: Match | null;
  onSelectMatch: (match: Match) => void;
  mapRef?: React.RefObject<MapView | null>;
}

export const NativeMap: React.FC<NativeMapProps> = ({
  initialRegion,
  radiusKm,
  matches,
  selectedMatch,
  onSelectMatch,
  mapRef,
}) => {
  const handleMarkerPress = (match: Match) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onSelectMatch(match);
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: initialRegion.latitude,
          longitude: initialRegion.longitude,
          latitudeDelta: 0.25,
          longitudeDelta: 0.25,
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        <Circle
          center={{
            latitude: initialRegion.latitude,
            longitude: initialRegion.longitude,
          }}
          radius={radiusKm * 1000}
          strokeWidth={2}
          strokeColor="rgba(2, 132, 199, 0.6)"
          fillColor="rgba(2, 132, 199, 0.1)"
        />

        {matches.map((match) => {
          if (!match.venue?.latitude || !match.venue?.longitude) {
            return null;
          }

          const isSelected = selectedMatch?.id === match.id;

          return (
            <Marker
              key={match.id}
              coordinate={{
                latitude: match.venue.latitude,
                longitude: match.venue.longitude,
              }}
              title={`${match.homeTeam?.name ?? 'Heim'} vs. ${match.guestTeam?.name ?? 'Gast'}`}
              description={match.venue.name}
              onPress={() => handleMarkerPress(match)}
              tracksViewChanges={false}
              zIndex={isSelected ? 100 : 1}
            >
              <NativeMarkerPin
                isSelected={isSelected}
                kickoffTime={match.kickoffTime}
              />
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
});
