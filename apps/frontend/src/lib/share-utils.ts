import type { Match } from '@sundayleague/shared-types';
import { formatDisplayDate, formatKickoffTime } from './date-utils';

export interface ShareMatchData {
  title: string;
  text: string;
  url: string;
}

/**
 * Returns the canonical match sharing URL.
 * In browser context, respects origin; falls back to https://heimspielradar.de.
 */
export function getMatchShareUrl(matchId: number): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://heimspielradar.de';

  return `${origin}/matches/${matchId}`;
}

/**
 * Formats a match into prefilled share text:
 * Format: `🏀 Heimspiel: [Heim] vs [Gast] | [Datum], [Uhrzeit] | [Halle], [Stadt] | [Liga] [URL]`
 */
export function formatMatchShareText(match: Match, url?: string): string {
  const targetUrl = url ?? getMatchShareUrl(match.id);
  const homeTeam = match.homeTeam.name;
  const guestTeam = match.guestTeam.name;

  const dateStr = formatDisplayDate(match.kickoffDate);
  const timeStr = formatKickoffTime(match.kickoffTime);
  const dateTimePart = `${dateStr}, ${timeStr}`;

  const venueParts = [match.venue?.name, match.venue?.city].filter(Boolean);
  const venuePart = venueParts.length > 0 ? venueParts.join(', ') : 'Halle offen';

  const leaguePart = match.league?.name || 'Amateur-Basketball';

  return `🏀 Heimspiel: ${homeTeam} vs ${guestTeam} | ${dateTimePart} | ${venuePart} | ${leaguePart} ${targetUrl}`;
}

/**
 * Formats match data for Web Share API and Clipboard.
 */
export function getMatchSharePayload(match: Match): ShareMatchData {
  const url = getMatchShareUrl(match.id);
  const title = `${match.homeTeam.name} vs ${match.guestTeam.name} – HeimspielRadar`;
  const text = formatMatchShareText(match, url);

  return {
    title,
    text,
    url,
  };
}

export type ShareResult = 'shared' | 'copied' | 'failed';

export interface ShareMatchOptions {
  onSuccess?: (type: 'shared' | 'copied') => void;
  onError?: (error: Error) => void;
}

/**
 * Shares a match using navigator.share if available, otherwise falls back to clipboard.writeText.
 */
export async function shareMatch(
  match: Match,
  options?: ShareMatchOptions
): Promise<ShareResult> {
  const payload = getMatchSharePayload(match);

  // 1. Try native Web Share API (typically mobile)
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      });
      options?.onSuccess?.('shared');

      return 'shared';
    } catch (err: unknown) {
      // AbortError is triggered when user cancels share sheet - treat as non-fatal
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'failed';
      }
      // If native sharing fails for another reason, fall through to clipboard
    }
  }

  // 2. Fallback: Clipboard writeText
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    'writeText' in navigator.clipboard
  ) {
    try {
      await navigator.clipboard.writeText(payload.text);
      options?.onSuccess?.('copied');

      return 'copied';
    } catch (clipboardErr: unknown) {
      const errorObj = clipboardErr instanceof Error ? clipboardErr : new Error(String(clipboardErr));
      options?.onError?.(errorObj);

      return 'failed';
    }
  }

  // 3. Last fallback: prompt / execCommand fallback if needed
  try {
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = payload.text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);

      if (success) {
        options?.onSuccess?.('copied');

        return 'copied';
      }
    }
  } catch (execErr: unknown) {
    const errorObj = execErr instanceof Error ? execErr : new Error(String(execErr));
    options?.onError?.(errorObj);

    return 'failed';
  }

  return 'failed';
}
