import type { Match } from '@sundayleague/shared-types';
import { formatDisplayDate, formatKickoffTime } from './date-utils';

export type StoryTheme = 'classic' | 'halloween';

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
}

/**
 * Helper to wrap text into multiple lines given a maxWidth on a 2D canvas context.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const testLine = `${currentLine} ${word}`;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
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
 * Draws the Matchday Ticket with side notches and perforation line.
 */
function drawMatchdayTicket(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  notchY: number,
  notchRadius: number,
  fillColor: string,
  strokeColor?: string
) {
  ctx.save();
  ctx.beginPath();

  // Top-left corner
  ctx.moveTo(x + radius, y);
  // Top edge
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);

  // Right edge down to notch
  ctx.lineTo(x + w, notchY - notchRadius);
  // Right semicircular notch (inward)
  ctx.arc(x + w, notchY, notchRadius, -Math.PI / 2, Math.PI / 2, true);
  // Right edge down to bottom
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);

  // Bottom edge
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);

  // Left edge up to notch
  ctx.lineTo(x, notchY + notchRadius);
  // Left semicircular notch (inward)
  ctx.arc(x, notchY, notchRadius, Math.PI / 2, -Math.PI / 2, true);
  // Left edge up to top
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);

  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();

  if (strokeColor) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
  }

  // Perforation dashed line across notchY
  ctx.beginPath();
  ctx.setLineDash([12, 10]);
  ctx.moveTo(x + notchRadius + 12, notchY);
  ctx.lineTo(x + w - notchRadius - 12, notchY);
  ctx.strokeStyle = strokeColor || 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]); // Reset line dash

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

  // 1. Background
  if (theme === 'halloween') {
    // Spooky dark purple to black gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);

    bgGrad.addColorStop(0, '#1a0826');
    bgGrad.addColorStop(0.5, '#0d0414');
    bgGrad.addColorStop(1, '#1b0d02');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Ambient Pumpkin Orange Glow top-right and purple bottom-left
    const glow1 = ctx.createRadialGradient(880, 260, 50, 880, 260, 600);

    glow1.addColorStop(0, 'rgba(249, 115, 22, 0.25)'); // Orange-500
    glow1.addColorStop(1, 'rgba(249, 115, 22, 0)');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, width, height);

    const glow2 = ctx.createRadialGradient(200, 1600, 50, 200, 1600, 600);

    glow2.addColorStop(0, 'rgba(168, 85, 247, 0.2)'); // Purple-500
    glow2.addColorStop(1, 'rgba(168, 85, 247, 0)');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, width, height);

    // Subtle Spooky Silhouettes (Bats)
    ctx.save();
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

    drawBat(160, 220, 1.2);
    drawBat(240, 170, 0.7);
    drawBat(920, 320, 1.0);
    drawBat(850, 390, 0.6);
    ctx.restore();
  } else {
    // Classic Court: Dark hardwood slate background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);

    bgGrad.addColorStop(0, '#0f172a'); // slate-900
    bgGrad.addColorStop(0.5, '#090d16');
    bgGrad.addColorStop(1, '#020617'); // slate-950
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Warm Basketball Amber glow in the center-top
    const courtGlow = ctx.createRadialGradient(540, 600, 100, 540, 600, 750);

    courtGlow.addColorStop(0, 'rgba(234, 88, 12, 0.18)'); // amber/orange glow
    courtGlow.addColorStop(1, 'rgba(234, 88, 12, 0)');
    ctx.fillStyle = courtGlow;
    ctx.fillRect(0, 0, width, height);

    // Subtle Basketball Court Line Markings
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 4;
    // Center circle
    ctx.beginPath();
    ctx.arc(540, 850, 280, 0, Math.PI * 2);
    ctx.stroke();
    // Center dividing line
    ctx.beginPath();
    ctx.moveTo(0, 850);
    ctx.lineTo(1080, 850);
    ctx.stroke();
    // 3-point key arc top & bottom
    ctx.beginPath();
    ctx.arc(540, 0, 420, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(540, 1920, 420, Math.PI, 0);
    ctx.stroke();
    ctx.restore();
  }

  // 2. Story Header / Category Eyebrow
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = theme === 'halloween' ? '#f97316' : '#f59e0b'; // orange-500 / amber-500
  ctx.letterSpacing = '6px';
  const headerIcon = theme === 'halloween' ? '🎃 MATCHDAY HALLOWEEN SPECIAL 🏀' : '🏀 GAMEDAY • HEIMSPIEL 🏀';

  ctx.fillText(headerIcon, 540, 220);
  ctx.restore();

  // 3. Center Ticket
  const ticketX = 80;
  const ticketY = 270;
  const ticketW = 920;
  const ticketH = 1180;
  const ticketRadius = 36;
  const notchY = ticketY + 230; // perforation below league banner
  const notchRadius = 32;

  const ticketBg = theme === 'halloween' ? '#181124' : '#141c2e';
  const ticketBorder = theme === 'halloween' ? 'rgba(249, 115, 22, 0.4)' : 'rgba(56, 189, 248, 0.25)';

  // Drop shadow behind ticket
  ctx.save();
  ctx.shadowColor = theme === 'halloween' ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 20;
  drawMatchdayTicket(
    ctx,
    ticketX,
    ticketY,
    ticketW,
    ticketH,
    ticketRadius,
    notchY,
    notchRadius,
    ticketBg,
    ticketBorder
  );
  ctx.restore();

  // Inside Ticket Content:
  // --- Section 1: Header (above notch) ---
  ctx.save();
  ctx.textAlign = 'center';

  // League badge
  const leagueName = match.league?.name || 'Amateur Basketball';

  ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(leagueName.toUpperCase(), 540, ticketY + 90);

  // Spieltag / Gender info
  const details: string[] = [];

  if (match.round) {
    details.push(`SPIELTAG ${match.round}`);
  }

  if (match.league?.gender) {
    const gender = match.league.gender;

    const label =
      gender === 'm'
        ? 'HERREN'
        : gender === 'w'
        ? 'DAMEN'
        : gender === 'mix'
        ? 'MIXED'
        : gender.toUpperCase();

    details.push(label);
  }

  if (match.league?.ageClass) {
    details.push(match.league.ageClass.toUpperCase());
  }

  const subHeader = details.length > 0 ? details.join(' • ') : 'OFFIZIELLES LIGASPIEL';

  ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = theme === 'halloween' ? '#fb923c' : '#38bdf8'; // orange-400 / sky-400
  ctx.fillText(subHeader, 540, ticketY + 145);
  ctx.restore();

  // --- Section 2: Match Teams (Below notch) ---
  const homeSplit = splitTeamName(match.homeTeam.name);
  const guestSplit = splitTeamName(match.guestTeam.name);

  // Home Team Label & Name
  let currentY = ticketY + 310;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '700 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText('HEIMTEAM', 540, currentY);

  currentY += 55;
  ctx.font = '900 52px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#ffffff';
  const homeLines = wrapText(ctx, homeSplit.base, ticketW - 140);

  for (const line of homeLines) {
    ctx.fillText(line, 540, currentY);
    currentY += 60;
  }

  if (homeSplit.suffix) {
    ctx.font = '800 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = theme === 'halloween' ? '#f97316' : '#f59e0b';
    ctx.fillText(homeSplit.suffix, 540, currentY);
    currentY += 45;
  }

  // VS Badge
  currentY += 20;
  ctx.beginPath();
  ctx.arc(540, currentY, 36, 0, Math.PI * 2);
  ctx.fillStyle = theme === 'halloween' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(255, 255, 255, 0.1)';
  ctx.fill();
  ctx.strokeStyle = theme === 'halloween' ? '#f97316' : 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = 'italic 900 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = theme === 'halloween' ? '#f97316' : '#ffffff';
  ctx.fillText('VS', 540, currentY + 10);

  // Guest Team
  currentY += 65;
  ctx.font = '700 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText('GASTTEAM', 540, currentY);

  currentY += 55;
  ctx.font = '900 52px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#ffffff';
  const guestLines = wrapText(ctx, guestSplit.base, ticketW - 140);

  for (const line of guestLines) {
    ctx.fillText(line, 540, currentY);
    currentY += 60;
  }

  if (guestSplit.suffix) {
    ctx.font = '800 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = theme === 'halloween' ? '#f97316' : '#f59e0b';
    ctx.fillText(guestSplit.suffix, 540, currentY);
    currentY += 45;
  }

  ctx.restore();

  // --- Section 3: Match Kickoff Box ---
  const kickoffBoxY = ticketY + ticketH - 300;
  const boxW = ticketW - 100;
  const boxH = 110;
  const boxX = ticketX + 50;

  ctx.save();
  drawRoundedRect(ctx, boxX, kickoffBoxY, boxW, boxH, 20);
  ctx.fillStyle = theme === 'halloween' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(56, 189, 248, 0.12)';
  ctx.fill();
  ctx.strokeStyle = theme === 'halloween' ? 'rgba(249, 115, 22, 0.4)' : 'rgba(56, 189, 248, 0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Kickoff date & time
  const dateFormatted = formatDisplayDate(match.kickoffDate).toUpperCase();
  const timeFormatted = formatKickoffTime(match.kickoffTime);
  const kickoffStr = `⏰ ${dateFormatted} • ${timeFormatted} UHR`;

  ctx.textAlign = 'center';
  ctx.font = '800 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = theme === 'halloween' ? '#fed7aa' : '#ffffff';
  ctx.fillText(kickoffStr, 540, kickoffBoxY + 68);
  ctx.restore();

  // --- Section 4: Venue Info (Bottom of ticket) ---
  ctx.save();
  ctx.textAlign = 'center';
  const venueY = kickoffBoxY + 155;

  ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#f1f5f9';
  const venueTitle = `📍 ${match.venue?.name || 'Sporthalle'}`;

  ctx.fillText(venueTitle, 540, venueY);

  const addressParts = [match.venue?.street, `${match.venue?.postalCode || ''} ${match.venue?.city || ''}`.trim()].filter(Boolean);
  const addressStr = addressParts.length > 0 ? addressParts.join(', ') : 'Adresse siehe App';

  ctx.font = '500 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.fillText(addressStr, 540, venueY + 40);
  ctx.restore();

  // 4. Bottom Branding & Instagram Sticker Tip
  const brandingY = 1530;

  ctx.save();
  ctx.textAlign = 'center';

  // App Logo & URL
  ctx.font = '900 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('🏀 heimspielradar.app', 540, brandingY);

  // Subtitle
  ctx.font = '500 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText('Alle Amateur-Basketball Heimspiele in deiner Nähe', 540, brandingY + 46);

  // Instagram Story Link-Sticker Guide Box
  const tipBoxW = 860;
  const tipBoxH = 140;
  const tipBoxX = (width - tipBoxW) / 2;
  const tipBoxY = brandingY + 95;

  drawRoundedRect(ctx, tipBoxX, tipBoxY, tipBoxW, tipBoxH, 24);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = theme === 'halloween' ? '#fb923c' : '#38bdf8';
  ctx.fillText('📲 TIPP FÜR DEINE INSTAGRAM STORY', 540, tipBoxY + 48);

  const targetUrl = options?.origin ? `${options.origin}/matches/${match.id}` : `heimspielradar.app/matches/${match.id}`;

  ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`Link-Sticker einfügen: ${targetUrl.replace(/^https?:\/\//, '')}`, 540, tipBoxY + 96);

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
