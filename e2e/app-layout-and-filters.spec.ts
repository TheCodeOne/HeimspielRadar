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

    // 4. Save visual self-check screenshot for agent inspection via view_file
    await page.screenshot({
      path: `test-results/verify-${testInfo.project.name}.png`,
    });
  });

  test('toggles between Map and List views and persists Slide-Over Filter Drawer state in localStorage', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Open Slide-Over Filter Drawer
    const filterButton = page.locator('header').getByRole('button', { name: /Filter/i });
    await filterButton.click();

    const drawer = page.getByRole('dialog', { name: 'Filtereinstellungen' });
    await expect(drawer).toBeVisible();

    // 2. Select 'Alle Termine' so our future mock match is visible, toggle 'Nur anstehende Spiele', and select 'Männlich'
    await drawer.getByRole('button', { name: 'Alle Termine' }).first().click();

    const upcomingSwitch = drawer.getByRole('switch');
    await expect(upcomingSwitch).toHaveAttribute('aria-checked', 'true');
    await upcomingSwitch.click();
    await expect(upcomingSwitch).toHaveAttribute('aria-checked', 'false');

    const maennlichChip = drawer.getByRole('button', { name: 'Männlich', exact: true });
    await maennlichChip.click();

    // 3. Close drawer via 'Filter schließen' button
    await drawer.getByRole('button', { name: 'Filter schließen' }).click();
    await expect(drawer).toBeHidden();

    // 4. Switch to List View via header segmented control and verify match card renders
    const listTab = page.getByRole('tab', { name: /Liste/i });
    await listTab.click();
    await expect(listTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('MTV Stuttgart 1843')).toBeVisible();

    // 5. Reload page and verify state persisted in localStorage ('heimspielradar:filters:v1')
    await page.reload();

    await expect(page.getByRole('tab', { name: /Liste/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    const rawStored = await page.evaluate(() =>
      window.localStorage.getItem('heimspielradar:filters:v1'),
    );

    expect(rawStored).not.toBeNull();
    expect(rawStored).toContain('"viewMode":"list"');
    expect(rawStored).toContain('"onlyUpcoming":false');
    expect(rawStored).toContain('"männlich"');

    // Switch back to Map View and verify full-screen map container is active again
    const mapTab = page.getByRole('tab', { name: /Karte/i });
    await mapTab.click();
    await expect(mapTab).toHaveAttribute('aria-selected', 'true');
  });
});
