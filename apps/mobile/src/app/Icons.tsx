import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';


export interface IconProps {
  size?: number;
  color?: string;
}

export const BasketballIcon: React.FC<IconProps> = ({ size = 16, color = '#ffffff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
    <Path d="M2.5 12h19" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M12 2.5v19" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M4.93 4.93c4 4 4 10.14 0 14.14" stroke={color} strokeWidth="2" />
    <Path d="M19.07 4.93c-4 4-4 10.14 0 14.14" stroke={color} strokeWidth="2" />
  </Svg>
);

export const LocateIcon: React.FC<IconProps> = ({ size = 20, color = '#0f172a' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="7" stroke={color} strokeWidth="2" />
    <Circle cx="12" cy="12" r="2.5" fill={color} />
    <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

export const RefreshIcon: React.FC<IconProps> = ({ size = 20, color = '#0f172a' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M21 12a9 9 0 1 1-2.64-6.36L21 8m0 0v-6m0 6h-6"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const TimeIcon: React.FC<IconProps> = ({ size = 12, color = '#0284c7' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
    <Path d="M12 7v5l3 2" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

export const NavigateIcon: React.FC<IconProps> = ({ size = 14, color = '#ffffff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 11l19-9-9 19-2-8-8-2z"
      fill={color}
      stroke={color}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </Svg>
);

export const NavigateOutlineIcon: React.FC<IconProps> = ({ size = 12, color = '#64748b' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 11l19-9-9 19-2-8-8-2z"
      stroke={color}
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </Svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 16, color = '#475569' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
  </Svg>
);

export const MapOutlineIcon: React.FC<IconProps> = ({ size = 24, color = '#0284c7' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path d="M9 3v15M15 6v15" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

export const ChevronUpIcon: React.FC<IconProps> = ({ size = 20, color = '#64748b' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 15l-6-6-6 6" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const ChevronDownIcon: React.FC<IconProps> = ({ size = 20, color = '#64748b' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const TrophyIcon: React.FC<IconProps> = ({ size = 16, color = '#d97706' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M4 22h16M10 14.66V17c0 .55-.45 1-1 1H8v4h8v-4h-1c-.55 0-1-.45-1-1v-2.34" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M18 2H6v7a6 6 0 0 0 12 0V2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const SnackIcon: React.FC<IconProps> = ({ size = 14, color = '#ea580c' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

