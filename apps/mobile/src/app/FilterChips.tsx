import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  RadiusOption,
  RADIUS_OPTIONS,
  DateFilterOption,
} from './data';

export interface FilterChipsProps {
  selectedRadius: RadiusOption;
  onSelectRadius: (radius: RadiusOption) => void;
  selectedDate: DateFilterOption;
  onSelectDate: (date: DateFilterOption) => void;
}

interface DateChipItem {
  id: DateFilterOption;
  label: string;
}

const DATE_OPTIONS: DateChipItem[] = [
  { id: 'all', label: 'Alle' },
  { id: 'today', label: 'Heute' },
  { id: 'tomorrow', label: 'Morgen' },
  { id: 'weekend', label: 'Wochenende' },
];

export const FilterChips: React.FC<FilterChipsProps> = ({
  selectedRadius,
  onSelectRadius,
  selectedDate,
  onSelectDate,
}) => {
  const handleRadiusPress = (radius: RadiusOption) => {
    if (radius !== selectedRadius) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onSelectRadius(radius);
    }
  };

  const handleDatePress = (date: DateFilterOption) => {
    if (date !== selectedDate) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onSelectDate(date);
    }
  };

  return (
    <View style={styles.container} testID="floating-filter-bar">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Radius Group */}
        <View style={styles.chipGroup} testID="radius-filter-group">
          {RADIUS_OPTIONS.map((radius) => {
            const isActive = selectedRadius === radius;

            return (
              <Pressable
                key={`radius-${radius}`}
                testID={`radius-chip-${radius}`}
                onPress={() => handleRadiusPress(radius)}
                style={({ pressed }) => [
                  styles.chip,
                  isActive ? styles.chipActive : styles.chipInactive,
                  pressed && styles.chipPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${radius} Kilometer Umkreis`}
              >
                <Text
                  style={[
                    styles.chipText,
                    isActive ? styles.chipTextActive : styles.chipTextInactive,
                  ]}
                >
                  {radius} km
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Vertical Divider */}
        <View style={styles.divider} />

        {/* Date Group */}
        <View style={styles.chipGroup} testID="date-filter-group">
          {DATE_OPTIONS.map((opt) => {
            const isActive = selectedDate === opt.id;

            return (
              <Pressable
                key={`date-${opt.id}`}
                testID={`date-chip-${opt.id}`}
                onPress={() => handleDatePress(opt.id)}
                style={({ pressed }) => [
                  styles.chip,
                  isActive ? styles.chipActive : styles.chipInactive,
                  pressed && styles.chipPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`Datum: ${opt.label}`}
              >
                <Text
                  style={[
                    styles.chipText,
                    isActive ? styles.chipTextActive : styles.chipTextInactive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 76,
    left: 0,
    right: 0,
    zIndex: 19,
    paddingVertical: 4,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  chipGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 4,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
        cursor: 'pointer',
        userSelect: 'none',
      },
    }),
  },
  chipInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderColor: '#e2e8f0',
  },
  chipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  chipPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  chipTextInactive: {
    color: '#334155',
  },
  chipTextActive: {
    color: '#ffffff',
  },
});
