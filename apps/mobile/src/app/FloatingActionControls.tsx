import React from 'react';
import { View, Pressable, Platform, ActivityIndicator, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LocateIcon, RefreshIcon } from './Icons';

export interface FloatingActionControlsProps {
  onRecenter: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const FloatingActionControls: React.FC<FloatingActionControlsProps> = ({
  onRecenter,
  onRefresh,
  isRefreshing = false,
}) => {
  const isWeb = Platform.OS === 'web';

  const triggerHaptic = () => {
    if (!isWeb) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handleRecenter = () => {
    triggerHaptic();
    onRecenter();
  };

  const handleRefresh = () => {
    triggerHaptic();
    onRefresh();
  };

  return (
    <View style={styles.container} testID="floating-action-controls">
      {/* Recenter Button */}
      <Pressable
        onPress={handleRecenter}
        accessibilityLabel="Auf aktuellen Standort zentrieren"
        accessibilityRole="button"
        style={({ pressed }) => [styles.buttonWrapper, pressed && styles.pressed]}
      >
        {isWeb ? (
          <View style={[styles.buttonCard, styles.webButtonCard]}>
            <LocateIcon size={20} color="#0f172a" />
          </View>
        ) : (
          <BlurView intensity={85} tint="light" style={styles.buttonCard}>
            <LocateIcon size={20} color="#0f172a" />
          </BlurView>
        )}
      </Pressable>

      {/* Refresh Button */}
      <Pressable
        onPress={handleRefresh}
        disabled={isRefreshing}
        accessibilityLabel="Spiele aktualisieren"
        accessibilityRole="button"
        style={({ pressed }) => [styles.buttonWrapper, pressed && styles.pressed]}
      >
        {isWeb ? (
          <View style={[styles.buttonCard, styles.webButtonCard]}>
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#0284c7" />
            ) : (
              <RefreshIcon size={20} color="#0f172a" />
            )}
          </View>
        ) : (
          <BlurView intensity={85} tint="light" style={styles.buttonCard}>
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#0284c7" />
            ) : (
              <RefreshIcon size={20} color="#0f172a" />
            )}
          </BlurView>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    top: 84,
    zIndex: 20,
    flexDirection: 'column',
    gap: 12,
  },
  buttonWrapper: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 6,
    borderRadius: 24,
  },
  pressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },
  buttonCard: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    overflow: 'hidden',
  },
  webButtonCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
  },
});
