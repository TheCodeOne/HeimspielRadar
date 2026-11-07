import * as path from 'node:path';
import { expect, test } from '@playwright/test';

const MOCK_LEAGUES = [
  {
    id: 1,
    dbbId: 50001,
    name: 'Oberliga Württemberg Herren',
    skName: 'Oberliga',
    akName: 'Senioren',
    geschlecht: 'männlich',
  },
];

const MOCK_MATCHES = [
  {
    id: 2001,
    leagueId: 1,
    league: MOCK_LEAGUES[0],
    matchDay: 4,
    kickoffDate: '2099-10-25',
    kickoffTime: '16:00',
    homeTeam: { id: 10, dbbId: 1010, name: 'MTV Stuttgart 1843' },
    guestTeam: { id: 11, dbbId: 1011, name: 'BBC Stuttgart' },
    venue: {
      id: 601,
      name: 'Rundsporthalle Ludwigsburg',
      street: 'Kurfürstenstraße 9',
      postalCode: '71636',
      city: 'Ludwigsburg',
      latitude: 48.8974,
      longitude: 9.1919,
    },
    result: null,
    confirmed: true,
    isFeatured: false,
    distanceKm: 1.8,
  },
  {
    id: 2002,
    leagueId: 1,
    league: MOCK_LEAGUES[0],
    matchDay: 4,
    kickoffDate: '2099-10-25',
    kickoffTime: '20:15',
    homeTeam: { id: 12, dbbId: 1012, name: 'SV Möhringen 1' },
    guestTeam: { id: 13, dbbId: 1013, name: 'TSG Schwäbisch Hall 1' },
    venue: {
      id: 602,
      name: 'Remigiussporthalle',
      street: 'Hechinger Straße 115',
      postalCode: '70567',
      city: 'Stuttgart-Möhringen',
      latitude: 48.7233,
      longitude: 9.1483,
      kioskDescription: 'Hallenkaffee, frische Waffeln, Brezeln & Kaltgetränke',
    },
    result: null,
    confirmed: true,
    isFeatured: true,
    admissionFee: 'Eintritt frei',
    matchNotes: 'Spitzenspiel der Oberliga Württemberg',
    distanceKm: 6.4,
  },
  {
    id: 2003,
    leagueId: 1,
    league: MOCK_LEAGUES[0],
    matchDay: 4,
    kickoffDate: '2099-10-25',
    kickoffTime: '18:30',
    homeTeam: { id: 14, dbbId: 1014, name: 'TV Cannstatt 1' },
    guestTeam: { id: 15, dbbId: 1015, name: 'SV Fellbach 2' },
    venue: {
      id: 603,
      name: 'Murkenbachhalle Böblingen',
      street: 'Schönaicher Straße 75',
      postalCode: '71032',
      city: 'Böblingen',
      latitude: 48.6721,
      longitude: 9.0117,
    },
    result: null,
    confirmed: true,
    isFeatured: false,
    distanceKm: 3.9,
  },
];

test.describe('Issue #104: Featured Match Golden Map Marker (4 Engines) & Pinned List Badge', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          lastSyncedAt: '2026-11-03T12:00:00.000Z',
        }),
      });
    });

    await page.route('**/api/leagues', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_LEAGUES),
      });
    });

    await page.route('**/api/matches*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_MATCHES),
      });
    });

    await page.route('**/*.png', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64',
        ),
      });
    });

    await page.route('**/tiles.openfreemap.org/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          version: 8,
          sources: {},
          layers: [],
        }),
      });
    });
  });

  test('1. Renders golden Featured Match pin with glow, star badge, and higher z-index on MapLibre GL', async ({
    page,
  }, testInfo) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'heimspielradar:filters:v1',
        JSON.stringify({
          viewMode: 'map',
          onlyUpcoming: false,
          dateMode: 'all',
        }),
      );
    });

    await page.goto('/');

    const featuredPin = page.locator('.featured-venue-marker[data-featured="true"]').first();
    await expect(featuredPin).toBeVisible({ timeout: 10000 });

    // Golden SVG path (#f59e0b), pulsing glow ring, and star icon
    await expect(featuredPin.locator('svg path[fill="#f59e0b"]')).toBeVisible();
    await expect(featuredPin.locator('.featured-pin-glow')).toBeAttached();
    await expect(featuredPin.locator('.featured-pin-star')).toHaveText('⭐');

    // Verify higher z-index on featured marker than normal marker
    const zIndexComparison = await page.evaluate(() => {
      const featuredEl = document.querySelector('.featured-venue-marker[data-featured="true"]');
      const normalSvg = document.querySelector('svg circle[fill="#f97316"]');
      const normalEl = normalSvg?.closest('div');

      if (!featuredEl || !normalEl) {
        return { featuredZ: 0, normalZ: 0 };
      }

      const featuredZ = Number.parseInt(window.getComputedStyle(featuredEl).zIndex, 10) || 0;
      const normalZ = Number.parseInt(window.getComputedStyle(normalEl).zIndex, 10) || 0;

      return { featuredZ, normalZ };
    });

    expect(zIndexComparison.featuredZ).toBeGreaterThan(zIndexComparison.normalZ);

    const isMobile = testInfo.project.name.includes('mobile');

    const mapScreenshotPath = path.resolve(
      'test-results',
      isMobile ? 'verify-mobile-chromium.png' : 'verify-desktop-chromium.png',
    );

    await page.waitForTimeout(400);
    await page.screenshot({ path: mapScreenshotPath, fullPage: true });
  });

  test('2. Match-Liste pins Featured Match at the top with Amber Star-Badge and Kiosk Teaser while preserving order of remaining matches', async ({
    page,
  }, testInfo) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'heimspielradar:filters:v1',
        JSON.stringify({
          viewMode: 'list',
          onlyUpcoming: false,
          dateMode: 'all',
        }),
      );
    });

    await page.goto('/');

    const matchCards = page.locator('[data-match-id]');
    await expect(matchCards).toHaveCount(3);

    // Featured match 2002 (6.4 km) is pinned at index 0 ahead of closer normal matches 2001 (1.8 km) and 2003 (3.9 km)
    await expect(matchCards.nth(0)).toHaveAttribute('data-match-id', '2002');
    await expect(matchCards.nth(0)).toHaveAttribute('data-featured', 'true');
    await expect(matchCards.nth(1)).toHaveAttribute('data-match-id', '2001');
    await expect(matchCards.nth(2)).toHaveAttribute('data-match-id', '2003');

    // Verify Star-Badge and Kiosk information on the Featured Match card
    const featuredCard = matchCards.nth(0);
    const featuredBadge = featuredCard.getByTestId('featured-match-badge');
    await expect(featuredBadge).toBeVisible();
    await expect(featuredBadge).toContainText('⭐');
    await expect(featuredBadge).toContainText('Topspiel');

    // Clicking the Topspiel badge opens the TopMatchInfoModal
    await featuredBadge.click();
    const modal = page.getByTestId('top-match-info-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Topspiel des Tages');
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    const kioskInfo = featuredCard.locator('[data-tile="kiosk-info"], [data-testid="match-kiosk-teaser"]');
    await expect(kioskInfo).toBeVisible();
    await expect(kioskInfo).toContainText(
      'Hallenkaffee, frische Waffeln, Brezeln & Kaltgetränke',
    );

    const isMobile = testInfo.project.name.includes('mobile');

    const listScreenshotPath = path.resolve(
      'test-results',
      isMobile ? 'featured-list-mobile-chromium.png' : 'featured-list-desktop-chromium.png',
    );

    await page.screenshot({ path: listScreenshotPath, fullPage: true });
  });

  test('3. Match-Detail /matches/:id displays Topspiel Badge in Ticket Header and opens TopMatchInfoModal on click', async ({
    page,
  }) => {
    await page.route('**/api/matches/2002', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_MATCHES[1]),
      });
    });

    await page.goto('/matches/2002');

    // Ticket container has data-featured="true"
    const ticketContainer = page.getByTestId('match-detail-ticket');
    await expect(ticketContainer).toBeVisible();
    await expect(ticketContainer).toHaveAttribute('data-featured', 'true');

    // Topspiel badge in ticket header stub
    const featuredBadge = ticketContainer.getByTestId('featured-match-badge');
    await expect(featuredBadge).toBeVisible();
    await expect(featuredBadge).toContainText('⭐');
    await expect(featuredBadge).toContainText('Topspiel');

    // Clicking the Topspiel badge opens the TopMatchInfoModal
    await featuredBadge.click();

    const topMatchModal = page.getByTestId('top-match-info-modal');
    await expect(topMatchModal).toBeVisible();
    await expect(topMatchModal).toContainText('Topspiel des Tages');

    // Close modal via Escape
    await page.keyboard.press('Escape');
    await expect(topMatchModal).not.toBeVisible();
  });
});
