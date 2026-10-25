import React from 'react';
import { View, Text, Platform, ActivityIndicator, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

export interface FloatingHeaderPillProps {
  matchCount: number;
  radiusKm: number;
  isLoading?: boolean;
  permissionDenied?: boolean;
  isOffline?: boolean;
}

export const FloatingHeaderPill: React.FC<FloatingHeaderPillProps> = ({
  matchCount,
  radiusKm,
  isLoading = false,
  permissionDenied = false,
  isOffline = false,
}) => {
  const isWeb = Platform.OS === 'web';

  const subtitle = isOffline
    ? 'Offline-Modus (Gespeicherte Spiele)'
    : permissionDenied
      ? 'Stuttgart (Fallback)'
      : `${radiusKm} km Umkreis`;

  const content = (
    <View style={styles.contentRow}>
      <View style={styles.brandingGroup}>
        <View
          style={[
            styles.statusDot,
            isOffline ? styles.statusDotOffline : styles.statusDotOnline,
          ]}
          testID="header-status-dot"
        />
        <View>
          <Text style={styles.brandTitle}>HeimspielRadar</Text>
          <Text
            style={[
              styles.brandSubtitle,
              isOffline && styles.brandSubtitleOffline,
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>
      </View>

      <View style={styles.counterGroup}>
        {isLoading ? (
          <ActivityIndicator size="small" color="#0284c7" />
        ) : (
          <View
            style={[
              styles.counterBadge,
              isOffline && styles.counterBadgeOffline,
            ]}
          >
            <Text
              style={[
                styles.counterText,
                isOffline && styles.counterTextOffline,
              ]}
            >
              {matchCount} {matchCount === 1 ? 'Spiel' : 'Spiele'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container} testID="floating-header-pill">
      {isWeb ? (
        <View style={[styles.pillCard, styles.webPillCard]}>
          {content}
        </View>
      ) : (
        <BlurView intensity={85} tint="light" style={styles.pillCard}>
          {content}
        </BlurView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 20,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  pillCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    overflow: 'hidden',
  },
  webPillCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 52,
  },
  brandingGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
    marginRight: 8,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  statusDotOnline: {
    backgroundColor: '#10b981', // emerald-500
  },
  statusDotOffline: {
    backgroundColor: '#f59e0b', // amber-500
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 1,
  },
  brandSubtitleOffline: {
    color: '#d97706', // amber-600
    fontWeight: '600',
  },
  counterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  counterBadge: {
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  counterBadgeOffline: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  counterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7', // sky-600
  },
  counterTextOffline: {
    color: '#d97706', // amber-600
  },
});
