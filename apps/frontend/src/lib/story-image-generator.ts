import type { Match } from '@sundayleague/shared-types';
import { formatDisplayDate, formatKickoffTime } from './date-utils';

export type StoryTheme = 'classic' | 'halloween';

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
  if (theme === 'classic' || theme === 'halloween') {
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

  // If timeStr already ends with 'Uhr' or 'UHR', normalize it to single uppercase 'UHR'
  let timeStr = rawTimeStr;

  if (/uhr$/i.test(timeStr.trim())) {
    timeStr = timeStr.trim().replace(/uhr$/i, 'UHR');
  } else if (timeStr !== 'Uhrzeit offen') {
    timeStr = `${timeStr} UHR`;
  } else {
    timeStr = 'UHRZEIT OFFEN';
  }

  if (dateStr === 'ALLE TERMINE' || dateStr === 'TERMIN OFFEN') {
    return `${dateStr} • ${timeStr}`;
  }

  return `${dateStr} • ${timeStr}`;
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
 * Draws an authentic basketball hardwood parquet floor texture:
 * - Staggered horizontal planks with subtle tonal variations (honey oak / maple / midnight dark wood)
 * - Subtle woodgrain lines on planks
 * - Painted court areas (keys / free-throw lanes)
 * - Authentic FIBA/NBA court geometry (center circle, center line, 3pt arc, key, free-throw circle & hashes)
 * - Overhead arena spotlight & vignette
 */
function drawHardwoodFloor(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: StoryTheme
) {
  ctx.save();

  // 1. Base Plank Grid Setup
  // Plank height ~28px -> ~68 rows across 1920px height
  const plankHeight = 28;
  const numRows = Math.ceil(height / plankHeight);

  // Palettes for planks
  // Classic: Rich honey maple, warm oak, amber tones
  const classicColors = [
    '#c88a42',
    '#bd7f37',
    '#d4964e',
    '#b4752e',
    '#c2843c',
    '#cf9047',
    '#ba7933',
    '#c7883f',
  ];

  // Halloween: Deep midnight dark timber, espresso, charred oak
  const halloweenColors = [
    '#1c1328',
    '#170e22',
    '#221730',
    '#140c1e',
    '#1f142b',
    '#261937',
    '#191024',
    '#2a1c3d',
  ];

  const colors = theme === 'halloween' ? halloweenColors : classicColors;

  // Pseudo-random deterministic hash for consistent plank layout & woodgrain
  const pseudoRandom = (seed: number) => {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;

    return x - Math.floor(x);
  };

  // Draw hardwood planks row by row
  for (let r = 0; r < numRows; r++) {
    const y = r * plankHeight;
    // Standard plank lengths vary between 220px and 380px, with staggered offset per row
    const rowOffset = (r * 137) % 320;
    let x = -rowOffset;
    let plankIdx = 0;

    while (x < width) {
      // Deterministic plank width
      const randVal = pseudoRandom(r * 100 + plankIdx);
      const plankWidth = 240 + Math.floor(randVal * 160); // 240px - 400px

      // Plank color variation
      const colorIdx = Math.floor(pseudoRandom(r * 31 + plankIdx * 17) * colors.length);
      ctx.fillStyle = colors[colorIdx];
      ctx.fillRect(Math.max(0, x), y, Math.min(width - x, plankWidth), plankHeight);

      // Subtle plank woodgrain lines (1-2 very fine streaks per plank)
      const grainRand = pseudoRandom(r * 50 + plankIdx * 13);

      if (grainRand > 0.3) {
        ctx.strokeStyle =
          theme === 'halloween'
            ? 'rgba(255, 255, 255, 0.025)'
            : 'rgba(255, 255, 255, 0.07)';
        ctx.lineWidth = 1;
        const grainY = y + 8 + Math.floor(grainRand * 12);
        ctx.beginPath();
        ctx.moveTo(Math.max(0, x), grainY);
        ctx.lineTo(Math.min(width, x + plankWidth), grainY);
        ctx.stroke();
      }

      // Vertical joint seam between planks
      ctx.strokeStyle =
        theme === 'halloween'
          ? 'rgba(0, 0, 0, 0.65)'
          : 'rgba(75, 45, 15, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + plankWidth, y);
      ctx.lineTo(x + plankWidth, y + plankHeight);
      ctx.stroke();

      x += plankWidth;
      plankIdx++;
    }

    // Horizontal groove seam between plank rows
    ctx.strokeStyle =
      theme === 'halloween'
        ? 'rgba(0, 0, 0, 0.5)'
        : 'rgba(70, 40, 10, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + plankHeight);
    ctx.lineTo(width, y + plankHeight);
    ctx.stroke();
  }

  // 2. Painted Key / Free-Throw Lane (Stained wood accent paint)
  // Top key and Bottom key
  // Standard FIBA key width is 4.9m, at this canvas scale ~340px wide
  const keyWidth = 340;
  const keyHeight = 440;
  const keyX = (width - keyWidth) / 2;

  // Stained Key Paint Area
  ctx.fillStyle =
    theme === 'halloween'
      ? 'rgba(234, 88, 12, 0.22)' // Pumpkin tinted lane
      : 'rgba(180, 83, 9, 0.35)'; // Rich mahogany/amber stained lane

  // Top Key (Home lane)
  ctx.fillRect(keyX, 0, keyWidth, keyHeight);
  // Bottom Key (Guest lane)
  ctx.fillRect(keyX, height - keyHeight, keyWidth, keyHeight);

  // 3. Crisp Basketball Court Markings (High contrast court enamel paint)
  const courtLineColor =
    theme === 'halloween'
      ? 'rgba(255, 237, 213, 0.65)' // Warm parchment cream
      : 'rgba(255, 255, 255, 0.7)'; // Bright crisp court white

  const courtLineGlow =
    theme === 'halloween'
      ? 'rgba(249, 115, 22, 0.3)'
      : 'rgba(255, 255, 255, 0.2)';

  ctx.strokeStyle = courtLineColor;
  ctx.lineWidth = 5;
  ctx.shadowColor = courtLineGlow;
  ctx.shadowBlur = 4;

  // A. Center Court Line & Center Circle
  const centerY = height / 2; // 960px
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.stroke();

  // Center outer jump circle (radius 180px)
  ctx.beginPath();
  ctx.arc(width / 2, centerY, 180, 0, Math.PI * 2);
  ctx.stroke();

  // Center inner jump circle (radius 60px)
  ctx.beginPath();
  ctx.arc(width / 2, centerY, 60, 0, Math.PI * 2);
  ctx.stroke();

  // B. Top Key Lines & Free-Throw Circle
  // Key boundary box
  ctx.beginPath();
  ctx.rect(keyX, 0, keyWidth, keyHeight);
  ctx.stroke();

  // Free throw circle top (solid bottom half, dashed top half)
  ctx.beginPath();
  ctx.arc(width / 2, keyHeight, 170, 0, Math.PI);
  ctx.stroke();

  ctx.setLineDash([16, 12]);
  ctx.beginPath();
  ctx.arc(width / 2, keyHeight, 170, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Top Key hash marks (rebound markers)
  const hashLength = 20;
  [120, 200, 280, 360].forEach((hashY) => {
    // Left hash
    ctx.beginPath();
    ctx.moveTo(keyX - hashLength, hashY);
    ctx.lineTo(keyX, hashY);
    ctx.stroke();
    // Right hash
    ctx.beginPath();
    ctx.moveTo(keyX + keyWidth, hashY);
    ctx.lineTo(keyX + keyWidth + hashLength, hashY);
    ctx.stroke();
  });

  // Top 3-Point Line Arc (radius ~480px from basket baseline at y=0)
  ctx.beginPath();
  ctx.arc(width / 2, 0, 490, 0.22 * Math.PI, 0.78 * Math.PI);
  ctx.stroke();

  // C. Bottom Key Lines & Free-Throw Circle
  const bottomKeyY = height - keyHeight;
  ctx.beginPath();
  ctx.rect(keyX, bottomKeyY, keyWidth, keyHeight);
  ctx.stroke();

  // Free throw circle bottom (solid top half, dashed bottom half)
  ctx.beginPath();
  ctx.arc(width / 2, bottomKeyY, 170, Math.PI, Math.PI * 2);
  ctx.stroke();

  ctx.setLineDash([16, 12]);
  ctx.beginPath();
  ctx.arc(width / 2, bottomKeyY, 170, 0, Math.PI);
  ctx.stroke();
  ctx.setLineDash([]);

  // Bottom Key hash marks
  [120, 200, 280, 360].forEach((offsetY) => {
    const hashY = height - offsetY;
    // Left hash
    ctx.beginPath();
    ctx.moveTo(keyX - hashLength, hashY);
    ctx.lineTo(keyX, hashY);
    ctx.stroke();
    // Right hash
    ctx.beginPath();
    ctx.moveTo(keyX + keyWidth, hashY);
    ctx.lineTo(keyX + keyWidth + hashLength, hashY);
    ctx.stroke();
  });

  // Bottom 3-Point Line Arc (radius ~490px from bottom baseline)
  ctx.beginPath();
  ctx.arc(width / 2, height, 490, 1.22 * Math.PI, 1.78 * Math.PI);
  ctx.stroke();

  ctx.shadowBlur = 0; // reset shadow

  // 4. Overhead Arena Spotlight & Stadium Vignette
  // This blends the realistic hardwood floor into an epic arena setting, keeping contrast
  // high so text and cards remain punchy and clear.
  if (theme === 'halloween') {
    // Eerie Pumpkin & Purple Arena Spotlight
    const spotlight = ctx.createRadialGradient(
      width / 2,
      centerY - 100,
      100,
      width / 2,
      centerY,
      850
    );

    spotlight.addColorStop(0, 'rgba(249, 115, 22, 0.28)'); // warm amber center beam
    spotlight.addColorStop(0.4, 'rgba(147, 51, 234, 0.35)'); // rich eerie violet
    spotlight.addColorStop(0.75, 'rgba(15, 7, 26, 0.75)'); // dark outer fade
    spotlight.addColorStop(1, 'rgba(8, 3, 14, 0.94)'); // deep edge vignette
    ctx.fillStyle = spotlight;
    ctx.fillRect(0, 0, width, height);

    // Subtle atmospheric bats
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';

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
  } else {
    // Classic Arena Spotlight & Vignette
    const arenaLight = ctx.createRadialGradient(
      width / 2,
      centerY - 80,
      120,
      width / 2,
      centerY,
      800
    );

    arenaLight.addColorStop(0, 'rgba(255, 255, 255, 0.15)'); // overhead beam
    arenaLight.addColorStop(0.35, 'rgba(245, 158, 11, 0.1)'); // warm court amber
    arenaLight.addColorStop(0.65, 'rgba(12, 18, 30, 0.65)'); // midnight stadium gradient
    arenaLight.addColorStop(0.9, 'rgba(6, 10, 18, 0.88)'); // deep dark vignette
    arenaLight.addColorStop(1, 'rgba(2, 4, 8, 0.95)'); // edge frame
    ctx.fillStyle = arenaLight;
    ctx.fillRect(0, 0, width, height);

    // Warm court gloss reflection across upper half
    const courtGloss = ctx.createLinearGradient(0, 300, 0, 1100);
    courtGloss.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
    courtGloss.addColorStop(0.5, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = courtGloss;
    ctx.fillRect(0, 300, width, 800);
  }

  ctx.restore();
}

/**
 * Draws a team block with smart font-scaling so team names and suffixes stay balanced,
 * never isolating single digits on their own line.
 */
function drawTeamBlock(
  ctx: CanvasRenderingContext2D,
  teamName: string,
  roleLabel: string,
  centerY: number,
  accentColor: string,
  maxWidth: number
) {
  const trimmed = teamName.trim();
  const split = splitTeamName(trimmed);

  ctx.save();
  ctx.textAlign = 'center';

  // Role pill / label (e.g. "HEIMTEAM" or "GASTTEAM")
  ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.letterSpacing = '4px';
  ctx.fillText(roleLabel, 540, centerY - 65);

  // Check if base + suffix fits comfortably on 1 line
  const fullText = split.suffix ? `${split.base} ${split.suffix}` : split.base;

  // Start with 62px font size and scale down until it fits maxWidth or hits minimum
  let fontSize = 62;
  ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  let textWidth = ctx.measureText(fullText).width;

  while (textWidth > maxWidth && fontSize > 42) {
    fontSize -= 2;
    ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    textWidth = ctx.measureText(fullText).width;
  }

  if (textWidth <= maxWidth) {
    // Fits on 1 line!
    if (split.suffix) {
      // Draw base in white and suffix in accent color, or full text
      const baseWidth = ctx.measureText(split.base + ' ').width;
      const suffixWidth = ctx.measureText(split.suffix).width;
      const totalW = baseWidth + suffixWidth;
      const startX = 540 - totalW / 2;

      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(split.base + ' ', startX, centerY);

      ctx.fillStyle = accentColor;
      ctx.fillText(split.suffix, startX + baseWidth, centerY);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillText(fullText, 540, centerY);
    }
  } else {
    // 2-line layout: split into words keeping suffix bound to the last word
    const words = split.base.split(/\s+/);
    let line1 = '';
    let line2 = '';

    if (words.length <= 2) {
      line1 = words[0];
      line2 = split.suffix ? `${words.slice(1).join(' ')} ${split.suffix}` : words.slice(1).join(' ');
    } else {
      const mid = Math.ceil(words.length / 2);
      line1 = words.slice(0, mid).join(' ');
      line2 = split.suffix ? `${words.slice(mid).join(' ')} ${split.suffix}` : words.slice(mid).join(' ');
    }

    // Auto-fit 2 lines
    let lineFontSize = 46;
    ctx.font = `900 ${lineFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

    while (
      (ctx.measureText(line1).width > maxWidth || ctx.measureText(line2).width > maxWidth) &&
      lineFontSize > 34
    ) {
      lineFontSize -= 2;
      ctx.font = `900 ${lineFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(line1, 540, centerY - 20);

    // If line2 has suffix, color suffix
    if (split.suffix && line2.endsWith(split.suffix)) {
      const prefix = line2.slice(0, -split.suffix.length).trimEnd();
      const prefixW = ctx.measureText(prefix + ' ').width;
      const sufW = ctx.measureText(split.suffix).width;
      const totalW = prefixW + sufW;
      const startX = 540 - totalW / 2;

      ctx.textAlign = 'left';
      ctx.fillText(prefix + ' ', startX, centerY + 34);
      ctx.fillStyle = accentColor;
      ctx.fillText(split.suffix, startX + prefixW, centerY + 34);
    } else {
      ctx.fillText(line2, 540, centerY + 34);
    }
  }

  ctx.restore();
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

  // 1. Authentic Basketball Hardwood Floor & Arena Atmosphere
  drawHardwoodFloor(ctx, width, height, theme);

  // 2. Top Header - Modern Sport Headline
  ctx.save();
  ctx.textAlign = 'center';

  const scoreData = parseMatchScore(match.result);
  const isFinished = Boolean(scoreData);

  // Eyebrow / Category badge
  const accentColor = theme === 'halloween' ? '#f97316' : '#f59e0b';
  const accentLight = theme === 'halloween' ? '#fdba74' : '#fde68a';

  const defaultCategoryText =
    theme === 'halloween' ? 'HALLOWEEN SPECIAL' : 'OFFIZIELLES LIGASPIEL';

  const categoryText = isFinished ? 'MATCH RESULT' : defaultCategoryText;

  ctx.font = '800 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = isFinished && theme !== 'halloween' ? '#38bdf8' : accentColor;
  ctx.letterSpacing = '8px';
  ctx.fillText(categoryText, 540, 180);

  // Main bold GAMEDAY / FINAL SCORE headline
  const headline = isFinished ? 'FINAL SCORE' : 'GAMEDAY';
  ctx.font = '900 102px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.letterSpacing = '6px';
  ctx.shadowColor =
    theme === 'halloween'
      ? 'rgba(249, 115, 22, 0.5)'
      : isFinished
      ? 'rgba(56, 189, 248, 0.45)'
      : 'rgba(245, 158, 11, 0.4)';
  ctx.shadowBlur = 30;
  ctx.fillText(headline, 540, 275);
  ctx.restore();

  // League badge pill
  const leagueName = match.league?.name || 'Amateur Basketball';
  ctx.save();
  ctx.font = '700 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const leagueMetrics = ctx.measureText(leagueName.toUpperCase());
  const pillPadding = 36;
  const pillW = Math.min(leagueMetrics.width + pillPadding * 2, 880);
  const pillH = 48;
  const pillX = (width - pillW) / 2;
  const pillY = 310;

  drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 24);
  ctx.fillStyle = theme === 'halloween' ? 'rgba(249, 115, 22, 0.16)' : 'rgba(255, 255, 255, 0.08)';
  ctx.fill();
  ctx.strokeStyle = theme === 'halloween' ? 'rgba(249, 115, 22, 0.45)' : 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = accentLight;
  ctx.fillText(leagueName.toUpperCase(), 540, pillY + 33);
  ctx.restore();

  // 3. Central Matchup Card (Glassmorphism Dark Panel)
  const cardX = 64;
  const cardY = 390;
  const cardW = width - cardX * 2; // 952px
  const cardH = 800;
  const cardRadius = 36;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 24;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.fillStyle = theme === 'halloween' ? 'rgba(22, 12, 34, 0.88)' : 'rgba(15, 23, 42, 0.88)';
  ctx.fill();
  ctx.strokeStyle = theme === 'halloween' ? 'rgba(249, 115, 22, 0.35)' : 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Matchup Content inside Central Card
  const innerMaxW = cardW - 80;

  // Winner accent colors
  const homeIsWinner = scoreData?.winner === 'home';
  const guestIsWinner = scoreData?.winner === 'guest';
  const winnerColor = '#10b981'; // Emerald 500

  // Home Team (Top of card)
  drawTeamBlock(
    ctx,
    match.homeTeam.name,
    homeIsWinner ? '🏆 HEIMTEAM • SIEGER' : 'HEIMTEAM',
    cardY + 160,
    homeIsWinner ? winnerColor : accentColor,
    innerMaxW
  );

  // Central Element: Final Score Badge or VS Badge
  const centerBadgeY = cardY + 395;

  if (isFinished && scoreData) {
    // Massive, glowing final score badge [ 78 : 72 ]
    ctx.save();

    // Score glow aura
    const scoreGlow = ctx.createRadialGradient(
      540,
      centerBadgeY,
      30,
      540,
      centerBadgeY,
      220
    );

    scoreGlow.addColorStop(
      0,
      theme === 'halloween'
        ? 'rgba(249, 115, 22, 0.45)'
        : 'rgba(16, 185, 129, 0.35)'
    );
    scoreGlow.addColorStop(0.6, 'rgba(56, 189, 248, 0.12)');
    scoreGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = scoreGlow;
    ctx.fillRect(240, centerBadgeY - 140, 600, 280);

    // Score banner capsule
    const scoreBoxW = 440;
    const scoreBoxH = 100;
    const scoreBoxX = (width - scoreBoxW) / 2;
    const scoreBoxY = centerBadgeY - scoreBoxH / 2;

    drawRoundedRect(ctx, scoreBoxX, scoreBoxY, scoreBoxW, scoreBoxH, 28);
    ctx.fillStyle = theme === 'halloween' ? 'rgba(31, 14, 47, 0.95)' : 'rgba(11, 17, 30, 0.95)';
    ctx.fill();
    ctx.strokeStyle =
      theme === 'halloween'
        ? '#f97316'
        : scoreData.winner === 'tie'
        ? '#f59e0b'
        : '#10b981';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Render Home Score, Colon, Guest Score with winner highlighting
    const homeScoreText = `${scoreData.home}`;
    const colonText = ':';
    const guestScoreText = `${scoreData.guest}`;

    ctx.font = '900 68px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textBaseline = 'middle';

    // Left score (home)
    ctx.textAlign = 'right';
    ctx.fillStyle = homeIsWinner ? '#34d399' : '#ffffff';
    ctx.fillText(homeScoreText, 540 - 32, centerBadgeY);

    // Center colon
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillText(colonText, 540, centerBadgeY - 2);

    // Right score (guest)
    ctx.textAlign = 'left';
    ctx.fillStyle = guestIsWinner ? '#34d399' : '#ffffff';
    ctx.fillText(guestScoreText, 540 + 32, centerBadgeY);

    ctx.textBaseline = 'alphabetic'; // reset
    ctx.restore();
  } else {
    // VS Badge (Center of card)
    ctx.save();
    // Ambient glow behind VS badge
    const vsGlow = ctx.createRadialGradient(540, centerBadgeY, 15, 540, centerBadgeY, 90);
    vsGlow.addColorStop(0, theme === 'halloween' ? 'rgba(249, 115, 22, 0.35)' : 'rgba(245, 158, 11, 0.3)');
    vsGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = vsGlow;
    ctx.fillRect(440, centerBadgeY - 100, 200, 200);

    // VS Circle
    ctx.beginPath();
    ctx.arc(540, centerBadgeY, 44, 0, Math.PI * 2);
    ctx.fillStyle = theme === 'halloween' ? '#1f0e2f' : '#0b111e';
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = 'italic 900 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('VS', 540, centerBadgeY + 11);
    ctx.restore();
  }

  // Guest Team (Bottom of card)
  drawTeamBlock(
    ctx,
    match.guestTeam.name,
    guestIsWinner ? '🏆 GASTTEAM • SIEGER' : 'GASTTEAM',
    cardY + 630,
    guestIsWinner ? winnerColor : accentColor,
    innerMaxW
  );

  // 4. Kickoff & Venue Info Card
  const infoY = 1215;
  const infoW = cardW;
  const infoH = 190;
  const infoX = cardX;

  ctx.save();
  drawRoundedRect(ctx, infoX, infoY, infoW, infoH, 28);
  ctx.fillStyle = theme === 'halloween' ? 'rgba(249, 115, 22, 0.12)' : 'rgba(56, 189, 248, 0.08)';
  ctx.fill();
  ctx.strokeStyle = theme === 'halloween' ? 'rgba(249, 115, 22, 0.35)' : 'rgba(56, 189, 248, 0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Kickoff Date & Time Bar / Final Score Info
  ctx.textAlign = 'center';
  const kickoffStr = formatGamedayDateTime(match.kickoffDate, match.kickoffTime);
  const dateOnlyStr = formatDisplayDate(match.kickoffDate).toUpperCase();

  const infoHeaderStr = isFinished
    ? `🏁  ENDERGEBNIS • ${dateOnlyStr}`
    : `⏰  ${kickoffStr}`;

  ctx.font = '800 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(infoHeaderStr, 540, infoY + 64);

  // Venue & City (Bold venue, subtle city/address)
  const venueTitle = match.venue?.name || 'Sporthalle';
  const venueCity = match.venue?.city ? `📍 ${venueTitle} • ${match.venue.city}` : `📍 ${venueTitle}`;
  ctx.font = '700 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = accentLight;
  ctx.fillText(venueCity, 540, infoY + 120);

  if (match.venue?.street) {
    ctx.font = '500 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fillText(match.venue.street, 540, infoY + 158);
  }

  ctx.restore();

  // 4b. Custom Fan Note Badge / Banner (optional)
  const trimmedNote = options?.customNote?.trim();

  if (trimmedNote) {
    const badgeY = 1422;
    const badgeH = 58;
    const maxBadgeW = cardW;

    ctx.save();
    ctx.font = '800 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    
    // Add megaphone emoji if user didn't start with an emoji
    const displayNote = trimmedNote.startsWith('📣') ? trimmedNote : `📣  ${trimmedNote}`;
    
    // Auto-scale font if needed to fit comfortably within maxBadgeW
    let noteFontSize = 26;
    let textMetrics = ctx.measureText(displayNote);

    while (textMetrics.width > maxBadgeW - 60 && noteFontSize > 18) {
      noteFontSize -= 1;
      ctx.font = `800 ${noteFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      textMetrics = ctx.measureText(displayNote);
    }

    const badgeW = Math.min(textMetrics.width + 56, maxBadgeW);
    const badgeX = (width - badgeW) / 2;

    // Glowing badge pill
    ctx.shadowColor = theme === 'halloween' ? 'rgba(249, 115, 22, 0.4)' : 'rgba(245, 158, 11, 0.35)';
    ctx.shadowBlur = 18;
    drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 29);
    ctx.fillStyle = theme === 'halloween' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(245, 158, 11, 0.16)';
    ctx.fill();
    ctx.strokeStyle = theme === 'halloween' ? '#f97316' : '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(displayNote, 540, badgeY + badgeH / 2 + (noteFontSize * 0.35));
    ctx.restore();
  }

  // 5. Instagram Link-Sticker Drop Zone
  const stickerBoxW = cardW;
  const stickerBoxH = trimmedNote ? 128 : 150;
  const stickerBoxX = cardX;
  const stickerBoxY = trimmedNote ? 1496 : 1460;

  ctx.save();
  // Dashed sticker target border
  ctx.beginPath();
  drawRoundedRect(ctx, stickerBoxX, stickerBoxY, stickerBoxW, stickerBoxH, 24);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.fill();
  ctx.setLineDash([12, 10]);
  ctx.strokeStyle = theme === 'halloween' ? 'rgba(249, 115, 22, 0.6)' : 'rgba(56, 189, 248, 0.6)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.setLineDash([]); // clear dash

  // Sticker Callout Header
  ctx.textAlign = 'center';
  ctx.font = '800 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = theme === 'halloween' ? '#fb923c' : '#38bdf8';
  ctx.letterSpacing = '1px';
  ctx.fillText('[ 🔗 HIER INSTAGRAM LINK-STICKER PLATZIEREN ]', 540, stickerBoxY + 54);

  // Clean URL that never overflows 1080px
  const targetDomain = options?.origin
    ? options.origin.replace(/^https?:\/\//, '')
    : 'heimspielradar.app';

  const cleanUrl = `${targetDomain}/matches/${match.id}`;

  ctx.font = '600 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.letterSpacing = '0.5px';
  ctx.fillText(cleanUrl, 540, stickerBoxY + 104);
  ctx.restore();

  // 6. Bottom App Branding
  const brandingY = 1680;
  ctx.save();
  ctx.textAlign = 'center';

  ctx.font = '900 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.letterSpacing = '2px';
  ctx.fillText('🏀 HEIMSPIELRADAR.APP', 540, brandingY);

  ctx.font = '500 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.fillText('Finde Amateur-Basketball in deiner Nähe', 540, brandingY + 48);
  ctx.restore();

  // Convert canvas to PNG blob
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
