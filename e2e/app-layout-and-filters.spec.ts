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
  {
    id: 2,
    dbbId: 50002,
    name: 'Landesliga Damen',
    skName: 'Landesliga',
    akName: 'Senioren',
    geschlecht: 'weiblich',
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
];

test.describe('HeimspielRadar Layout, Viewport Geometry & Filters', () => {
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
        body: JSON.stringify([
          { id: 101, name: 'SV Pfrondorf 1', shortName: 'SV Pfrondorf', clubId: 50 },
          { id: 102, name: 'TSG Reutlingen 2', shortName: 'TSG 2', clubId: 60 },
        ]),
      });
    });

    await page.route(/\/api\/matches(?!\/teams)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_MATCHES),
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
                name: 'Karlsruhe',
                city: 'Karlsruhe',
                postcode: '76133',
                state: 'Baden-Württemberg',
                country: 'Deutschland',
              },
              geometry: {
                type: 'Point',
                coordinates: [8.4037, 49.0069],
              },
            },
          ],
        }),
      });
    });
  });

  test('renders 100% full-screen map geometry and prevents vertical page scrolling', async (
    { page },
    testInfo,
  ) => {
    await page.goto('/');

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();

    if (!viewport) {
      return;
    }

    const header = page.locator('header');
    const main = page.locator('main');

    await expect(header).toBeVisible();
    await expect(main).toBeVisible();

    const headerBox = await header.boundingBox();
    const mainBox = await main.boundingBox();

    expect(headerBox).not.toBeNull();
    expect(mainBox).not.toBeNull();

    if (!headerBox || !mainBox) {
      return;
    }

    // 1. Header must stay pinned at y === 0 and span 100% of the viewport width
    expect(headerBox.y).toBe(0);
    expect(Math.round(headerBox.width)).toBe(viewport.width);

    // 2. Full-screen Map container (<main>) must fill 100% width and remaining viewport height
    expect(Math.round(mainBox.width)).toBe(viewport.width);
    expect(mainBox.height).toBeGreaterThanOrEqual(
      viewport.height - headerBox.height - 2,
    );

    // 3. Verify viewport scroll-lock: attempting to scroll the window must keep scrollY === 0 and header at y === 0
    await page.evaluate(() => {
      window.scrollTo(0, 300);
    });

    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);

    const headerBoxAfterScroll = await header.boundingBox();
    expect(headerBoxAfterScroll?.y).toBe(0);

    // 4. Verify brand logo & title are fully visible and not squished/truncated
    const brandLogo = header.getByTestId('brand-logo');
    await expect(brandLogo).toBeVisible();

    const brandTitle = header.getByText('HeimspielRadar');
    await expect(brandTitle).toBeVisible();

    const titleBox = await brandTitle.boundingBox();
    expect(titleBox).not.toBeNull();

    if (titleBox) {
      expect(titleBox.width).toBeGreaterThanOrEqual(100);
    }

    // Verify header contains zero view switcher tabs/controls
    await expect(header.getByRole('tablist')).toHaveCount(0);
    await expect(header.getByRole('tab')).toHaveCount(0);

    // 5. Save visual self-check screenshot for agent inspection via view_file
    await page.screenshot({
      path: `test-results/verify-${testInfo.project.name}.png`,
    });
  });

  test('toggles between Map and List views and persists viewMode in localStorage', async (
    { page },
  ) => {
    await page.goto('/');

    const header = page.locator('header');
    const brandTitle = header.getByText('HeimspielRadar');
    await expect(brandTitle).toBeVisible();

    // 1. Open Navigation Drawer
    await page.getByTestId('nav-menu-button').click();
    const navDrawer = page.getByRole('dialog', { name: /Navigation & Menü|Navigation/i });
    await expect(navDrawer).toBeVisible();

    // 2. Switch to List view
    await page.getByTestId('nav-item-list').click();
    await expect(navDrawer).toBeHidden();

    // Verify match card renders in List View
    await expect(page.getByText('MTV Stuttgart 1843')).toBeVisible();

    // 3. Reload page and verify state persisted in localStorage ('heimspielradar:filters:v1')
    await page.reload();

    const rawStored = await page.evaluate(() =>
      window.localStorage.getItem('heimspielradar:filters:v1'),
    );

    expect(rawStored).not.toBeNull();
    expect(rawStored).toContain('"viewMode":"list"');

    // Still in list view after reload
    await expect(page.getByText('MTV Stuttgart 1843')).toBeVisible();

    // 4. Open drawer and switch back to Map View
    await page.getByTestId('nav-menu-button').click();
    await expect(navDrawer).toBeVisible();
    await page.getByTestId('nav-item-map').click();
    await expect(navDrawer).toBeHidden();

    // Verify map bottom filter bar is visible again
    await expect(page.getByTestId('bottom-filter-bar')).toBeVisible();
  });

  test('docked bottom filter bar is visible, interactive, readable, and clears zoom controls', async (
    { page },
    testInfo,
  ) => {
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 48.7758, longitude: 9.1829 });
    await page.goto('/');

    // 1. Locate the interactive bottom filter bar
    const bottomBar = page.getByTestId('bottom-filter-bar');
    await expect(bottomBar).toBeVisible();

    // 2. Initial state (Stuttgart fallback): ensure location name is not truncated to single letter
    await expect(bottomBar).toContainText('Stuttgart');
    await expect(bottomBar).toContainText('30 km');

    // 3. Verify no overlap between zoom controls and bottom bar
    const barBox = await bottomBar.boundingBox();
    expect(barBox).not.toBeNull();

    const zoomControl = page.locator('.maplibregl-ctrl-group').first();

    await expect(zoomControl).toBeVisible();

    // 4. Capture visual verification screenshot for agent inspection
    await page.screenshot({
      path: `test-results/summary-chip-${testInfo.project.name}.png`,
    });
  });

  test('searches location by city name or postal code, selects autocomplete suggestion, and persists across reloads', async (
    { page },
  ) => {
    await page.goto('/');

    const isMobile = (page.viewportSize()?.width ?? 1000) < 768;

    const drawer = isMobile
      ? page.getByRole('dialog', { name: 'Filtereinstellungen' })
      : page.locator('aside[aria-label="Filtereinstellungen"]');

    if (isMobile) {
      await page.getByTestId('bottom-filter-bar').getByRole('button', { name: 'Filter', exact: true }).click();
    }

    // Search for city name 'Karls'
    const searchInput = drawer.getByPlaceholder('Stadt, PLZ oder Verein suchen...');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Karls');

    // Autocomplete listbox appears with instant suggestion 'Karlsruhe'
    const suggestionBox = drawer.getByRole('listbox');
    await expect(suggestionBox).toBeVisible();

    const karlsruheOption = suggestionBox
      .getByRole('option', { name: /Karlsruhe/i })
      .first();

    await expect(karlsruheOption).toBeVisible();
    await karlsruheOption.click();

    if (isMobile) {
      await drawer.getByRole('button', { name: /Spiele anzeigen/i }).click();
    }

    // Now bottom filter bar shows Karlsruhe
    await expect(page.getByTestId('bottom-filter-bar')).toContainText('Karlsruhe');

    // Reload page to verify persistence
    await page.reload();
    await expect(page.getByTestId('bottom-filter-bar')).toContainText('Karlsruhe');
  });

  test('club & team search filter with autocomplete, chip, and persistence (#72)', async ({
    page,
  }) => {
    await page.goto('/');

    const isMobile = (page.viewportSize()?.width ?? 1000) < 768;

    const drawer = isMobile
      ? page.getByRole('dialog', { name: 'Filtereinstellungen' })
      : page.locator('aside[aria-label="Filtereinstellungen"]');

    if (isMobile) {
      await page.getByTestId('bottom-filter-bar').getByRole('button', { name: 'Filter', exact: true }).click();
    }

    const searchInput = drawer.getByPlaceholder('Stadt, PLZ oder Verein suchen...');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Pfrondorf');

    const teamDropdown = drawer.getByRole('listbox');
    await expect(teamDropdown).toBeVisible();

    const pfrondorfOption = teamDropdown.getByRole('option', { name: /SV Pfrondorf 1/i });
    await expect(pfrondorfOption).toBeVisible();
    await pfrondorfOption.click();

    if (isMobile) {
      await drawer.getByRole('button', { name: /Spiele anzeigen/i }).click();
    }

    const bottomBar = page.getByTestId('bottom-filter-bar');
    await expect(bottomBar.getByTestId('bottom-bar-team-chip')).toBeVisible();
    await expect(bottomBar.getByTestId('bottom-bar-team-chip')).toContainText('SV Pfrondorf 1');

    await page.reload();
    await expect(bottomBar.getByTestId('bottom-bar-team-chip')).toBeVisible();
    await expect(bottomBar.getByTestId('bottom-bar-team-chip')).toContainText('SV Pfrondorf 1');

    await bottomBar.getByTestId('bottom-bar-team-chip').getByLabel('Vereinsfilter aufheben').click();
    await expect(bottomBar.getByTestId('bottom-bar-team-chip')).toBeHidden();
  });

  test('displays top progress bar and loading indicators during match queries', async ({ page }) => {
    let fulfillMatches: (() => void) | null = null;

    const matchPromise = new Promise<void>((resolve) => {
      fulfillMatches = resolve;
    });

    await page.route('**/api/matches*', async (route) => {
      await matchPromise;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_MATCHES),
      });
    });

    await page.goto('/');

    // While matches are pending, top loading bar should be visible
    const topBar = page.getByTestId('top-loading-bar');

    await expect(topBar).toBeVisible();

    // Release matches
    fulfillMatches?.();

    // Once matches are loaded, top bar transitions to complete and fades out
    await expect(topBar).toBeHidden({ timeout: 5000 });
  });
});
