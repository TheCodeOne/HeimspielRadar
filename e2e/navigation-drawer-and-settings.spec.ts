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
    id: 9001,
    leagueId: 1,
    league: MOCK_LEAGUES[0],
    matchDay: 1,
    matchNo: 101,
    kickoffDate: '2026-11-07',
    kickoffTime: '15:30',
    confirmed: true,
    homeTeam: {
      id: 101,
      dbbId: 1001,
      name: 'SV Möhringen',
      shortName: 'Möhringen',
    },
    guestTeam: {
      id: 102,
      dbbId: 1002,
      name: 'MTV Stuttgart',
      shortName: 'MTV',
    },
    venue: {
      id: 501,
      name: 'Remshalle Stuttgart',
      street: 'Remsweg 1',
      postalCode: '70567',
      city: 'Stuttgart',
      latitude: 48.7200,
      longitude: 9.1400,
    },
  },
];

test.describe('Unified App Navigation Drawer & Dedicated /settings View', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', lastSyncedAt: '2026-11-06T18:00:00Z' }),
      });
    });

    await page.route('**/api/leagues', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_LEAGUES),
      });
    });

    await page.route(/\/api\/matches.*/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_MATCHES),
      });
    });
  });

  test('Hamburger menu button opens drawer, displays items, and closes via X, Zurück, backdrop and Escape', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const menuBtn = page.getByTestId('nav-menu-button');
    await expect(menuBtn).toBeVisible();

    // 1. Open drawer
    await menuBtn.click();
    const drawer = page.getByRole('dialog', { name: /Navigation & Menü|Navigation/i });
    await expect(drawer).toBeVisible();

    // Verify nav items
    await expect(page.getByTestId('nav-item-map')).toBeVisible();
    await expect(page.getByTestId('nav-item-list')).toBeVisible();
    await expect(page.getByTestId('nav-item-story')).toBeVisible();
    await expect(page.getByTestId('nav-item-settings')).toBeVisible();

    // Verify donation link
    await expect(drawer.getByText(/Hallenkaffee spendieren/i)).toBeVisible();

    // Verify close via X button
    const closeBtn = page.getByTestId('nav-drawer-close');
    await closeBtn.click();
    await expect(drawer).toBeHidden();

    // 2. Open and close via Zurück button
    await menuBtn.click();
    await expect(drawer).toBeVisible();
    await drawer.getByRole('button', { name: /Zurück/i }).click();
    await expect(drawer).toBeHidden();

    // 3. Open and close via Escape key
    await menuBtn.click();
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();

    // 4. Open and close via backdrop click (click at left edge outside 360px drawer)
    await menuBtn.click();
    await expect(drawer).toBeVisible();
    await page.mouse.click(20, 200);
    await expect(drawer).toBeHidden();
  });

  test('Navigation transitions between Map, List, Club Story Hub, and Settings properly', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Switch to List view via Drawer
    await page.getByTestId('nav-menu-button').click();
    await page.getByTestId('nav-item-list').click();
    await expect(page.locator('[data-match-id="9001"]')).toBeVisible();

    // 2. Navigate to Club Story Hub
    await page.getByTestId('nav-menu-button').click();
    await page.getByTestId('nav-item-story').click();
    await expect(page).toHaveURL(/\/story/);
    await expect(page.getByText(/Club Story Hub|Instagram Story Generator/i).first()).toBeVisible();

    // Verify Header in Story Hub also has Menu button & Home back button
    await expect(page.getByTestId('nav-menu-button')).toBeVisible();
    await expect(page.getByRole('button', { name: /Zum Heimspielradar/i })).toBeVisible();

    // 3. Navigate to Settings from Story Hub
    await page.getByTestId('nav-menu-button').click();
    await page.getByTestId('nav-item-settings').click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole('heading', { name: /Einstellungen & Optionen/i })).toBeVisible();

    // 4. Navigate back to Map via Drawer
    await page.getByTestId('nav-menu-button').click();
    await page.getByTestId('nav-item-map').click();
    await expect(page).toHaveURL(/\//);
  });

  test('/settings renders full-page settings with engine selector, radius toggle, default view, and cache reset with toast', async ({
    page,
  }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Heading & Sections
    await expect(page.getByRole('heading', { name: /Einstellungen & Optionen/i })).toBeVisible();
    await expect(page.getByText(/Karten-Optionen/i)).toBeVisible();
    await expect(page.getByText(/Standard-Ansicht/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Push-Benachrichtigungen/i })).toBeVisible();
    await expect(page.getByText(/Speicher & Offline-Cache/i)).toBeVisible();
    await expect(page.getByText(/Über & DBB-Sync/i)).toBeVisible();

    // 1. Engine selector options
    await expect(page.getByRole('button', { name: /OpenLayers/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /MapLibre GL/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Leaflet/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Pigeon Maps/i })).toBeVisible();

    // Select MapLibre GL
    await page.getByRole('button', { name: /MapLibre GL/i }).click();

    // 2. Radius toggle
    const radiusSwitch = page.getByRole('switch');
    await expect(radiusSwitch).toBeVisible();
    const initialChecked = await radiusSwitch.getAttribute('aria-checked');
    await radiusSwitch.click();
    const updatedChecked = await radiusSwitch.getAttribute('aria-checked');
    expect(updatedChecked).not.toBe(initialChecked);

    // 3. Cache reset action with toast feedback
    const resetCacheBtn = page.getByRole('button', { name: /Cache leeren/i });
    await expect(resetCacheBtn).toBeVisible();
    await resetCacheBtn.click();

    // Expect feedback toast
    await expect(page.getByText(/Offline-Cache und Speicher erfolgreich geleert!/i)).toBeVisible();

    // 4. Back button returns to /
    const backBtn = page.getByRole('button', { name: /Zurück/i });
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page).toHaveURL(/\//);
  });

  test('Theme mode switcher (System / Hell / Dunkel) synchronizes .dark class on <html>, updates localStorage and <meta name="theme-color">', async ({
    page,
  }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Section exists
    await expect(page.getByText('Erscheinungsbild')).toBeVisible();

    // 3 Buttons exist
    const systemBtn = page.getByTestId('theme-system');
    const lightBtn = page.getByTestId('theme-light');
    const darkBtn = page.getByTestId('theme-dark');
    await expect(systemBtn).toBeVisible();
    await expect(lightBtn).toBeVisible();
    await expect(darkBtn).toBeVisible();

    // 1. Switch to Light Mode
    await lightBtn.click();
    await expect(lightBtn).toHaveAttribute('aria-checked', 'true');
    await expect(systemBtn).toHaveAttribute('aria-checked', 'false');
    await expect(darkBtn).toHaveAttribute('aria-checked', 'false');

    // HTML root should NOT have class="dark"
    const isDarkLight = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDarkLight).toBe(false);

    // localStorage should be 'light'
    const storedLight = await page.evaluate(() => localStorage.getItem('heimspielradar:theme'));
    expect(storedLight).toBe('light');

    // meta theme-color should be #ffffff
    const metaLight = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(metaLight).toBe('#ffffff');

    // 2. Switch to Dark Mode
    await darkBtn.click();
    await expect(darkBtn).toHaveAttribute('aria-checked', 'true');
    await expect(lightBtn).toHaveAttribute('aria-checked', 'false');

    // HTML root should have class="dark"
    const isDarkDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDarkDark).toBe(true);

    // localStorage should be 'dark'
    const storedDark = await page.evaluate(() => localStorage.getItem('heimspielradar:theme'));
    expect(storedDark).toBe('dark');

    // meta theme-color should be #020617
    const metaDark = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(metaDark).toBe('#020617');

    // 3. Switch back to System Mode
    await systemBtn.click();
    await expect(systemBtn).toHaveAttribute('aria-checked', 'true');
    const storedSystem = await page.evaluate(() => localStorage.getItem('heimspielradar:theme'));
    expect(storedSystem).toBe('system');

    // 4. Reload page and check zero-FOUC persistence
    await page.goto('/settings');
    await expect(systemBtn).toHaveAttribute('aria-checked', 'true');
  });
});
