import * as React from 'react';
import type { Match } from '@sundayleague/shared-types';
import { Badge } from '@/components/ui/badge';
import { TopMatchInfoModal } from './TopMatchInfoModal';

export interface TopMatchBadgeProps {
  match: Match;
  className?: string;
  size?: 'sm' | 'default';
  onOpenTopMatchInfo?: (match: Match) => void;
}

export function TopMatchBadge({
  match,
  className = '',
  size = 'default',
  onOpenTopMatchInfo,
}: TopMatchBadgeProps) {
  const [isLocalModalOpen, setIsLocalModalOpen] = React.useState(false);

  if (!match.isFeatured) {
    return null;
  }

  const handleOpen = (e: React.SyntheticEvent) => {
    e.stopPropagation();

    if (onOpenTopMatchInfo) {
      onOpenTopMatchInfo(match);
    } else {
      setIsLocalModalOpen(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpen(e);
    }
  };

  const sizeClasses = size === 'sm' ? 'text-[10px]' : 'text-[11px]';

  return (
    <>
      <Badge
        variant="featured"
        data-testid="featured-match-badge"
        role="button"
        tabIndex={0}
        title="Topspiel-Details & Berechnungsgrundlage anzeigen"
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        className={`cursor-pointer hover:brightness-110 active:scale-95 transition-all select-none ${sizeClasses} ${className}`}
      >
        <span className="mr-1" aria-hidden="true">
          ⭐
        </span>
        Topspiel
      </Badge>

      {!onOpenTopMatchInfo && (
        <TopMatchInfoModal
          match={match}
          isOpen={isLocalModalOpen}
          onClose={() => setIsLocalModalOpen(false)}
        />
      )}
    </>
  );
}
