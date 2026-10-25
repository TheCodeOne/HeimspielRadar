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
    id: 1001,
    leagueId: 1,
    league: MOCK_LEAGUES[0],
    matchDay: 4,
    kickoffDate: '2099-10-25',
    kickoffTime: '18:00',
    homeTeam: { id: 10, dbbId: 1010, name: 'MTV Stuttgart 1843' },
    guestTeam: { id: 11, dbbId: 1011, name: 'SV Möhringen' },
    venue: {
      id: 501,
      name: 'Sporthalle West',
      street: 'Bebelstraße 24',
      postalCode: '70193',
      city: 'Stuttgart',
      latitude: 48.7745,
      longitude: 9.1565,
    },
    result: null,
    confirmed: false,
    distanceKm: 2.1,
  },
  {
    id: 1002,
    leagueId: 1,
    league: MOCK_LEAGUES[0],
    matchDay: 4,
    kickoffDate: '2099-10-25',
    kickoffTime: '20:15',
    homeTeam: { id: 10, dbbId: 1010, name: 'MTV Stuttgart 2' },
    guestTeam: { id: 12, dbbId: 1012, name: 'VfL Waiblingen' },
    venue: {
      id: 501,
      name: 'Sporthalle West',
      street: 'Bebelstraße 24',
      postalCode: '70193',
      city: 'Stuttgart',
      latitude: 48.7745,
      longitude: 9.1565,
    },
    result: '84:79',
    confirmed: true,
    distanceKm: 2.1,
  },
  {
    id: 1003,
    leagueId: 1,
    league: MOCK_LEAGUES[0],
    matchDay: 4,
    kickoffDate: '2099-10-26',
    kickoffTime: '15:00',
    homeTeam: { id: 13, dbbId: 1013, name: 'TV Rottenburg' },
    guestTeam: { id: 14, dbbId: 1014, name: 'SG Tübingen' },
    venue: {
      id: 502,
      name: 'Volksbank Arena',
      street: 'Kreuzerfeld 6',
      postalCode: '72108',
      city: 'Rottenburg',
      latitude: null,
      longitude: null,
    },
    result: null,
    confirmed: true,
    distanceKm: 15.0,
  },
  {
    id: 1004,
    leagueId: 1,
    league: MOCK_LEAGUES[0],
    matchDay: 4,
    kickoffDate: '2099-10-26',
    kickoffTime: '17:00',
    homeTeam: { id: 15, dbbId: 1015, name: 'VfL Sindelfingen' },
    guestTeam: { id: 16, dbbId: 1016, name: 'BBG Böblingen' },
    venue: null,
    result: null,
    confirmed: false,
    distanceKm: 25.0,
  },
];

test.describe('Match Quick-Action Links (Issue #95)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          lastSyncedAt: '2026-10-18T12:00:00.000Z',
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

    await page.route(/\/api\/matches\/teams/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route(/\/api\/matches(?!\/teams)/, async (route) => {
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

    await page.route('**/photon.komoot.io/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {
                name: 'Stuttgart',
                city: 'Stuttgart',
                postcode: '70173',
                country: 'Deutschland',
              },
              geometry: {
                type: 'Point',
                coordinates: [9.1829, 48.7758],
              },
            },
          ],
        }),
      });
    });
  });

  test('renders all 5 quick-action links with correct DBB and Maps URLs in list view', async (
    { page },
    testInfo,
  ) => {
    // Force list view mode via pre-seeded localStorage
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'heimspielradar:filters:v1',
        JSON.stringify({ viewMode: 'list', onlyUpcoming: false }),
      );
    });

    await page.goto('/');

    const card1001 = page.locator('[data-match-id="1001"]');
    await expect(card1001).toBeVisible();

    const toolbar1001 = card1001.getByRole('toolbar', { name: 'Match Quick-Actions' });
    await expect(toolbar1001).toBeVisible();

    // 1. Navigation link with coordinates
    const navLink1001 = toolbar1001.locator('[data-action="navigation"]');
    await expect(navLink1001).toBeVisible();
    await expect(navLink1001).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=48.7745,9.1565',
    );
    await expect(navLink1001).toHaveAttribute('target', '_blank');
    await expect(navLink1001).toHaveAttribute('rel', 'noopener noreferrer');

    // 2. Spielinfo link
    const infoLink1001 = toolbar1001.locator('[data-action="spielinfo"]');
    await expect(infoLink1001).toBeVisible();
    await expect(infoLink1001).toHaveAttribute(
      'href',
      'https://www.basketball-bund.net/static/#/spiel/1001',
    );
    await expect(infoLink1001).toHaveAttribute('target', '_blank');

    // 3. Boxscore link (upcoming match: de-emphasized with tooltip)
    const boxLink1001 = toolbar1001.locator('[data-action="boxscore"]');
    await expect(boxLink1001).toBeVisible();
    await expect(boxLink1001).toHaveAttribute(
      'href',
      'https://www.basketball-bund.net/static/#/spiel/1001/boxscore',
    );
    await expect(boxLink1001).toHaveAttribute(
      'title',
      'Statistiken nach Spielbeginn verfügbar',
    );

    // 4. Play-by-Play link (upcoming match: de-emphasized with tooltip)
    const pbpLink1001 = toolbar1001.locator('[data-action="playbyplay"]');
    await expect(pbpLink1001).toBeVisible();
    await expect(pbpLink1001).toHaveAttribute(
      'href',
      'https://www.basketball-bund.net/static/#/spiel/1001/playbyplay',
    );
    await expect(pbpLink1001).toHaveAttribute(
      'title',
      'Live-Ticker nach Spielbeginn verfügbar',
    );

    // 5. Standings link
    const standingsLink1001 = toolbar1001.locator('[data-action="standings"]');
    await expect(standingsLink1001).toBeVisible();
    await expect(standingsLink1001).toHaveAttribute(
      'href',
      'https://www.basketball-bund.net/static/#/liga/50001/tabelle',
    );
    await expect(standingsLink1001).toHaveAttribute('target', '_blank');

    // Finished match 1002: Boxscore and Play-by-Play highlighted with active titles
    const card1002 = page.locator('[data-match-id="1002"]');
    await expect(card1002).toBeVisible();

    const toolbar1002 = card1002.getByRole('toolbar', { name: 'Match Quick-Actions' });
    const boxLink1002 = toolbar1002.locator('[data-action="boxscore"]');
    await expect(boxLink1002).toHaveAttribute(
      'title',
      'DBB Boxscore & Spielerstatistiken',
    );

    const pbpLink1002 = toolbar1002.locator('[data-action="playbyplay"]');
    await expect(pbpLink1002).toHaveAttribute(
      'title',
      'DBB Live-Ticker & Play-by-Play',
    );

    // Match 1003: Coordinate-less venue falls back to encoded address
    const card1003 = page.locator('[data-match-id="1003"]');
    const toolbar1003 = card1003.getByRole('toolbar', { name: 'Match Quick-Actions' });
    const navLink1003 = toolbar1003.locator('[data-action="navigation"]');
    const expectedAddress = encodeURIComponent('Volksbank Arena, Kreuzerfeld 6, 72108 Rottenburg');
    await expect(navLink1003).toHaveAttribute(
      'href',
      `https://www.google.com/maps/dir/?api=1&destination=${expectedAddress}`,
    );

    // Match 1004: Venue-less match shows disabled navigation icon
    const card1004 = page.locator('[data-match-id="1004"]');
    const toolbar1004 = card1004.getByRole('toolbar', { name: 'Match Quick-Actions' });
    const navDisabled1004 = toolbar1004.locator('[data-action="navigation-disabled"]');
    await expect(navDisabled1004).toBeVisible();
    await expect(navDisabled1004).toHaveAttribute('aria-disabled', 'true');

    // Capture visual verification screenshot for list view
    const listScreenshotName = testInfo.project.name.includes('mobile')
      ? 'verify-list-mobile-chromium.png'
      : 'verify-list-desktop-chromium.png';

    await page.screenshot({
      path: `test-results/${listScreenshotName}`,
      fullPage: true,
    });
  });

  test('clicking quick-action icon stops propagation and does not trigger card selection or map navigation', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'heimspielradar:filters:v1',
        JSON.stringify({ viewMode: 'list', onlyUpcoming: false }),
      );
    });

    await page.goto('/');

    const card1001 = page.locator('[data-match-id="1001"]');
    await expect(card1001).toBeVisible();

    // Verify list view is active initially
    await expect(page.locator('[data-match-id="1001"]')).toBeVisible();

    // Click on the quick-action link
    const infoLink = card1001.locator('[data-action="spielinfo"]');
    await infoLink.click();

    // Verify list view is still active because stopPropagation prevented card's onSelectMatch
    await expect(page.locator('[data-match-id="1001"]')).toBeVisible();

    // Now clicking the card body directly triggers onSelectMatch (switches to map view)
    const teamsHeader = card1001.getByText('MTV Stuttgart 1843');
    await teamsHeader.click();

    // In map view, the list view is unmounted and the bottom venue overlay appears
    await expect(page.locator('[data-match-id="1001"]')).toBeHidden();
    const venueHeading = page.getByRole('heading', { name: 'Sporthalle West' });
    await expect(venueHeading).toBeVisible();
  });

  test('displays quick-action action bar inside map venue overlay popup with parity', async ({
    page,
  }, testInfo) => {
    // Open in map view mode
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'heimspielradar:filters:v1',
        JSON.stringify({ viewMode: 'map', onlyUpcoming: false }),
      );
    });

    await page.goto('/');

    // Click the multi-match basketball pin (Sporthalle West)
    const pin = page.locator('.pin-match-badge').first();
    await expect(pin).toBeVisible({ timeout: 10000 });
    await pin.click();

    // Verify Venue Overlay card is visible at bottom
    const venueHeading = page.getByRole('heading', { name: 'Sporthalle West' });
    await expect(venueHeading).toBeVisible({ timeout: 5000 });

    // Verify venue popup contains quick-action toolbars for hosted games
    const overlayToolbars = page.getByRole('toolbar', { name: 'Match Quick-Actions' });
    const count = await overlayToolbars.count();
    expect(count).toBeGreaterThan(0);

    // Verify quick action links exist inside the venue overlay
    const firstToolbar = overlayToolbars.first();
    await expect(firstToolbar.locator('[data-action="spielinfo"]')).toBeVisible();
    await expect(firstToolbar.locator('[data-action="navigation"]')).toBeVisible();
    await expect(firstToolbar.locator('[data-action="boxscore"]')).toBeVisible();
    await expect(firstToolbar.locator('[data-action="playbyplay"]')).toBeVisible();
    await expect(firstToolbar.locator('[data-action="standings"]')).toBeVisible();

    // Capture visual verification screenshot
    const screenshotName = testInfo.project.name.includes('mobile')
      ? 'verify-mobile-chromium.png'
      : 'verify-desktop-chromium.png';

    await page.screenshot({
      path: `test-results/${screenshotName}`,
      fullPage: true,
    });
  });
});
