import type { Match } from '@sundayleague/shared-types';
import { formatDisplayDate, formatKickoffTime } from './date-utils';
import {
  generateStoryImageBlob,
  type StoryTheme,
} from './story-image-generator';

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

export type ShareResult = 'shared' | 'copied' | 'downloaded' | 'failed';

export interface ShareMatchOptions {
  onSuccess?: (type: 'shared' | 'copied') => void;
  onError?: (error: Error) => void;
}

export interface ShareStoryOptions {
  theme?: StoryTheme | 'auto';
  customNote?: string;
  onSuccess?: (type: 'shared' | 'downloaded') => void;
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

/**
 * Copies the match URL to clipboard so users can easily paste it into Instagram link-stickers.
 */
async function copyMatchLinkToClipboard(url: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && 'writeText' in navigator.clipboard) {
      await navigator.clipboard.writeText(url);

      return true;
    }

    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');

      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');

      document.body.removeChild(textarea);

      return Boolean(success);
    }
  } catch {
    // Ignore clipboard copy errors in background
  }

  return false;
}

/**
 * Downloads a blob as a PNG file in desktop / browser environment.
 */
function triggerFileDownload(blob: Blob, filename: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }

  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  setTimeout(() => {
    window.URL.revokeObjectURL(objectUrl);
  }, 1000);
}

/**
 * Generates and shares an Instagram Story (9:16) image for a match.
 * - On supported mobile browsers (Web Share API with file support):
 *   Opens native share sheet with file + copies match link for sticker.
 * - Fallback / Desktop:
 *   Downloads heimspiel-[matchId].png and copies match link to clipboard.
 */
export async function shareMatchStory(
  match: Match,
  options?: ShareStoryOptions
): Promise<ShareResult> {
  const matchUrl = getMatchShareUrl(match.id);
  const filename = `heimspiel-${match.id}.png`;

  try {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://heimspielradar.de';

    const imageBlob = await generateStoryImageBlob(match, {
      theme: options?.theme,
      customNote: options?.customNote,
      origin,
    });

    const file = new File([imageBlob], filename, { type: 'image/png' });

    // Always attempt copying match URL to clipboard for Instagram link-sticker
    await copyMatchLinkToClipboard(matchUrl);

    // Check if navigator.share supports files
    if (
      typeof navigator !== 'undefined' &&
      'share' in navigator &&
      'canShare' in navigator &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          files: [file],
          title: `${match.homeTeam.name} vs ${match.guestTeam.name}`,
          text: `🏀 Heimspiel: ${match.homeTeam.name} vs ${match.guestTeam.name} – Link für Story Sticker: ${matchUrl}`,
          url: matchUrl,
        });

        options?.onSuccess?.('shared');

        return 'shared';
      } catch (shareErr: unknown) {
        if (shareErr instanceof DOMException && shareErr.name === 'AbortError') {
          return 'failed';
        }
        // Fall back to download if share throws
      }
    }

    // Fallback: Trigger download
    triggerFileDownload(imageBlob, filename);
    options?.onSuccess?.('downloaded');

    return 'downloaded';
  } catch (err: unknown) {
    const errorObj = err instanceof Error ? err : new Error(String(err));

    options?.onError?.(errorObj);

    return 'failed';
  }
}
