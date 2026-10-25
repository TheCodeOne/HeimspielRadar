import React from 'react';
import { View, StyleSheet, Text, Pressable, ScrollView } from 'react-native';
import type { Match } from '@sundayleague/shared-types';
import type { LocationCoordinates } from './data';
import { calculateDistanceKm, formatKickoffTime } from './data';
import { BasketballIcon, MapOutlineIcon } from './Icons';


export interface NativeMapProps {
  initialRegion: LocationCoordinates;
  radiusKm: number;
  matches: Match[];
  selectedMatch: Match | null;
  onSelectMatch: (match: Match) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapRef?: any;
}

export const NativeMap: React.FC<NativeMapProps> = ({
  initialRegion,
  radiusKm,
  matches,
  selectedMatch,
  onSelectMatch,
}) => {
  return (
    <View style={styles.webMapContainer}>
      <ScrollView contentContainerStyle={styles.listContainer}>
        <View style={styles.webMapBanner}>
          <MapOutlineIcon size={24} color="#0284c7" />
          <Text style={styles.webMapBannerTitle}>Interaktive Spielübersicht (Web-Modus)</Text>
          <Text style={styles.webMapBannerSubtitle}>
            {matches.length} {matches.length === 1 ? 'Spiel' : 'Spiele'} im {radiusKm} km Umkreis
          </Text>
        </View>


        {matches.map((match) => {
          const isSelected = selectedMatch?.id === match.id;

          const dist =
            match.venue?.latitude && match.venue?.longitude
              ? calculateDistanceKm(
                  initialRegion.latitude,
                  initialRegion.longitude,
                  match.venue.latitude,
                  match.venue.longitude,
                )
              : undefined;

          return (
            <Pressable
              key={match.id}
              style={[
                styles.matchPinCard,
                isSelected && styles.matchPinCardSelected,
              ]}
              onPress={() => onSelectMatch(match)}
            >
              <View style={styles.pinHeader}>
                <View
                  style={[
                    styles.pinIcon,
                    isSelected ? styles.pinIconSelected : styles.pinIconDefault,
                  ]}
                >
                  <BasketballIcon
                    size={20}
                    color={isSelected ? '#ea580c' : '#0284c7'}
                  />
                </View>

                <View style={styles.pinTitleBox}>
                  <Text style={styles.matchTeams}>
                    {match.homeTeam?.name ?? 'Heim'} vs. {match.guestTeam?.name ?? 'Gast'}
                  </Text>
                  <Text style={styles.venueText}>
                    {match.venue?.name ?? 'Spielort unbekannt'}
                  </Text>
                </View>
                <View style={styles.pinMetaBox}>
                  <Text style={styles.timeText}>
                    {formatKickoffTime(match.kickoffTime)}
                  </Text>
                  {dist !== undefined && (
                    <Text style={styles.distText}>{dist.toFixed(1)} km</Text>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  webMapContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  listContainer: {
    padding: 16,
    paddingTop: 130, // Space for floating header pill and filter chips
    gap: 12,
  },
  webMapBanner: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#f0f9ff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginBottom: 4,
  },
  webMapBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0369a1',
    marginTop: 6,
  },
  webMapBannerSubtitle: {
    fontSize: 12,
    color: '#0284c7',
    marginTop: 2,
  },
  matchPinCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  matchPinCardSelected: {
    borderColor: '#ea580c',
    borderWidth: 2,
    backgroundColor: '#fff7ed',
  },
  pinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pinIconDefault: {
    backgroundColor: '#e0f2fe',
  },
  pinIconSelected: {
    backgroundColor: '#ffedd5',
  },
  pinTitleBox: {
    flex: 1,
  },
  matchTeams: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  venueText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  pinMetaBox: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  distText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
});
