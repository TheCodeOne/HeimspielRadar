import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import type { Match } from '@sundayleague/shared-types';
import type { LocationCoordinates } from './data';

export interface NativeMapProps {
  initialRegion: LocationCoordinates;
  radiusKm: number;
  matches: Match[];
  selectedMatch: Match | null;
  onSelectMatch: (match: Match) => void;
}

export const NativeMap: React.FC<NativeMapProps> = ({
  initialRegion,
  radiusKm,
  matches,
  selectedMatch,
  onSelectMatch,
}) => {
  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: initialRegion.latitude,
          longitude: initialRegion.longitude,
          latitudeDelta: 0.25,
          longitudeDelta: 0.25,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
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
              pinColor={isSelected ? '#f97316' : '#0284c7'}
              onPress={() => onSelectMatch(match)}
            />
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
