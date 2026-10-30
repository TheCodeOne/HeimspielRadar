import type { Match } from '@sundayleague/shared-types';
import { formatDisplayDate, formatKickoffTime } from './date-utils';

export type StoryTheme = 'classic' | 'vintage' | 'halloween';

export interface ParsedMatchScore {
  home: number;
  guest: number;
  winner: 'home' | 'guest' | 'tie';
  raw: string;
}

/**
 * Parses match result string into structured home/guest score and winner.
 * Handles strings like "78:72", "78 : 72", "78-72".
 */
export function parseMatchScore(result?: string | null): ParsedMatchScore | null {
  if (!result) {
    return null;
  }

  const trimmed = result.trim();
  const match = trimmed.match(/^(\d+)\s*[:-]\s*(\d+)$/);

  if (!match) {
    return null;
  }

  const home = parseInt(match[1], 10);
  const guest = parseInt(match[2], 10);

  const winner: 'home' | 'guest' | 'tie' =
    home > guest ? 'home' : guest > home ? 'guest' : 'tie';

  return { home, guest, winner, raw: trimmed };
}

export interface SplitTeamNameResult {
  base: string;
  suffix?: string;
}

/**
 * Splits a basketball team name into the club name and optional team number/suffix
 * (e.g. "TSG Reutlingen 2" -> { base: "TSG Reutlingen", suffix: "2" })
 * so the suffix never awkwardly wraps alone onto a new line.
 */
export function splitTeamName(name: string): SplitTeamNameResult {
  const trimmed = name.trim();
  const match = trimmed.match(/^(.*)\s+(\d+|[IVX]+|[A-Z])$/);

  if (match) {
    return { base: match[1], suffix: match[2] };
  }

  return { base: trimmed };
}

/**
 * Computes a 2-3 letter club monogram for the team shield & background watermark.
 * Examples:
 * - "SV Möhringen" -> "SVM"
 * - "TSG Schwäbisch Hall" -> "TSG"
 * - "SV 03 Tigers Tübingen" -> "SVT"
 */
export function getClubMonogram(teamName: string): string {
  const { base } = splitTeamName(teamName);

  const clean = base
    .trim()
    .toUpperCase()
    .replace(/[^A-ZÄÖÜ0-9\s]/g, '');

  if (!clean) {
    return 'BB';
  }

  const parts = clean.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return 'BB';
  }

  const first = parts[0];

  // 3-letter club prefix like TSG, USC, MTV, TSV, VfL -> use directly
  if (first.length === 3 && /^[A-ZÄÖÜ]+$/.test(first)) {
    return first;
  }

  // 2-letter club prefix like SV, TV, SC, FC, TG, BG, SG -> append first letter of city/club word
  if (first.length === 2 && /^[A-ZÄÖÜ]+$/.test(first)) {
    const nextAlphaWord = parts.slice(1).find((w) => /^[A-ZÄÖÜ]/.test(w));

    if (nextAlphaWord) {
      return `${first}${nextAlphaWord[0]}`;
    }

    return first;
  }

  if (parts.length >= 2) {
    const initials = parts
      .filter((w) => /^[A-ZÄÖÜ]/.test(w))
      .map((w) => w[0])
      .join('')
      .slice(0, 3);

    if (initials.length >= 2) {
      return initials;
    }
  }

  return first.slice(0, 3);
}

/**
 * Builds the squad badge pill text shown next to HEIMTEAM / GASTTEAM (e.g. "HERREN 1", "DAMEN 2", "U18").
 */
export function getSquadBadgeLabel(
  suffix: string | undefined,
  league?: Match['league']
): string | null {
  const leagueName = league?.name || '';
  const ageMatch = leagueName.match(/\b(U\d{2}[A-Z]?)\b/i);

  let category = '';

  if (ageMatch) {
    category = ageMatch[1].toUpperCase();
  } else if (/damen|frauen/i.test(leagueName) || league?.gender === 'w' || league?.gender === 'f') {
    category = 'DAMEN';
  } else if (/herren|männer/i.test(leagueName) || league?.gender === 'm') {
    category = 'HERREN';
  }

  if (category && suffix) {
    return `${category} ${suffix}`;
  }

  if (category) {
    return category === 'HERREN' || category === 'DAMEN' ? `${category} 1` : category;
  }

  if (suffix) {
    return `TEAM ${suffix}`;
  }

  return null;
}

/**
 * Determines whether the Halloween theme should be active by default based on the date.
 * Active in late October (month index 9, days 24-31).
 */
export function isHalloweenSeason(date: Date = new Date()): boolean {
  const month = date.getMonth(); // 9 = October (0-indexed)
  const day = date.getDate();

  return month === 9 && day >= 24 && day <= 31;
}

/**
 * Resolves the effective StoryTheme, defaulting to seasonal auto-detection if 'auto' or unspecified.
 */
export function resolveStoryTheme(theme?: StoryTheme | 'auto'): StoryTheme {
  if (theme === 'classic' || theme === 'vintage' || theme === 'halloween') {
    return theme;
  }

  return isHalloweenSeason() ? 'halloween' : 'classic';
}

export interface StoryImageOptions {
  theme?: StoryTheme | 'auto';
  origin?: string;
  customNote?: string;
}

/**
 * Formats match date and kickoff time cleanly without duplicate "UHR" bug.
 * Example: "SAMSTAG • 30. OKT. • 17:00 UHR"
 */
export function formatGamedayDateTime(kickoffDate?: string | null, kickoffTime?: string | null): string {
  const dateStr = formatDisplayDate(kickoffDate).toUpperCase();
  const rawTimeStr = formatKickoffTime(kickoffTime);

  let timeStr = rawTimeStr;

  if (/uhr$/i.test(timeStr.trim())) {
    timeStr = timeStr.trim().replace(/uhr$/i, 'UHR');
  } else if (timeStr !== 'Uhrzeit offen') {
    timeStr = `${timeStr} UHR`;
  } else {
    timeStr = 'UHRZEIT OFFEN';
  }

  return `${dateStr} • ${timeStr}`;
}

/**
 * Formats only the kickoff time in uppercase ("20:15 UHR" or "OFFEN").
 */
function formatCleanTimeUpper(kickoffTime?: string | null): string {
  const rawTimeStr = formatKickoffTime(kickoffTime).trim();

  if (/uhr$/i.test(rawTimeStr)) {
    return rawTimeStr.replace(/uhr$/i, 'UHR');
  }

  if (rawTimeStr === 'Uhrzeit offen') {
    return 'ZEIT OFFEN';
  }

  return `${rawTimeStr} UHR`;
}

/**
 * Helper to draw a rounded rectangle.
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draws basketball court texture lines (subtle markings for Halloween).
 */
function drawBasketballCourtLines(
  ctx: CanvasRenderingContext2D,
  theme: StoryTheme
) {
  ctx.save();
  ctx.strokeStyle =
    theme === 'halloween'
      ? 'rgba(249, 115, 22, 0.07)'
      : 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 4;

  // Center circle
  ctx.beginPath();
  ctx.arc(540, 820, 240, 0, Math.PI * 2);
  ctx.stroke();

  // Center line
  ctx.beginPath();
  ctx.moveTo(0, 820);
  ctx.lineTo(1080, 820);
  ctx.stroke();

  // Free-throw key / 3-point arcs (top and bottom)
  ctx.beginPath();
  ctx.arc(540, 0, 480, 0, Math.PI);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(540, 1920, 480, Math.PI, 0);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draws a crisp vector calendar icon centered at (cx, cy).
 */
function drawCalendarIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, cx - 15, cy - 13, 30, 28, 5);
  ctx.stroke();

  // Top rings
  ctx.beginPath();
  ctx.moveTo(cx - 7, cy - 18);
  ctx.lineTo(cx - 7, cy - 9);
  ctx.moveTo(cx + 7, cy - 18);
  ctx.lineTo(cx + 7, cy - 9);
  // Horizontal header bar
  ctx.moveTo(cx - 15, cy - 3);
  ctx.lineTo(cx + 15, cy - 3);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws a crisp vector clock icon centered at (cx, cy).
 */
function drawClockIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, cy - 8);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx + 6, cy + 4);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws a crisp vector map-pin icon centered at (cx, cy).
 */
function drawMapPinIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;

  // Outer pin drop shape
  ctx.beginPath();
  ctx.arc(cx, cy - 4, 11, Math.PI * 0.85, Math.PI * 0.15, false);
  ctx.quadraticCurveTo(cx + 6, cy + 8, cx, cy + 15);
  ctx.quadraticCurveTo(cx - 6, cy + 8, cx - 9.8, cy + 1);
  ctx.closePath();
  ctx.stroke();

  // Inner circle
  ctx.beginPath();
  ctx.arc(cx, cy - 4, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws a crisp vector link chain icon centered at (cx, cy).
 */
function drawLinkIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.translate(cx, cy);

  drawRoundedRect(ctx, -14, -7, 16, 14, 7);
  ctx.stroke();

  drawRoundedRect(ctx, -2, -7, 16, 14, 7);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draws the custom orange-amber vector basketball badge at (cx, cy).
 */
function drawBasketballBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
  ctx.save();

  // Glowing circle fill
  const grad = ctx.createLinearGradient(cx - radius, cy + radius, cx + radius, cy - radius);
  grad.addColorStop(0, '#ea580c');
  grad.addColorStop(1, '#fbbf24');

  ctx.shadowColor = 'rgba(234, 88, 12, 0.4)';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Basketball seam lines inside
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#09090b';
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
  ctx.stroke();

  // Horizontal seam
  ctx.beginPath();
  ctx.moveTo(cx - radius + 2, cy);
  ctx.lineTo(cx + radius - 2, cy);
  ctx.stroke();

  // Left & right curved seams
  ctx.beginPath();
  ctx.arc(cx - radius * 0.85, cy, radius * 0.85, -0.75, 0.75);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx + radius * 0.85, cy, radius * 0.85, Math.PI - 0.75, Math.PI + 0.75);
  ctx.stroke();

  ctx.restore();
}

interface SplitTeamCardParams {
  teamName: string;
  role: 'home' | 'guest';
  isWinner: boolean;
  cardX: number;
  cardY: number;
  cardW: number;
  cardH: number;
  theme: StoryTheme;
  league?: Match['league'];
}

/**
 * Draws one of the two split glassmorphism Team Cards (Home or Guest) with:
 * - Left vertical accent bar
 * - Giant background monogram watermark
 * - Role label + Squad badge pill ("HERREN 1")
 * - Bold condensed uppercase club name
 * - Right-hand Club Monogram Shield ("SVM / HOME" or "TSG / AWAY")
 */
function drawSplitTeamCard(ctx: CanvasRenderingContext2D, params: SplitTeamCardParams) {
  const { teamName, role, isWinner, cardX, cardY, cardW, cardH, theme, league } = params;
  const isHome = role === 'home';
  const split = splitTeamName(teamName);
  const monogram = getClubMonogram(teamName);
  const squadBadge = getSquadBadgeLabel(split.suffix, league);
  const cardRadius = 38;

  ctx.save();

  // 1. Card Drop Shadow & Glassmorphism Fill
  ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
  ctx.shadowBlur = 38;
  ctx.shadowOffsetY = 16;

  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardRadius);

  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW * 0.4, cardY + cardH);

  if (theme === 'halloween') {
    cardGrad.addColorStop(0, 'rgba(30, 15, 45, 0.90)');
    cardGrad.addColorStop(1, 'rgba(14, 7, 22, 0.95)');
  } else {
    cardGrad.addColorStop(0, 'rgba(34, 24, 16, 0.88)');
    cardGrad.addColorStop(1, 'rgba(16, 11, 8, 0.95)');
  }

  ctx.fillStyle = cardGrad;
  ctx.fill();

  // Card Border
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.strokeStyle = isWinner
    ? 'rgba(16, 185, 129, 0.55)'
    : isHome
    ? 'rgba(245, 158, 11, 0.34)'
    : 'rgba(245, 158, 11, 0.20)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 2. Clip interior for watermark & left accent strip
  if ('clip' in ctx) {
    ctx.clip();
  }

  // Giant Watermark Monogram on right background
  ctx.save();
  ctx.font = '700 250px "Bebas Neue", "Oswald", Impact, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.036)';
  ctx.textAlign = 'right';
  ctx.fillText(monogram, cardX + cardW - 22, cardY + cardH + 14);
  ctx.restore();

  // Left Vertical Accent Bar
  ctx.save();
  const barW = 12;
  const barH = cardH - 72;
  const barX = cardX;
  const barY = cardY + 36;

  drawRoundedRect(ctx, barX - 4, barY, barW + 4, barH, 6);

  if (isWinner) {
    ctx.fillStyle = '#10b981';
  } else if (isHome) {
    const barGrad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
    barGrad.addColorStop(0, '#fbbf24');
    barGrad.addColorStop(1, '#ea580c');
    ctx.fillStyle = barGrad;
  } else {
    ctx.fillStyle = 'rgba(113, 113, 122, 0.75)';
  }

  ctx.fill();
  ctx.restore();

  // 3. Left Column: Role Label + Squad Pill + Club Name
  const textStartX = cardX + 54;
  const shieldW = 148;
  const shieldH = 148;
  const shieldX = cardX + cardW - shieldW - 44;
  const shieldY = cardY + (cardH - shieldH) / 2;
  const maxTextW = shieldX - textStartX - 32;

  // Top Row: Role Label ("HEIMTEAM" / "GASTTEAM") + Squad Badge ("HERREN 1")
  const labelY = cardY + 88;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = '700 22px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.letterSpacing = '4px';

  const roleText = isWinner
    ? isHome
      ? '🏆 HEIMTEAM • SIEGER'
      : '🏆 GASTTEAM • SIEGER'
    : isHome
    ? 'HEIMTEAM'
    : 'GASTTEAM';

  ctx.fillStyle = isWinner ? '#34d399' : '#a1a1aa';
  ctx.fillText(roleText, textStartX, labelY);

  const roleWidth = ctx.measureText(roleText).width + roleText.length * 3.5;

  if (squadBadge) {
    ctx.font = '800 18px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.letterSpacing = '1.5px';
    const badgeTextW = ctx.measureText(squadBadge).width + squadBadge.length * 1.2;
    const badgePadX = 16;
    const badgeW = badgeTextW + badgePadX * 2;
    const badgeH = 34;
    const badgeX = textStartX + roleWidth + 16;
    const badgeY = labelY - 25;

    drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 8);

    if (isHome) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.20)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
    } else {
      ctx.fillStyle = 'rgba(39, 39, 42, 0.90)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(82, 82, 91, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#d4d4d8';
    }

    ctx.fillText(squadBadge, badgeX + badgePadX, badgeY + 23);
  }

  ctx.restore();

  // Main Club Name (Bold Condensed Uppercase)
  const displayClubName = split.base.toUpperCase();
  ctx.save();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.letterSpacing = '0px';

  let fontSize = 68;
  ctx.font = `700 ${fontSize}px "Oswald", "Bebas Neue", -apple-system, BlinkMacSystemFont, sans-serif`;
  let nameWidth = ctx.measureText(displayClubName).width;

  while (nameWidth > maxTextW && fontSize > 48) {
    fontSize -= 2;
    ctx.font = `700 ${fontSize}px "Oswald", "Bebas Neue", -apple-system, BlinkMacSystemFont, sans-serif`;
    nameWidth = ctx.measureText(displayClubName).width;
  }

  if (nameWidth <= maxTextW) {
    ctx.fillText(displayClubName, textStartX, cardY + 198);
  } else {
    // Wrap cleanly onto 2 lines if club name is very long
    const words = displayClubName.split(/\s+/);
    const mid = Math.ceil(words.length / 2);
    const line1 = words.slice(0, mid).join(' ');
    const line2 = words.slice(mid).join(' ');

    let lineSize = 52;
    ctx.font = `700 ${lineSize}px "Oswald", "Bebas Neue", -apple-system, BlinkMacSystemFont, sans-serif`;

    while (
      (ctx.measureText(line1).width > maxTextW || ctx.measureText(line2).width > maxTextW) &&
      lineSize > 38
    ) {
      lineSize -= 2;
      ctx.font = `700 ${lineSize}px "Oswald", "Bebas Neue", -apple-system, BlinkMacSystemFont, sans-serif`;
    }

    ctx.fillText(line1, textStartX, cardY + 166);
    ctx.fillText(line2, textStartX, cardY + 166 + lineSize + 8);
  }

  ctx.restore();

  // 4. Right Column: Auto-Generated Club Monogram Shield
  ctx.save();
  drawRoundedRect(ctx, shieldX, shieldY, shieldW, shieldH, 30);

  const shieldGrad = ctx.createLinearGradient(
    shieldX,
    shieldY,
    shieldX + shieldW,
    shieldY + shieldH
  );

  if (isHome) {
    shieldGrad.addColorStop(0, 'rgba(245, 158, 11, 0.22)');
    shieldGrad.addColorStop(1, 'rgba(69, 26, 3, 0.68)');
    ctx.fillStyle = shieldGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
  } else {
    shieldGrad.addColorStop(0, 'rgba(39, 39, 42, 0.85)');
    shieldGrad.addColorStop(1, 'rgba(9, 9, 11, 0.92)');
    ctx.fillStyle = shieldGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(63, 63, 70, 0.85)';
  }

  ctx.lineWidth = 2;
  ctx.stroke();

  // Shield Monogram ("SVM" / "TSG")
  const shieldCenterX = shieldX + shieldW / 2;
  ctx.textAlign = 'center';
  ctx.font = '700 56px "Bebas Neue", "Oswald", Impact, sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillStyle = isHome ? '#fcd34d' : '#e4e4e7';
  ctx.fillText(monogram, shieldCenterX, shieldY + 86);

  // Shield Sub-label ("HOME" / "AWAY")
  ctx.font = '800 18px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.letterSpacing = '3px';
  ctx.fillStyle = isHome ? 'rgba(245, 158, 11, 0.85)' : '#a1a1aa';
  ctx.fillText(isHome ? 'HOME' : 'AWAY', shieldCenterX, shieldY + 120);

  ctx.restore();
  ctx.restore();
}

const cachedCourtBgImages: Record<string, HTMLImageElement> = {};

/**
 * Loads and caches the photographic hardwood court background image for browser rendering.
 */
async function loadCourtBackgroundImage(
  ctx: CanvasRenderingContext2D,
  imageSrc: string
): Promise<HTMLImageElement | null> {
  if (!('Image' in globalThis) || !('drawImage' in ctx)) {
    return null;
  }

  const cached = cachedCourtBgImages[imageSrc];

  if (cached && cached.complete && cached.naturalWidth > 0) {
    return cached;
  }

  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timeout = setTimeout(() => {
      resolve(null);
    }, 1500);

    img.onload = () => {
      clearTimeout(timeout);
      cachedCourtBgImages[imageSrc] = img;
      resolve(img);
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };

    img.src = imageSrc;
  });
}

/**
 * Generates an Instagram Story 9:16 (1080x1920) image Blob from match data.
 */
export async function generateStoryImageBlob(
  match: Match,
  options?: StoryImageOptions
): Promise<Blob> {
  const width = 1080;
  const height = 1920;
  const theme = resolveStoryTheme(options?.theme);

  const canvas =
    typeof document !== 'undefined'
      ? document.createElement('canvas')
      : null;

  if (!canvas) {
    throw new Error('Canvas 2D is only supported in browser environment');
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get 2D canvas context');
  }

  // Wait briefly for web fonts (Bebas Neue / Oswald) when running in real browser
  if ('fonts' in document && document.fonts && 'ready' in document.fonts) {
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, 350)),
    ]);
  }

  // 1. Epic Background (Untouched: Real Hardwood Floor for Classic, Spooky Violet for Halloween)
  if (theme === 'halloween') {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#190a2a');
    bgGrad.addColorStop(0.35, '#0e0517');
    bgGrad.addColorStop(0.75, '#0b0412');
    bgGrad.addColorStop(1, '#1f0d04');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const glowTopRight = ctx.createRadialGradient(880, 280, 40, 880, 280, 520);
    glowTopRight.addColorStop(0, 'rgba(249, 115, 22, 0.28)');
    glowTopRight.addColorStop(0.7, 'rgba(249, 115, 22, 0.05)');
    glowTopRight.addColorStop(1, 'rgba(249, 115, 22, 0)');
    ctx.fillStyle = glowTopRight;
    ctx.fillRect(0, 0, width, height);

    const glowCenter = ctx.createRadialGradient(540, 820, 80, 540, 820, 600);
    glowCenter.addColorStop(0, 'rgba(168, 85, 247, 0.18)');
    glowCenter.addColorStop(1, 'rgba(168, 85, 247, 0)');
    ctx.fillStyle = glowCenter;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';

    const drawBat = (bx: number, by: number, scale: number) => {
      ctx.save();
      ctx.translate(bx, by);
      ctx.scale(scale, scale);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(15, -20, 40, -10);
      ctx.quadraticCurveTo(25, 10, 15, 12);
      ctx.quadraticCurveTo(5, 5, 0, 15);
      ctx.quadraticCurveTo(-5, 5, -15, 12);
      ctx.quadraticCurveTo(-25, 10, -40, -10);
      ctx.quadraticCurveTo(-15, -20, 0, 0);
      ctx.fill();
      ctx.restore();
    };

    drawBat(160, 210, 1.1);
    drawBat(240, 160, 0.65);
    drawBat(920, 290, 0.95);
    drawBat(860, 360, 0.55);
    ctx.restore();

    drawBasketballCourtLines(ctx, theme);
  } else {
    const bgSrc =
      theme === 'vintage' ? '/story-bg-court-lines.jpg?v=1' : '/story-bg-court.jpg?v=2';

    const courtBgImg = await loadCourtBackgroundImage(ctx, bgSrc);

    if (courtBgImg) {
      ctx.drawImage(courtBgImg, 0, 0, width, height);

      const overlayGrad = ctx.createLinearGradient(0, 0, 0, height);

      if (theme === 'vintage') {
        overlayGrad.addColorStop(0, 'rgba(6, 5, 4, 0.38)');
        overlayGrad.addColorStop(0.28, 'rgba(6, 5, 4, 0.20)');
        overlayGrad.addColorStop(0.68, 'rgba(6, 5, 4, 0.25)');
        overlayGrad.addColorStop(1, 'rgba(6, 5, 4, 0.65)');
      } else {
        overlayGrad.addColorStop(0, 'rgba(6, 5, 4, 0.65)');
        overlayGrad.addColorStop(0.28, 'rgba(6, 5, 4, 0.32)');
        overlayGrad.addColorStop(0.68, 'rgba(6, 5, 4, 0.36)');
        overlayGrad.addColorStop(1, 'rgba(6, 5, 4, 0.75)');
      }

      ctx.fillStyle = overlayGrad;
      ctx.fillRect(0, 0, width, height);
    } else {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#0c1322');
      bgGrad.addColorStop(0.3, '#070b14');
      bgGrad.addColorStop(0.7, '#05070d');
      bgGrad.addColorStop(1, '#020408');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);
    }
  }

  // 2. Top Header - Broadcast Sport Display Headline
  ctx.save();
  ctx.textAlign = 'center';

  const scoreData = parseMatchScore(match.result);
  const isFinished = Boolean(scoreData);

  const accentColor = theme === 'halloween' ? '#f97316' : '#fbbf24';
  const accentLight = theme === 'halloween' ? '#fdba74' : '#fef3c7';

  const defaultCategoryText =
    theme === 'halloween' ? 'HALLOWEEN SPECIAL' : 'OFFIZIELLES LIGASPIEL';

  const categoryText = isFinished ? 'MATCH RESULT' : defaultCategoryText;

  ctx.font = '800 22px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = isFinished && theme !== 'halloween' ? '#34d399' : accentColor;
  ctx.letterSpacing = '7px';
  ctx.fillText(categoryText, 540, 180);

  // Decorative side fade lines next to eyebrow
  const catHalfW = (ctx.measureText(categoryText).width + categoryText.length * 6) / 2;
  const lineLen = 56;
  const leftLineGrad = ctx.createLinearGradient(540 - catHalfW - 20 - lineLen, 172, 540 - catHalfW - 20, 172);
  leftLineGrad.addColorStop(0, 'rgba(245, 158, 11, 0)');
  leftLineGrad.addColorStop(1, 'rgba(245, 158, 11, 0.8)');
  ctx.fillStyle = leftLineGrad;
  ctx.fillRect(540 - catHalfW - 20 - lineLen, 171, lineLen, 2.5);

  const rightLineGrad = ctx.createLinearGradient(540 + catHalfW + 20, 172, 540 + catHalfW + 20 + lineLen, 172);
  rightLineGrad.addColorStop(0, 'rgba(245, 158, 11, 0.8)');
  rightLineGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
  ctx.fillStyle = rightLineGrad;
  ctx.fillRect(540 + catHalfW + 20, 171, lineLen, 2.5);

  // Main Condensed Broadcast Headline ("GAMEDAY" / "FINAL SCORE")
  const headline = isFinished ? 'FINAL SCORE' : 'GAMEDAY';
  ctx.font = '700 132px "Bebas Neue", "Oswald", Impact, sans-serif';
  const headlineGrad = ctx.createLinearGradient(0, 175, 0, 285);
  headlineGrad.addColorStop(0, '#FFFFFF');
  headlineGrad.addColorStop(0.55, '#F3F4F6');
  headlineGrad.addColorStop(1, '#A1A1AA');
  ctx.fillStyle = headlineGrad;
  ctx.letterSpacing = '5px';
  ctx.shadowColor =
    theme === 'halloween'
      ? 'rgba(249, 115, 22, 0.5)'
      : isFinished
      ? 'rgba(16, 185, 129, 0.45)'
      : 'rgba(234, 88, 12, 0.42)';
  ctx.shadowBlur = 32;
  ctx.fillText(headline, 540, 275);
  ctx.restore();

  // League Pill Badge with glowing amber dot
  const leagueName = (match.league?.name || 'Amateur Basketball').toUpperCase();
  ctx.save();
  ctx.font = '700 22px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.letterSpacing = '3px';
  const leagueTextW = ctx.measureText(leagueName).width + leagueName.length * 2.5;
  const pillPadding = 44;
  const pillW = Math.min(leagueTextW + pillPadding * 2 + 24, 900);
  const pillH = 50;
  const pillX = (width - pillW) / 2;
  const pillY = 308;

  drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 25);
  ctx.fillStyle = theme === 'halloween' ? 'rgba(249, 115, 22, 0.16)' : 'rgba(245, 158, 11, 0.14)';
  ctx.fill();
  ctx.strokeStyle = theme === 'halloween' ? 'rgba(249, 115, 22, 0.45)' : 'rgba(245, 158, 11, 0.40)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Glowing dot inside league pill
  const dotX = pillX + 34;
  const dotY = pillY + pillH / 2;
  ctx.beginPath();
  ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#fbbf24';
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = accentLight;
  ctx.fillText(leagueName, 540 + 10, pillY + 33);
  ctx.restore();

  // 3. Split Matchup Section (Two Team Cards + Floating 3D VS / Score Badge)
  const cardX = 64;
  const cardW = width - cardX * 2; // 952px
  const singleCardH = 325;
  const homeCardY = 405;
  const guestCardY = 785;
  const centerBadgeY = 757;

  const homeIsWinner = scoreData?.winner === 'home';
  const guestIsWinner = scoreData?.winner === 'guest';

  // Top Card: Home Team
  drawSplitTeamCard(ctx, {
    teamName: match.homeTeam.name,
    role: 'home',
    isWinner: homeIsWinner,
    cardX,
    cardY: homeCardY,
    cardW,
    cardH: singleCardH,
    theme,
    league: match.league,
  });

  // Bottom Card: Guest Team
  drawSplitTeamCard(ctx, {
    teamName: match.guestTeam.name,
    role: 'guest',
    isWinner: guestIsWinner,
    cardX,
    cardY: guestCardY,
    cardW,
    cardH: singleCardH,
    theme,
    league: match.league,
  });

  // Floating Center Element (Overlaps both cards at centerBadgeY = 757)
  // Horizontal side glow lines flanking the center badge
  ctx.save();
  const leftSideGrad = ctx.createLinearGradient(250, centerBadgeY, 455, centerBadgeY);
  leftSideGrad.addColorStop(0, 'rgba(245, 158, 11, 0)');
  leftSideGrad.addColorStop(1, 'rgba(245, 158, 11, 0.55)');
  ctx.fillStyle = leftSideGrad;
  ctx.fillRect(250, centerBadgeY - 1, 205, 2.5);

  const rightSideGrad = ctx.createLinearGradient(625, centerBadgeY, 830, centerBadgeY);
  rightSideGrad.addColorStop(0, 'rgba(245, 158, 11, 0.55)');
  rightSideGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
  ctx.fillStyle = rightSideGrad;
  ctx.fillRect(625, centerBadgeY - 1, 205, 2.5);
  ctx.restore();

  if (isFinished && scoreData) {
    // Floating 3D Final Score Capsule [ 78 : 72 ]
    ctx.save();

    const scoreGlow = ctx.createRadialGradient(
      540,
      centerBadgeY,
      20,
      540,
      centerBadgeY,
      200
    );

    scoreGlow.addColorStop(
      0,
      theme === 'halloween'
        ? 'rgba(249, 115, 22, 0.45)'
        : 'rgba(16, 185, 129, 0.40)'
    );
    scoreGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = scoreGlow;
    ctx.fillRect(280, centerBadgeY - 120, 520, 240);

    const scoreBoxW = 420;
    const scoreBoxH = 104;
    const scoreBoxX = (width - scoreBoxW) / 2;
    const scoreBoxY = centerBadgeY - scoreBoxH / 2;

    // Dark outer knockout ring so the capsule visibly cuts into both cards
    drawRoundedRect(ctx, scoreBoxX - 8, scoreBoxY - 8, scoreBoxW + 16, scoreBoxH + 16, 40);
    ctx.fillStyle = '#0c0906';
    ctx.fill();

    drawRoundedRect(ctx, scoreBoxX, scoreBoxY, scoreBoxW, scoreBoxH, 34);
    ctx.fillStyle = theme === 'halloween' ? 'rgba(31, 14, 47, 0.96)' : '#09090b';
    ctx.fill();
    ctx.strokeStyle =
      theme === 'halloween'
        ? '#f97316'
        : scoreData.winner === 'tie'
        ? '#f59e0b'
        : '#10b981';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    const homeScoreText = `${scoreData.home}`;
    const colonText = ':';
    const guestScoreText = `${scoreData.guest}`;

    ctx.font = '900 66px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textBaseline = 'middle';

    ctx.textAlign = 'right';
    ctx.fillStyle = homeIsWinner ? '#34d399' : '#ffffff';
    ctx.fillText(homeScoreText, 540 - 32, centerBadgeY);

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillText(colonText, 540, centerBadgeY - 2);

    ctx.textAlign = 'left';
    ctx.fillStyle = guestIsWinner ? '#34d399' : '#ffffff';
    ctx.fillText(guestScoreText, 540 + 32, centerBadgeY);

    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  } else {
    // Floating 3D VS Medallion overlapping both cards
    ctx.save();

    const vsGlow = ctx.createRadialGradient(540, centerBadgeY, 15, 540, centerBadgeY, 115);
    vsGlow.addColorStop(0, 'rgba(245, 158, 11, 0.48)');
    vsGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = vsGlow;
    ctx.fillRect(420, centerBadgeY - 120, 240, 240);

    // Outer dark knockout ring (#0f0a07)
    ctx.beginPath();
    ctx.arc(540, centerBadgeY, 68, 0, Math.PI * 2);
    ctx.fillStyle = '#0f0a07';
    ctx.fill();

    // Glowing amber-to-orange border ring
    const ringGrad = ctx.createLinearGradient(540, centerBadgeY - 58, 540, centerBadgeY + 58);
    ringGrad.addColorStop(0, '#fbbf24');
    ringGrad.addColorStop(1, '#ea580c');
    ctx.beginPath();
    ctx.arc(540, centerBadgeY, 58, 0, Math.PI * 2);
    ctx.fillStyle = ringGrad;
    ctx.fill();

    // Inner dark zinc core
    ctx.beginPath();
    ctx.arc(540, centerBadgeY, 53, 0, Math.PI * 2);
    ctx.fillStyle = '#09090b';
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.font = 'italic 700 44px "Bebas Neue", "Oswald", -apple-system, sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('VS', 538, centerBadgeY + 15);
    ctx.restore();
  }

  // 4. Kickoff & Venue Info Card (Split into Top Date/Time Bar + Bottom Venue Row with Vector Icons)
  const infoY = 1155;
  const infoW = cardW;
  const infoH = 230;
  const infoX = cardX;

  ctx.save();
  drawRoundedRect(ctx, infoX, infoY, infoW, infoH, 36);
  const infoGrad = ctx.createLinearGradient(infoX, infoY, infoX, infoY + infoH);
  infoGrad.addColorStop(0, theme === 'halloween' ? 'rgba(30, 15, 45, 0.88)' : 'rgba(28, 20, 14, 0.86)');
  infoGrad.addColorStop(1, theme === 'halloween' ? 'rgba(14, 7, 22, 0.94)' : 'rgba(14, 10, 7, 0.94)');
  ctx.fillStyle = infoGrad;
  ctx.fill();
  ctx.strokeStyle = theme === 'halloween' ? 'rgba(249, 115, 22, 0.35)' : 'rgba(245, 158, 11, 0.26)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Horizontal divider between Date/Time row and Venue row
  const dividerY = infoY + 104;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fillRect(infoX + 44, dividerY, infoW - 88, 1.5);

  const dateOnlyStr = formatDisplayDate(match.kickoffDate).toUpperCase();
  const timeOnlyStr = formatCleanTimeUpper(match.kickoffTime);
  const topRowCenterY = infoY + 54;

  if (isFinished) {
    ctx.textAlign = 'center';
    ctx.font = '800 30px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`🏁  ENDERGEBNIS • ${dateOnlyStr}`, 540, topRowCenterY + 10);
  } else {
    // Measure Date + Tip-Off Pill to center them as a unified horizontal row
    ctx.font = '800 28px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
    const dateTextW = ctx.measureText(dateOnlyStr).width;
    const tipOffLabel = `TIP-OFF ${timeOnlyStr}`;
    ctx.font = '800 25px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
    const tipOffTextW = ctx.measureText(tipOffLabel).width;
    const tipPillW = 36 + 14 + tipOffTextW + 36;
    const tipPillH = 52;
    const totalTopRowW = 36 + 14 + dateTextW + 36 + 12 + 36 + tipPillW;
    const startTopX = 540 - totalTopRowW / 2;

    // Calendar icon + Date
    drawCalendarIcon(ctx, startTopX + 18, topRowCenterY, '#fbbf24');
    ctx.textAlign = 'left';
    ctx.font = '800 28px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(dateOnlyStr, startTopX + 48, topRowCenterY + 10);

    // Bullet dot
    const bulletX = startTopX + 48 + dateTextW + 34;
    ctx.beginPath();
    ctx.arc(bulletX, topRowCenterY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#52525b';
    ctx.fill();

    // Tip-Off Pill
    const tipPillX = bulletX + 34;
    const tipPillY = topRowCenterY - tipPillH / 2;
    drawRoundedRect(ctx, tipPillX, tipPillY, tipPillW, tipPillH, 14);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.36)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    drawClockIcon(ctx, tipPillX + 30, topRowCenterY, '#fbbf24');
    ctx.font = '800 25px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#fcd34d';
    ctx.fillText(tipOffLabel, tipPillX + 56, topRowCenterY + 9);
  }

  // Bottom Row: Map-Pin Circle + Venue & Street
  const venueTitle = match.venue?.name || 'Sporthalle';
  const venueCity = match.venue?.city ? `${venueTitle} • ${match.venue.city}` : venueTitle;
  const venueStreet = match.venue?.street || '';

  ctx.font = '700 28px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
  const venueCityW = ctx.measureText(venueCity).width;
  ctx.font = '500 22px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
  const venueStreetW = venueStreet ? ctx.measureText(venueStreet).width : 0;
  const textBlockW = Math.max(venueCityW, venueStreetW);
  const totalVenueW = 58 + 22 + textBlockW;
  const venueStartX = Math.max(infoX + 48, 540 - totalVenueW / 2);
  const pinCenterY = dividerY + 62;

  // Map-pin circle badge
  ctx.beginPath();
  ctx.arc(venueStartX + 28, pinCenterY, 28, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.30)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  drawMapPinIcon(ctx, venueStartX + 28, pinCenterY, '#fbbf24');

  ctx.textAlign = 'left';
  ctx.font = '700 28px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#fef3c7';

  if (venueStreet) {
    ctx.fillText(venueCity, venueStartX + 76, pinCenterY - 4);
    ctx.font = '500 22px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#a1a1aa';
    ctx.fillText(venueStreet, venueStartX + 76, pinCenterY + 26);
  } else {
    ctx.fillText(venueCity, venueStartX + 76, pinCenterY + 10);
  }

  ctx.restore();

  // 4b. Custom Fan Note Badge / Banner (optional)
  const trimmedNote = options?.customNote?.trim();

  if (trimmedNote) {
    const badgeY = 1404;
    const badgeH = 56;
    const maxBadgeW = cardW;

    ctx.save();
    ctx.font = '800 25px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';

    const displayNote = trimmedNote.startsWith('📣') ? trimmedNote : `📣  ${trimmedNote}`;

    let noteFontSize = 25;
    let textMetrics = ctx.measureText(displayNote);

    while (textMetrics.width > maxBadgeW - 60 && noteFontSize > 18) {
      noteFontSize -= 1;
      ctx.font = `800 ${noteFontSize}px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif`;
      textMetrics = ctx.measureText(displayNote);
    }

    const badgeW = Math.min(textMetrics.width + 56, maxBadgeW);
    const badgeX = (width - badgeW) / 2;

    ctx.shadowColor = theme === 'halloween' ? 'rgba(249, 115, 22, 0.4)' : 'rgba(245, 158, 11, 0.35)';
    ctx.shadowBlur = 18;
    drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 28);
    ctx.fillStyle = theme === 'halloween' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(245, 158, 11, 0.16)';
    ctx.fill();
    ctx.strokeStyle = theme === 'halloween' ? '#f97316' : '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(displayNote, 540, badgeY + badgeH / 2 + noteFontSize * 0.35);
    ctx.restore();
  }

  // 5. Instagram Link-Sticker Drop Zone
  const stickerBoxW = cardW;
  const stickerBoxH = trimmedNote ? 124 : 142;
  const stickerBoxX = cardX;
  const stickerBoxY = trimmedNote ? 1478 : 1420;

  ctx.save();
  ctx.beginPath();
  drawRoundedRect(ctx, stickerBoxX, stickerBoxY, stickerBoxW, stickerBoxH, 28);
  ctx.fillStyle = theme === 'halloween' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(10, 8, 6, 0.58)';
  ctx.fill();
  ctx.setLineDash([12, 10]);
  ctx.strokeStyle = theme === 'halloween' ? 'rgba(249, 115, 22, 0.55)' : 'rgba(245, 158, 11, 0.48)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);

  const stickerCallout = '[ HIER INSTAGRAM LINK-STICKER PLATZIEREN ]';
  ctx.font = '800 22px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.letterSpacing = '1.5px';
  const calloutW = ctx.measureText(stickerCallout).width;
  const calloutStartX = 540 - (calloutW + 42) / 2;

  drawLinkIcon(ctx, calloutStartX + 12, stickerBoxY + 44, '#fbbf24');
  ctx.textAlign = 'left';
  ctx.fillStyle = theme === 'halloween' ? '#fb923c' : '#fbbf24';
  ctx.fillText(stickerCallout, calloutStartX + 38, stickerBoxY + 52);

  const targetDomain = options?.origin
    ? options.origin.replace(/^https?:\/\//, '')
    : 'heimspielradar.app';

  const cleanUrl = `${targetDomain}/matches/${match.id}`;

  ctx.textAlign = 'center';
  ctx.font = '600 24px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#a1a1aa';
  ctx.letterSpacing = '0.5px';
  ctx.fillText(cleanUrl, 540, stickerBoxY + 96);
  ctx.restore();

  // 6. Bottom App Branding (Vector Basketball Badge + Two-Tone HEIMSPIELRADAR.APP)
  const brandingY = 1675;
  ctx.save();

  ctx.font = '700 40px "Oswald", "Bebas Neue", -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.letterSpacing = '3px';
  const brandMain = 'HEIMSPIELRADAR';
  const brandSuffix = '.APP';
  const mainW = ctx.measureText(brandMain).width + brandMain.length * 2.5;
  const suffixW = ctx.measureText(brandSuffix).width + brandSuffix.length * 2.5;
  const badgeRadius = 24;
  const totalBrandW = badgeRadius * 2 + 18 + mainW + suffixW;
  const brandStartX = 540 - totalBrandW / 2;

  drawBasketballBadge(ctx, brandStartX + badgeRadius, brandingY - 14, badgeRadius);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(brandMain, brandStartX + badgeRadius * 2 + 18, brandingY);

  ctx.fillStyle = '#fbbf24';
  ctx.fillText(brandSuffix, brandStartX + badgeRadius * 2 + 18 + mainW, brandingY);

  ctx.textAlign = 'center';
  ctx.font = '500 24px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#a1a1aa';
  ctx.letterSpacing = '0.5px';
  ctx.fillText('Finde Amateur-Basketball in deiner Nähe', 540, brandingY + 46);
  ctx.restore();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to generate image blob from canvas'));
      }
    }, 'image/png');
  });
}
