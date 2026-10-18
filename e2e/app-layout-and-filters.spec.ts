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

    await page.route('**/api/matches*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_MATCHES),
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

    // 4. Verify brand title is fully visible and not squished/truncated
    const brandTitle = header.getByText('HeimspielRadar');
    await expect(brandTitle).toBeVisible();

    const titleBox = await brandTitle.boundingBox();
    expect(titleBox).not.toBeNull();

    if (titleBox) {
      expect(titleBox.width).toBeGreaterThanOrEqual(100);
    }

    // 5. Save visual self-check screenshot for agent inspection via view_file
    await page.screenshot({
      path: `test-results/verify-${testInfo.project.name}.png`,
    });
  });

  test('toggles between Map and List views and persists Slide-Over Filter Drawer state in localStorage', async (
    { page },
    testInfo,
  ) => {
    await page.goto('/');

    const isMobile = testInfo.project.name.includes('mobile');
    const header = page.locator('header');
    const brandTitle = header.getByText('HeimspielRadar');
    await expect(brandTitle).toBeVisible();

    const headerTablist = header.getByRole('tablist');

    if (isMobile) {
      await expect(headerTablist).toBeHidden();
    } else {
      await expect(headerTablist).toBeVisible();
    }

    // 1. Open Slide-Over Filter Drawer
    const filterButton = header.getByRole('button', { name: /Filter/i });
    await filterButton.click();

    const drawer = page.getByRole('dialog', { name: 'Filtereinstellungen' });
    await expect(drawer).toBeVisible();

    // Verify Ansicht view switcher is present in the drawer
    const drawerTablist = drawer.getByRole('tablist');
    await expect(drawerTablist).toBeVisible();

    const drawerMapTab = drawer.getByRole('tab', { name: /Karte/i });
    const drawerListTab = drawer.getByRole('tab', { name: /Liste/i });
    await expect(drawerMapTab).toHaveAttribute('aria-selected', 'true');
    await expect(drawerListTab).toHaveAttribute('aria-selected', 'false');

    // 2. Select 'Alle Termine' so our future mock match is visible, toggle 'Nur anstehende Spiele', and select 'Männlich'
    await drawer.getByRole('button', { name: 'Alle Termine' }).first().click();

    const upcomingSwitch = drawer.getByRole('switch');
    await expect(upcomingSwitch).toHaveAttribute('aria-checked', 'true');
    await upcomingSwitch.click();
    await expect(upcomingSwitch).toHaveAttribute('aria-checked', 'false');

    const maennlichChip = drawer.getByRole('button', { name: 'Männlich', exact: true });
    await maennlichChip.click();

    if (isMobile) {
      // On mobile: switch to List view inside the Filter Drawer
      await drawerListTab.click();
      await expect(drawerListTab).toHaveAttribute('aria-selected', 'true');

      // Save screenshot of open drawer for visual inspection
      await page.screenshot({
        path: `test-results/verify-drawer-${testInfo.project.name}.png`,
      });

      // Close drawer via footer button
      await drawer.getByRole('button', { name: /Spiele? anzeigen/i }).click();
      await expect(drawer).toBeHidden();
    } else {
      // On desktop: close drawer first, then switch via header segmented control
      await drawer.getByRole('button', { name: 'Filter schließen' }).click();
      await expect(drawer).toBeHidden();

      const headerListTab = header.getByRole('tab', { name: /Liste/i });
      await headerListTab.click();
      await expect(headerListTab).toHaveAttribute('aria-selected', 'true');
    }

    // Verify match card renders in List View
    await expect(page.getByText('MTV Stuttgart 1843')).toBeVisible();

    // 5. Reload page and verify state persisted in localStorage ('heimspielradar:filters:v1')
    await page.reload();

    const rawStored = await page.evaluate(() =>
      window.localStorage.getItem('heimspielradar:filters:v1'),
    );

    expect(rawStored).not.toBeNull();
    expect(rawStored).toContain('"viewMode":"list"');
    expect(rawStored).toContain('"onlyUpcoming":false');
    expect(rawStored).toContain('"männlich"');

    if (isMobile) {
      // On mobile: open drawer and switch back to Map View
      await filterButton.click();
      await expect(drawer).toBeVisible();

      const returnMapTab = drawer.getByRole('tab', { name: /Karte/i });
      await returnMapTab.click();
      await expect(returnMapTab).toHaveAttribute('aria-selected', 'true');

      await drawer.getByRole('button', { name: /Spiele? anzeigen/i }).click();
      await expect(drawer).toBeHidden();
    } else {
      // On desktop: switch back via header
      const headerMapTab = header.getByRole('tab', { name: /Karte/i });
      await headerMapTab.click();
      await expect(headerMapTab).toHaveAttribute('aria-selected', 'true');
    }
  });

  test('floating map summary chip is visible, interactive, readable without truncation, and clears zoom controls', async (
    { page },
    testInfo,
  ) => {
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 48.7758, longitude: 9.1829 });
    await page.goto('/');

    // 1. Locate the interactive summary chip button
    const summaryChip = page.getByRole('button', { name: 'Filter öffnen' });
    await expect(summaryChip).toBeVisible();

    // 2. Initial state (Stuttgart fallback): ensure location name is not truncated to single letter
    await expect(summaryChip).toContainText('Stuttgart');
    await expect(summaryChip).toContainText('30 km');

    // 3. Verify no overlap between zoom controls and summary chip
    const chipBox = await summaryChip.boundingBox();
    expect(chipBox).not.toBeNull();

    const zoomControl = page
      .locator('.ol-zoom, .leaflet-control-zoom, .maplibregl-ctrl-group, .pigeon-zoom-buttons')
      .first();

    await expect(zoomControl).toBeVisible();

    const zoomBox = await zoomControl.boundingBox();
    expect(zoomBox).not.toBeNull();

    if (chipBox && zoomBox) {
      // In mobile viewports, the chip is positioned at top-right while zoom is at top-left.
      // Assert that there is positive horizontal clearance between zoom buttons and the chip.
      const clearance = chipBox.x - (zoomBox.x + zoomBox.width);

      expect(clearance).toBeGreaterThan(15);
    }

    // 4. Chip click interactivity: tapping opens the Filter Drawer
    await summaryChip.click();
    const drawer = page.getByRole('dialog', { name: 'Filtereinstellungen' });
    await expect(drawer).toBeVisible();

    // 5. Select "Mein Standort" in drawer and close to verify full name rendering
    await drawer.getByRole('button', { name: /Mein Standort/i }).click();
    await drawer.getByRole('button', { name: 'Filter schließen' }).click();
    await expect(drawer).toBeHidden();

    // Verify "Mein Standort" is fully rendered and not truncated to "M..."
    await expect(summaryChip).toContainText('Mein Standort');

    // 6. Capture mobile visual verification screenshot for agent inspection
    await page.screenshot({
      path: `test-results/summary-chip-${testInfo.project.name}.png`,
    });
  });
});
