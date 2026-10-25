import React from 'react';
import { View, Text, Pressable, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import type { Match } from '@sundayleague/shared-types';
import { formatKickoffTime } from './data';

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
    <View className="p-4">
      {/* Top Meta Bar */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          {/* Kickoff Chip */}
          <View className="bg-sky-500/15 border border-sky-500/30 px-2.5 py-1 rounded-full flex-row items-center gap-1.5">
            <Ionicons name="time-outline" size={12} color="#0284c7" />
            <Text className="text-xs font-bold text-sky-700">
              {formatKickoffTime(match.kickoffTime)}
            </Text>
          </View>

          {/* Distance Indicator */}
          {distanceKm !== undefined && (
            <View className="flex-row items-center gap-1">
              <Ionicons name="navigate-outline" size={12} color="#64748b" />
              <Text className="text-xs font-semibold text-slate-500">
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
          className="w-7 h-7 rounded-full bg-slate-200/60 items-center justify-center active:bg-slate-300"
        >
          <Ionicons name="close" size={16} color="#475569" />
        </Pressable>
      </View>

      {/* Team Matchup */}
      <View className="mb-3.5">
        <View className="flex-row items-center justify-between">
          <Text
            className="text-base font-bold text-slate-900 flex-1"
            numberOfLines={1}
          >
            {homeName}
          </Text>
        </View>
        <Text className="text-[11px] font-bold text-slate-400 uppercase tracking-widest my-0.5">
          vs.
        </Text>
        <View className="flex-row items-center justify-between">
          <Text
            className="text-base font-bold text-slate-900 flex-1"
            numberOfLines={1}
          >
            {guestName}
          </Text>
        </View>
      </View>

      {/* Venue Section */}
      <View className="pt-2.5 border-t border-slate-200/60 flex-row items-center justify-between">
        <View className="flex-1 mr-2">
          <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Spielort
          </Text>
          <Text
            className="text-xs font-semibold text-slate-700 mt-0.5"
            numberOfLines={1}
          >
            {venueName}
          </Text>
          {venueAddress.length > 0 && (
            <Text
              className="text-[11px] text-slate-500"
              numberOfLines={1}
            >
              {venueAddress}
            </Text>
          )}
        </View>

        {/* Navigation Action Button */}
        <Pressable
          onPress={handleOpenNavigation}
          accessibilityLabel="Navigation starten"
          accessibilityRole="button"
          className="bg-sky-600 active:bg-sky-700 px-3 py-2 rounded-xl flex-row items-center gap-1.5 shadow-sm"
        >
          <Ionicons name="navigate" size={14} color="#ffffff" />
          <Text className="text-xs font-bold text-white">Route</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View
      className="absolute bottom-6 left-4 right-4 z-20 shadow-xl"
      testID="match-preview-card"
    >
      {isWeb ? (
        <View className="bg-white/95 backdrop-blur-md rounded-2xl border border-white/70 overflow-hidden shadow-md">
          {cardContent}
        </View>
      ) : (
        <BlurView
          intensity={90}
          tint="light"
          className="rounded-2xl border border-white/80 overflow-hidden bg-white/75"
        >
          {cardContent}
        </BlurView>
      )}
    </View>
  );
};

// Backwards-compatible export
export const MatchPreviewSheet = MatchPreviewCard;
