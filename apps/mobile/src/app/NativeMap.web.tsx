import React from 'react';
import { View, StyleSheet, Text, Pressable, ScrollView } from 'react-native';
import type { Match } from '@sundayleague/shared-types';
import type { LocationCoordinates } from './data';
import { calculateDistanceKm, formatKickoffTime } from './data';

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
    <View style={styles.webMapContainer}>
      <View style={styles.webNoticeHeader}>
        <Text style={styles.webNoticeTitle}>
          Web Map Preview ({matches.length} Matches im Umkreis von {radiusKm} km)
        </Text>
        <Text style={styles.webNoticeSubtitle}>
          Zentrum: {initialRegion.latitude.toFixed(4)}, {initialRegion.longitude.toFixed(4)}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.listContainer}>
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
                  <Text style={styles.pinIconText}>📍</Text>
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
  webNoticeHeader: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  webNoticeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  webNoticeSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
    gap: 12,
  },
  matchPinCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  matchPinCardSelected: {
    borderColor: '#f97316',
    borderWidth: 2,
    backgroundColor: '#fff7ed',
  },
  pinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  pinIconText: {
    fontSize: 18,
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
    fontWeight: '600',
    color: '#0284c7',
  },
  distText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
});
