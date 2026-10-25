import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { Match } from '@sundayleague/shared-types';
import { formatKickoffTime } from './data';

export interface MatchPreviewSheetProps {
  match: Match;
  distanceKm?: number;
  onClose: () => void;
}

export const MatchPreviewSheet: React.FC<MatchPreviewSheetProps> = ({
  match,
  distanceKm,
  onClose,
}) => {
  const homeName = match.homeTeam?.name ?? 'Heim';
  const guestName = match.guestTeam?.name ?? 'Gast';
  const venueName = match.venue?.name ?? 'Unbekannte Spielstätte';

  const venueAddress = [match.venue?.street, match.venue?.city]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={styles.sheetContainer} testID="match-preview-sheet">
      <View style={styles.headerRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {formatKickoffTime(match.kickoffTime)}
          </Text>
        </View>
        {distanceKm !== undefined && (
          <Text style={styles.distanceText}>{distanceKm.toFixed(1)} km entfernt</Text>
        )}
        <Pressable
          style={styles.closeButton}
          onPress={onClose}
          accessibilityLabel="Schließen"
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.teamsContainer}>
        <Text style={styles.teamName} numberOfLines={1}>
          {homeName}
        </Text>
        <Text style={styles.versusText}>vs.</Text>
        <Text style={styles.teamName} numberOfLines={1}>
          {guestName}
        </Text>
      </View>

      <View style={styles.venueContainer}>
        <Text style={styles.venueLabel}>Spielort:</Text>
        <Text style={styles.venueName} numberOfLines={1}>
          {venueName}
        </Text>
        {venueAddress.length > 0 && (
          <Text style={styles.venueAddress} numberOfLines={1}>
            {venueAddress}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sheetContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  distanceText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '600',
  },
  teamsContainer: {
    marginBottom: 12,
  },
  teamName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  versusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginVertical: 2,
    textTransform: 'uppercase',
  },
  venueContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },
  venueLabel: {
    fontSize: 11,
    color: '#94a3b8',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  venueName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginTop: 2,
  },
  venueAddress: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
});
