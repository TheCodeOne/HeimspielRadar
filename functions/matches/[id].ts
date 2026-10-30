import type { Match } from '@sundayleague/shared-types';

interface Env {
  BACKEND_URL: string;
}

interface MatchParams {
  id: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const onRequest: PagesFunction<Env, 'id', MatchParams> = async (context) => {
  const { request, env, params, next } = context;

  // 1. Load the original index.html via context.next()
  const response = await next();

  // SAFETY: Cloudflare Pages route parameter 'id' matches the [id].ts segment and is typed as string or string[]
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const matchId = parseInt(rawId ?? '', 10);

  if (Number.isNaN(matchId) || !env.BACKEND_URL) {
    return response;
  }

  const backendBaseUrl = env.BACKEND_URL.replace(/\/+$/, '');
  const apiUrl = `${backendBaseUrl}/api/matches/${matchId}`;

  try {
    const apiRes = await fetch(apiUrl, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!apiRes.ok) {
      return response;
    }

    // SAFETY: Backend /api/matches/:id returns validated domain Match object or 404
    const match = (await apiRes.json()) as Match;

    const home = match.homeTeam?.name || 'Heimteam';
    const guest = match.guestTeam?.name || 'Gastteam';
    const pageTitle = `${home} vs ${guest} – HeimspielRadar`;

    const kickoffParts: string[] = [];

    if (match.kickoffDate) {
      kickoffParts.push(match.kickoffDate);
    }

    if (match.kickoffTime && match.kickoffTime !== '00:00') {
      kickoffParts.push(`${match.kickoffTime} Uhr`);
    }

    const venueParts: string[] = [];

    if (match.venue?.name) {
      venueParts.push(match.venue.name);
    }

    if (match.venue?.city) {
      venueParts.push(match.venue.city);
    }

    const descriptionElements = [
      kickoffParts.length > 0 ? kickoffParts.join(', ') : 'Termin offen',
      venueParts.length > 0 ? venueParts.join(', ') : 'Halle offen',
      match.league?.name || 'Amateur-Basketball',
    ];

    const ogDescription = `🏀 Heimspiel: ${descriptionElements.join(' | ')}`;
    const pageUrl = request.url;

    // Use Cloudflare HTMLRewriter to inject / update OpenGraph tags
    return new HTMLRewriter()
      .on('title', {
        element(element) {
          element.setInnerContent(escapeHtml(pageTitle));
        },
      })
      .on('head', {
        element(element) {
          element.append(
            `\n    <meta property="og:type" content="website" />` +
              `\n    <meta property="og:title" content="${escapeHtml(pageTitle)}" />` +
              `\n    <meta property="og:description" content="${escapeHtml(ogDescription)}" />` +
              `\n    <meta property="og:url" content="${escapeHtml(pageUrl)}" />` +
              `\n    <meta property="og:site_name" content="HeimspielRadar" />` +
              `\n    <meta name="twitter:card" content="summary" />` +
              `\n    <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />` +
              `\n    <meta name="twitter:description" content="${escapeHtml(ogDescription)}" />\n  `,
            { html: true }
          );
        },
      })
      .transform(response);
  } catch {
    // If backend fetch or rewrite fails, safely fall back to original index.html
    return response;
  }
};
