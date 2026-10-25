import React from 'react';
import { View, Pressable, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
        // Haptics might fail on unsupported devices/simulators
      });
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

  const renderButtonContent = (
    iconName: keyof typeof Ionicons.glyphMap,
    isLoading = false,
  ) => {
    if (isLoading) {
      return (
        <View className="w-11 h-11 items-center justify-center">
          <ActivityIndicator size="small" color="#0284c7" />
        </View>
      );
    }

    return (
      <View className="w-11 h-11 items-center justify-center">
        <Ionicons name={iconName} size={20} color="#0f172a" />
      </View>
    );
  };

  return (
    <View
      className="absolute right-4 top-28 z-20 flex-col gap-2.5"
      testID="floating-action-controls"
    >
      {/* Recenter Button */}
      <Pressable
        onPress={handleRecenter}
        accessibilityLabel="Auf aktuellen Standort zentrieren"
        accessibilityRole="button"
        className="active:scale-95 shadow-md"
      >
        {isWeb ? (
          <View className="bg-white/90 backdrop-blur-md rounded-full border border-white/70 overflow-hidden">
            {renderButtonContent('locate')}
          </View>
        ) : (
          <BlurView
            intensity={80}
            tint="light"
            className="rounded-full border border-white/70 overflow-hidden bg-white/70"
          >
            {renderButtonContent('locate')}
          </BlurView>
        )}
      </Pressable>

      {/* Refresh Button */}
      <Pressable
        onPress={handleRefresh}
        disabled={isRefreshing}
        accessibilityLabel="Spiele aktualisieren"
        accessibilityRole="button"
        className="active:scale-95 shadow-md"
      >
        {isWeb ? (
          <View className="bg-white/90 backdrop-blur-md rounded-full border border-white/70 overflow-hidden">
            {renderButtonContent('refresh', isRefreshing)}
          </View>
        ) : (
          <BlurView
            intensity={80}
            tint="light"
            className="rounded-full border border-white/70 overflow-hidden bg-white/70"
          >
            {renderButtonContent('refresh', isRefreshing)}
          </BlurView>
        )}
      </Pressable>
    </View>
  );
};
