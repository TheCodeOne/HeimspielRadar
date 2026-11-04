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

export function formatSubmitterInfo(match: Match): string | null {
  const name = match.submitterName?.trim();
  const role = match.submitterRole?.trim();

  if (name && role) {
    return `Gemeldet von ${name} (${role})`;
  }

  if (name) {
    return `Gemeldet von ${name}`;
  }

  if (role) {
    return `Gemeldet von (${role})`;
  }

  // Also check if submitter info is mentioned in matchNotes
  const notes = match.matchNotes?.trim() || '';
  const matchSubmitter = notes.match(/gemeldet\s+von\s+([^\n.,;()]+)(?:\s*\(([^)]+)\))?/i);

  if (matchSubmitter) {
    const parsedName = matchSubmitter[1].trim();
    const parsedRole = matchSubmitter[2]?.trim();

    if (parsedRole) {
      return `Gemeldet von ${parsedName} (${parsedRole})`;
    }

    return `Gemeldet von ${parsedName}`;
  }

  return null;
}

export const KioskInfoBadges: React.FC<KioskInfoBadgesProps> = ({
  match,
  className = '',
  size = 'default',
}) => {
  const admissionFee = match.admissionFee?.trim() || null;
  const kioskDescription = match.venue?.kioskDescription?.trim() || null;
  const parkingNotes = match.venue?.parkingNotes?.trim() || null;
  const matchNotes = match.matchNotes?.trim() || null;
  const submitterInfo = formatSubmitterInfo(match);

  if (!admissionFee && !kioskDescription && !parkingNotes && !matchNotes && !submitterInfo) {
    return null;
  }

  const textSizeClass = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-[11px] px-2.5 py-0.5';

  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className={`flex flex-col gap-1.5 ${className}`}
      onClick={stopPropagation}
      data-testid="kiosk-info-badges"
    >
      {/* 1. Direct Information Tiles (Kiosk, Parking, Match Notes, Submitter) */}
      {(kioskDescription || parkingNotes || matchNotes || submitterInfo) && (
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

          {submitterInfo && (
            <div
              data-tile="submitter-info"
              className="flex items-start gap-1.5 rounded-lg border border-teal-500/30 bg-teal-500/10 px-2.5 py-1.5 text-xs text-teal-200"
            >
              <span className="shrink-0 text-sm leading-none" aria-hidden="true">
                👤
              </span>
              <div className="min-w-0 flex-1 leading-snug">
                <span className="font-semibold text-teal-300">Community: </span>
                <span className="text-teal-100">{submitterInfo}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Compact static badges (Admission) */}
      {admissionFee && (
        <div className="flex flex-wrap items-center gap-1.5">
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
        </div>
      )}
    </div>
  );
};
