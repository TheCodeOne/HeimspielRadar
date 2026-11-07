export function formatUptime(seconds: number): string {
  if (seconds <= 0 || isNaN(seconds)) {
    return '0s';
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }

  if (hours > 0 || days > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0 || days > 0 || hours > 0) {
    parts.push(`${minutes}m`);
  }

  if (parts.length === 0) {
    parts.push(`${secs}s`);
  }

  return parts.join(' ');
}

export function isGitSha(sha?: string | null): boolean {
  if (!sha) {
    return false;
  }

  const trimmed = sha.trim();

  if (trimmed === 'dev' || trimmed === 'unknown') {
    return false;
  }

  return /^[0-9a-f]{7,40}$/i.test(trimmed);
}

export function getCommitUrl(sha: string): string {
  return `https://github.com/TheCodeOne/HeimspielRadar/commit/${sha}`;
}

export const RELEASES_URL = 'https://github.com/TheCodeOne/HeimspielRadar/releases';

export function formatIsoTimestamp(isoString?: string | null): string {
  if (!isoString) {
    return '–';
  }

  try {
    const d = new Date(isoString);

    if (isNaN(d.getTime())) {
      return isoString;
    }

    return new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(d);
  } catch {
    return isoString;
  }
}
