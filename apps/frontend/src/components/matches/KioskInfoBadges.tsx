import * as React from 'react';
import type { Match } from '@sundayleague/shared-types';
import { Badge } from '@/components/ui/badge';

export interface KioskInfoBadgesProps {
  match: Match;
  className?: string;
  size?: 'sm' | 'default';
}

export function isFreeAdmission(fee: string): boolean {
  const normalized = fee.trim().toLowerCase();

  return (
    normalized.includes('frei') ||
    normalized.includes('kostenlos') ||
    normalized.includes('gratis') ||
    normalized === '0' ||
    normalized === '0 €' ||
    normalized === '0€' ||
    normalized === '0,00 €' ||
    normalized === '0.00 €'
  );
}

export function formatAdmissionBadgeText(fee: string): string {
  const trimmed = fee.trim();
  const lower = trimmed.toLowerCase();

  if (lower.startsWith('eintritt')) {
    return `🎟️ ${trimmed}`;
  }

  if (
    lower === 'frei' ||
    lower === 'kostenlos' ||
    lower === 'gratis' ||
    lower === '0' ||
    lower === '0 €' ||
    lower === '0€'
  ) {
    return '🎟️ Eintritt frei';
  }

  return `🎟️ Eintritt: ${trimmed}`;
}

export const KioskInfoBadges: React.FC<KioskInfoBadgesProps> = ({
  match,
  className = '',
  size = 'default',
}) => {
  const [hoveredTooltip, setHoveredTooltip] = React.useState<'kiosk' | 'parking' | null>(
    null,
  );

  const [pinnedTooltip, setPinnedTooltip] = React.useState<'kiosk' | 'parking' | null>(
    null,
  );

  const activeTooltip = pinnedTooltip ?? hoveredTooltip;

  const admissionFee = match.admissionFee?.trim() || null;
  const kioskDescription = match.venue?.kioskDescription?.trim() || null;
  const parkingNotes = match.venue?.parkingNotes?.trim() || null;
  const matchNotes = match.matchNotes?.trim() || null;

  if (!admissionFee && !kioskDescription && !parkingNotes && !matchNotes) {
    return null;
  }

  const textSizeClass = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-[11px] px-2.5 py-0.5';

  const handleToggleTooltip = (
    e: React.MouseEvent,
    type: 'kiosk' | 'parking',
  ) => {
    e.stopPropagation();
    setPinnedTooltip((prev) => (prev === type ? null : type));
  };

  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className={`flex flex-col gap-1.5 ${className}`}
      onClick={stopPropagation}
      data-testid="kiosk-info-badges"
    >
      {/* 1. Direct Information Tiles (Kiosk, Parking, Match Notes) */}
      {(kioskDescription || parkingNotes || matchNotes) && (
        <div className="flex flex-col gap-1.5" data-testid="kiosk-info-tiles">
          {kioskDescription && (
            <div
              data-tile="kiosk-info"
              className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200"
            >
              <span className="shrink-0 text-sm leading-none" aria-hidden="true">
                🌭
              </span>
              <div className="min-w-0 flex-1 leading-snug">
                <span className="font-semibold text-amber-300">Kiosk: </span>
                <span className="text-amber-100">{kioskDescription}</span>
              </div>
            </div>
          )}

          {parkingNotes && (
            <div
              data-tile="parking-notes"
              className="flex items-start gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-xs text-sky-200"
            >
              <span className="shrink-0 text-sm leading-none" aria-hidden="true">
                🅿️
              </span>
              <div className="min-w-0 flex-1 leading-snug">
                <span className="font-semibold text-sky-300">Parkhinweis: </span>
                <span className="text-sky-100">{parkingNotes}</span>
              </div>
            </div>
          )}

          {matchNotes && (
            <div
              data-tile="match-notes"
              className="flex items-start gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1.5 text-xs text-indigo-200"
            >
              <span className="shrink-0 text-sm leading-none" aria-hidden="true">
                📝
              </span>
              <div className="min-w-0 flex-1 leading-snug">
                <span className="font-semibold text-indigo-300">Info: </span>
                <span className="text-indigo-100">{matchNotes}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Compact summary badge line (Admission, plus quick toggle badges for parity / a11y) */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Admission Fee Badge */}
        {admissionFee && (
          <Badge
            variant={isFreeAdmission(admissionFee) ? 'success' : 'outline'}
            data-badge="admission-fee"
            title={`Eintritt: ${admissionFee}`}
            className={`${textSizeClass} ${
              isFreeAdmission(admissionFee)
                ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400 font-semibold'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-300 font-medium'
            }`}
          >
            {formatAdmissionBadgeText(admissionFee)}
          </Badge>
        )}

        {/* Kiosk Info Badge with Hover & Click Tooltip */}
        {kioskDescription && (
          <div className="relative inline-flex">
            <button
              type="button"
              data-badge="kiosk-info"
              title={kioskDescription}
              aria-label={`Kiosk vorhanden: ${kioskDescription}`}
              aria-expanded={activeTooltip === 'kiosk'}
              onClick={(e) => handleToggleTooltip(e, 'kiosk')}
              onMouseEnter={() => setHoveredTooltip('kiosk')}
              onMouseLeave={() =>
                setHoveredTooltip((prev) => (prev === 'kiosk' ? null : prev))
              }
              onFocus={() => setHoveredTooltip('kiosk')}
              onBlur={() =>
                setHoveredTooltip((prev) => (prev === 'kiosk' ? null : prev))
              }
              onKeyDown={stopPropagation}
              className={`inline-flex items-center gap-1 rounded-md border border-amber-500/35 bg-amber-500/15 font-medium text-amber-300 transition-colors hover:border-amber-400/60 hover:bg-amber-500/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer ${textSizeClass}`}
            >
              <span>☕ Kiosk vorhanden</span>
            </button>
          </div>
        )}

        {/* Parking & Hall Notes Badge with Hover & Click Tooltip */}
        {parkingNotes && (
          <div className="relative inline-flex">
            <button
              type="button"
              data-badge="parking-notes"
              title={parkingNotes}
              aria-label={`Park- und Hallenhinweise: ${parkingNotes}`}
              aria-expanded={activeTooltip === 'parking'}
              onClick={(e) => handleToggleTooltip(e, 'parking')}
              onMouseEnter={() => setHoveredTooltip('parking')}
              onMouseLeave={() =>
                setHoveredTooltip((prev) => (prev === 'parking' ? null : prev))
              }
              onFocus={() => setHoveredTooltip('parking')}
              onBlur={() =>
                setHoveredTooltip((prev) => (prev === 'parking' ? null : prev))
              }
              onKeyDown={stopPropagation}
              className={`inline-flex items-center gap-1 rounded-md border border-sky-500/35 bg-sky-500/15 font-medium text-sky-300 transition-colors hover:border-sky-400/60 hover:bg-sky-500/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer ${textSizeClass}`}
            >
              <span>🅿️ Parkhinweis</span>
            </button>
          </div>
        )}
      </div>

      {/* Interactive Tooltip Banner (shown on Hover, Focus, or Tap/Click for Mobile & Desktop a11y) */}
      {activeTooltip === 'kiosk' && kioskDescription && (
        <div
          role="tooltip"
          data-tooltip="kiosk-info"
          className="rounded-lg border border-amber-500/30 bg-slate-900/95 px-2.5 py-1.5 text-[11px] text-slate-200 shadow-md"
        >
          <span className="font-semibold text-amber-300">☕ Kioskangebot: </span>
          <span>{kioskDescription}</span>
        </div>
      )}

      {activeTooltip === 'parking' && parkingNotes && (
        <div
          role="tooltip"
          data-tooltip="parking-notes"
          className="rounded-lg border border-sky-500/30 bg-slate-900/95 px-2.5 py-1.5 text-[11px] text-slate-200 shadow-md"
        >
          <span className="font-semibold text-sky-300">🅿️ Hallen- & Parkhinweis: </span>
          <span>{parkingNotes}</span>
        </div>
      )}
    </div>
  );
};
