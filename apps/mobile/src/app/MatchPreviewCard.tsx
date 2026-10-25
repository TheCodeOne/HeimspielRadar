import React from 'react';
import {
  View,
  Text,
  Pressable,
  Platform,
  Linking,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import type { Match } from '@sundayleague/shared-types';
import { formatKickoffTime } from './data';
import { TimeIcon, NavigateIcon, NavigateOutlineIcon, CloseIcon } from './Icons';

export interface MatchPreviewCardProps {
  match: Match;
  distanceKm?: number;
  onClose: () => void;
}

export const MatchPreviewCard: React.FC<MatchPreviewCardProps> = ({
  match,
  distanceKm,
  onClose,
}) => {
  const isWeb = Platform.OS === 'web';
  const homeName = match.homeTeam?.name ?? 'Heim';
  const guestName = match.guestTeam?.name ?? 'Gast';
  const venueName = match.venue?.name ?? 'Unbekannte Spielstätte';

  const venueAddress = [match.venue?.street, match.venue?.postalCode, match.venue?.city]
    .filter(Boolean)
    .join(' ');

  const handleOpenNavigation = () => {
    if (!isWeb) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    const lat = match.venue?.latitude;
    const lng = match.venue?.longitude;
    const label = encodeURIComponent(venueName || 'Basketball Spiel');

    if (lat && lng) {
      if (Platform.OS === 'ios') {
        const appleMapsUrl = `maps://?q=${label}&ll=${lat},${lng}`;

        Linking.canOpenURL(appleMapsUrl).then((supported) => {
          if (supported) {
            Linking.openURL(appleMapsUrl);
          } else {
            Linking.openURL(`https://maps.apple.com/?q=${label}&ll=${lat},${lng}`);
          }
        });
      } else {
        const googleMapsUrl = `geo:${lat},${lng}?q=${lat},${lng}(${label})`;

        Linking.canOpenURL(googleMapsUrl).then((supported) => {
          if (supported) {
            Linking.openURL(googleMapsUrl);
          } else {
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
          }
        });
      }
    } else if (venueAddress) {
      const encodedAddress = encodeURIComponent(venueAddress);

      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`);
    }
  };

  const handleClose = () => {
    if (!isWeb) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    onClose();
  };

  const cardContent = (
    <View style={styles.cardPadding}>
      {/* Top Meta Bar */}
      <View style={styles.headerRow}>
        <View style={styles.metaChips}>
          {/* Kickoff Chip */}
          <View style={styles.kickoffChip}>
            <TimeIcon size={13} color="#0284c7" />
            <Text style={styles.kickoffText}>
              {formatKickoffTime(match.kickoffTime)}
            </Text>
          </View>

          {/* Distance Indicator */}
          {distanceKm !== undefined && (
            <View style={styles.distanceBadge}>
              <NavigateOutlineIcon size={12} color="#64748b" />
              <Text style={styles.distanceText}>
                {distanceKm.toFixed(1)} km
              </Text>
            </View>
          )}
        </View>

        {/* Close Button */}
        <Pressable
          onPress={handleClose}
          accessibilityLabel="Schließen"
          accessibilityRole="button"
          hitSlop={10}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <CloseIcon size={14} color="#64748b" />
        </Pressable>
      </View>

      {/* Team Matchup */}
      <View style={styles.matchupSection}>
        <Text style={styles.teamHome} numberOfLines={1}>
          {homeName}
        </Text>
        <Text style={styles.versusDivider}>VS.</Text>
        <Text style={styles.teamGuest} numberOfLines={1}>
          {guestName}
        </Text>
      </View>

      {/* Venue Section & Route Button */}
      <View style={styles.footerSection}>
        <View style={styles.venueInfo}>
          <Text style={styles.venueLabel}>Spielort</Text>
          <Text style={styles.venueName} numberOfLines={1}>
            {venueName}
          </Text>
          {venueAddress.length > 0 && (
            <Text style={styles.venueAddress} numberOfLines={1}>
              {venueAddress}
            </Text>
          )}
        </View>

        {/* Navigation Action Button */}
        <Pressable
          onPress={handleOpenNavigation}
          accessibilityLabel="Navigation starten"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.routeButton,
            pressed && styles.routeButtonPressed,
          ]}
        >
          <NavigateIcon size={13} color="#ffffff" />
          <Text style={styles.routeButtonText}>Route</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container} testID="match-preview-card">
      {isWeb ? (
        <View style={[styles.cardSurface, styles.webCardSurface]}>
          {cardContent}
        </View>
      ) : (
        <BlurView intensity={95} tint="light" style={styles.cardSurface}>
          {cardContent}
        </BlurView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    zIndex: 30,
    elevation: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
  },
  cardSurface: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.90)',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    overflow: 'hidden',
  },
  webCardSurface: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
  },
  cardPadding: {
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metaChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kickoffChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.28)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  kickoffText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(226, 232, 240, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  matchupSection: {
    marginBottom: 14,
  },
  teamHome: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  versusDivider: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1.2,
    marginVertical: 2,
  },
  teamGuest: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  footerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.8)',
  },
  venueInfo: {
    flex: 1,
    marginRight: 10,
  },
  venueLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  venueName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginTop: 2,
  },
  venueAddress: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  routeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284c7', // Sky-600
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  routeButtonPressed: {
    backgroundColor: '#0369a1', // Sky-700
    transform: [{ scale: 0.96 }],
  },
  routeButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});

// Backwards-compatible export
export const MatchPreviewSheet = MatchPreviewCard;
