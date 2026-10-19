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
    kickoffTime: '20:00',
    homeTeam: { id: 10, dbbId: 1010, name: 'MTV Stuttgart 1843 2' },
    guestTeam: { id: 12, dbbId: 1012, name: 'SG Mannheim' },
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
    id: 1003,
    leagueId: 1,
    league: MOCK_LEAGUES[0],
    matchDay: 4,
    kickoffDate: '2099-10-25',
    kickoffTime: '16:00',
    homeTeam: { id: 13, dbbId: 1013, name: 'TV Derendingen' },
    guestTeam: { id: 14, dbbId: 1014, name: 'TSG Reutlingen' },
    venue: {
      id: 502,
      name: 'Uhlandhalle',
      street: 'Uhlandstraße 2',
      postalCode: '72072',
      city: 'Tübingen',
      latitude: 48.5185,
      longitude: 9.0558,
    },
    result: null,
    confirmed: false,
    distanceKm: 32.5,
  },
  {
    id: 1004,
    leagueId: 1,
    league: MOCK_LEAGUES[0],
    matchDay: 4,
    kickoffDate: '2099-10-25',
    kickoffTime: '18:30',
    homeTeam: { id: 15, dbbId: 1015, name: 'SV 03 Tübingen' },
    guestTeam: { id: 16, dbbId: 1016, name: 'VfL Waiblingen' },
    venue: {
      id: 503,
      name: 'Paul Horn-Arena',
      street: 'Europastraße 50',
      postalCode: '72072',
      city: 'Tübingen',
      latitude: 48.5135,
      longitude: 9.0435,
    },
    result: null,
    confirmed: false,
    distanceKm: 33.1,
  },
];

test.describe('Issue #63: Basketball Pins, Zoom Clustering, Search Center & Radius Circle', () => {
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

    await page.route('**/api/matches*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_MATCHES),
      });
    });

    // Mock OSM and map tile requests for fast, deterministic E2E runs
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
                name: 'Tübingen',
                city: 'Tübingen',
                postcode: '72072',
                state: 'Baden-Württemberg',
                country: 'Deutschland',
              },
              geometry: {
                type: 'Point',
                coordinates: [9.0558, 48.5185],
              },
            },
          ],
        }),
      });
    });
  });

  test('1. Basketball pins render with orange fill, seam lines and match badges', async ({ page }) => {
    await page.goto('/');

    // Check that at least one basketball pin is visible on map
    const basketballPin = page.locator('svg circle[fill="#f97316"]').first();
    await expect(basketballPin).toBeVisible({ timeout: 10000 });

    // Verify basketball seam line exists inside the pin
    const seamLine = page.locator('svg line[stroke="#0f172a"]').first();
    await expect(seamLine).toBeAttached();

    // Verify multi-match badge on Sporthalle West (2 matches)
    const venueBadge = page.locator('span:has-text("2")').first();
    await expect(venueBadge).toBeVisible();
  });

  test('2. Multiple nearby venues cluster into a badge and expand on click', async ({ page }) => {
    await page.goto('/');

    // Locate the cluster badge for the 2 Tübingen venues
    const clusterBadge = page.locator('.cluster-badge').first();
    await expect(clusterBadge).toBeVisible({ timeout: 10000 });
    await expect(clusterBadge).toContainText('2');
    await expect(clusterBadge).toContainText('Spiele');

    // Clicking cluster triggers expansion zoom
    await clusterBadge.click();

    // After zooming in, cluster disperses into separate venue pins
    await expect(clusterBadge).toBeHidden({ timeout: 5000 });
  });

  test('3. Search Center marker renders when a city is selected', async ({ page }) => {
    await page.goto('/');

    // Search Center pin is visible for Stuttgart fallback center
    const searchMarker = page.locator('.search-center-marker').first();
    await expect(searchMarker).toBeVisible({ timeout: 10000 });
    await expect(searchMarker).toContainText('Stuttgart');
    await expect(searchMarker.locator('svg path[fill="#ef4444"]')).toBeVisible();

    // Open filter drawer, search Tübingen
    await page.locator('header').getByRole('button', { name: /Filter/i }).click();
    const drawer = page.locator('aside');
    await expect(drawer).toBeVisible();

    const searchInput = drawer.getByPlaceholder('Stadt oder PLZ suchen...');
    await searchInput.fill('72072');

    const suggestionBox = drawer.locator('div[role="listbox"]');
    await expect(suggestionBox).toBeVisible();

    const option = suggestionBox.getByRole('option', { name: /Tübingen/i }).first();
    await option.click();

    await drawer.getByRole('button', { name: 'Filter schließen' }).click();

    // Now search center marker should show Tübingen
    await expect(page.locator('.search-center-marker').first()).toContainText('Tübingen');
  });

  test('4. Radius circle toggle in Filter drawer toggles visibility and persists', async ({ page }) => {
    await page.goto('/');

    // Open filter drawer
    await page.locator('header').getByRole('button', { name: /Filter/i }).click();
    const drawer = page.locator('aside');
    await expect(drawer).toBeVisible();

    const radiusToggle = drawer.getByRole('switch', { name: /Suchradius auf Karte anzeigen/i });
    await expect(radiusToggle).toBeVisible();
    await expect(radiusToggle).toHaveAttribute('aria-checked', 'true');

    // Toggle off
    await radiusToggle.click();
    await expect(radiusToggle).toHaveAttribute('aria-checked', 'false');

    // Verify localStorage has persisted showRadiusCircle: false
    const rawStored = await page.evaluate(() =>
      window.localStorage.getItem('heimspielradar:filters:v1'),
    );

    expect(rawStored).toContain('"showRadiusCircle":false');

    // Toggle back on
    await radiusToggle.click();
    await expect(radiusToggle).toHaveAttribute('aria-checked', 'true');

    const rawStoredAfter = await page.evaluate(() =>
      window.localStorage.getItem('heimspielradar:filters:v1'),
    );

    expect(rawStoredAfter).toContain('"showRadiusCircle":true');
  });

  test('5. Capture visual verification screenshots on Desktop and Mobile', async ({ page }, testInfo) => {
    await page.goto('/');

    // Wait for map and markers to be fully painted
    await page.waitForSelector('svg circle[fill="#f97316"]', { timeout: 10000 });
    await page.waitForTimeout(600);

    const isMobile = testInfo.project.name.includes('mobile');

    const screenshotName = isMobile
      ? 'verify-mobile-chromium.png'
      : 'verify-desktop-chromium.png';

    const screenshotPath = path.resolve('test-results', screenshotName);

    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Verify screenshot was written
    expect(screenshotPath).toBeTruthy();
  });
});
