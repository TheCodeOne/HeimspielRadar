import React from 'react';
import { View, Text, Platform, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';

export interface FloatingHeaderPillProps {
  matchCount: number;
  radiusKm: number;
  isLoading?: boolean;
  permissionDenied?: boolean;
}

export const FloatingHeaderPill: React.FC<FloatingHeaderPillProps> = ({
  matchCount,
  radiusKm,
  isLoading = false,
  permissionDenied = false,
}) => {
  const isWeb = Platform.OS === 'web';

  const content = (
    <View
      className="flex-row items-center justify-between px-4 py-2.5"
      style={{ minHeight: 46 }}
    >
      <View className="flex-row items-center gap-2">
        <View className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
        <View>
          <Text className="text-sm font-bold text-slate-900 tracking-tight">
            HeimspielRadar
          </Text>
          <Text className="text-[11px] font-medium text-slate-500">
            {permissionDenied
              ? 'Stuttgart (Fallback)'
              : `${radiusKm} km Umkreis`}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2">
        {isLoading ? (
          <ActivityIndicator size="small" color="#0284c7" />
        ) : (
          <View className="bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-full">
            <Text className="text-xs font-semibold text-sky-700">
              {matchCount} {matchCount === 1 ? 'Spiel' : 'Spiele'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View
      className="absolute top-12 left-4 right-4 z-20 shadow-lg"
      testID="floating-header-pill"
    >
      {isWeb ? (
        <View className="bg-white/90 backdrop-blur-md rounded-2xl border border-white/60 overflow-hidden shadow-sm">
          {content}
        </View>
      ) : (
        <BlurView
          intensity={80}
          tint="light"
          className="rounded-2xl border border-white/60 overflow-hidden bg-white/70"
        >
          {content}
        </BlurView>
      )}
    </View>
  );
};
