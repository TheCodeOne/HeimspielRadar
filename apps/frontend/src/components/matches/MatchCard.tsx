import * as React from 'react';
import type { Match } from '@sundayleague/shared-types';
import { MatchTile, type MatchTileProps } from './MatchTile';

export interface MatchCardProps extends Omit<MatchTileProps, 'variant'> {
  match: Match;
  isSelected?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onReportKioskInfo?: (match: Match) => void;
  onOpenTopMatchInfo?: (match: Match) => void;
  className?: string;
}

export const MatchCard = React.forwardRef<HTMLDivElement, MatchCardProps>(
  (props, ref) => {
    return <MatchTile ref={ref} variant="card" {...props} />;
  },
);

MatchCard.displayName = 'MatchCard';
