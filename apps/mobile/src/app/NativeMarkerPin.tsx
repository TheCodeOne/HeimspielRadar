import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BasketballIcon } from './Icons';

export interface NativeMarkerPinProps {
  isSelected: boolean;
  kickoffTime?: string | null;
}

export const NativeMarkerPin: React.FC<NativeMarkerPinProps> = ({
  isSelected,
  kickoffTime,
}) => {
  const shortTime = kickoffTime && kickoffTime !== '00:00' ? kickoffTime : null;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.bubble,
          isSelected ? styles.bubbleSelected : styles.bubbleDefault,
        ]}
      >
        <BasketballIcon
          size={isSelected ? 18 : 15}
          color="#ffffff"
        />
        {shortTime && (
          <Text
            style={[
              styles.timeText,
              isSelected ? styles.timeTextSelected : styles.timeTextDefault,
            ]}
          >
            {shortTime}
          </Text>
        )}
      </View>
      <View
        style={[
          styles.arrow,
          isSelected ? styles.arrowSelected : styles.arrowDefault,
        ]}
      />
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    gap: 4,
  },
  bubbleDefault: {
    backgroundColor: '#0284c7', // Sky-600
    borderColor: '#ffffff',
    borderWidth: 1.5,
  },
  bubbleSelected: {
    backgroundColor: '#ea580c', // Orange-600
    borderColor: '#ffffff',
    borderWidth: 2,
    transform: [{ scale: 1.08 }],
  },
  timeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  timeTextDefault: {
    color: '#ffffff',
  },
  timeTextSelected: {
    color: '#ffffff',
  },
  arrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 0,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    alignSelf: 'center',
    marginTop: -0.5,
  },
  arrowDefault: {
    borderTopColor: '#0284c7',
  },
  arrowSelected: {
    borderTopColor: '#ea580c',
  },
});
