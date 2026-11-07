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
    id: 102,
    leagueId: 1,
    league: MOCK_LEAGUES[0],
    matchDay: 4,
    kickoffDate: '2026-11-08',
    kickoffTime: '18:00',
    homeTeam: { id: 10, dbbId: 1010, name: 'MTV Stuttgart 1843' },
    guestTeam: { id: 11, dbbId: 1011, name: 'SV Möhringen' },
    venue: {
      id: 502,
      name: 'Remigiussporthalle',
      street: 'Remigiusstraße 5',
      postalCode: '72108',
      city: 'Rottenburg am Neckar',
      latitude: 48.4764,
      longitude: 8.9327,
    },
    result: null,
    confirmed: false,
    distanceKm: 5.2,
  },
  {
    id: 103,
    leagueId: 2,
    league: MOCK_LEAGUES[1],
    matchDay: 5,
    kickoffDate: '2026-11-08',
    kickoffTime: '15:30',
    homeTeam: { id: 20, dbbId: 1020, name: 'TSG Reutlingen 2' },
    guestTeam: { id: 21, dbbId: 1021, name: 'SV Pfrondorf' },
    venue: {
      id: 503,
      name: 'Theodor-Heuss-Halle',
      street: 'Carl-Diem-Straße 10',
      postalCode: '72760',
      city: 'Reutlingen',
      latitude: 48.4912,
      longitude: 9.2045,
    },
    result: null,
    confirmed: false,
    distanceKm: 8.5,
  },
];

test.describe('Canonical FilterBar UI/UX & Interactivity', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', lastSyncedAt: '2026-10-25T10:00:00Z' }),
      });
    });

    await page.route('**/api/leagues', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_LEAGUES),
      });
    });

    await page.route(/\/api\/matches/, async (route) => {
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
          features: [],
        }),
      });
    });
  });

  test('FilterBar: Docked Bottom-Bar, Mobile Bottom-Sheet & Navigation to Settings', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Verify Header Menu Button is present
    const menuBtn = page.getByRole('button', { name: /Menü/i });
    await expect(menuBtn).toBeVisible();

    // 2. Verify Bottom Quick-Filter Bar is visible
    const bottomBar = page.getByTestId('bottom-filter-bar');
    await expect(bottomBar).toBeVisible();
    await expect(bottomBar.getByText(/Heute|Termin|Wochenende|Dieses WE/i).first()).toBeVisible();
    await expect(bottomBar.getByText(/30 km/i).first()).toBeVisible();
    await expect(bottomBar.getByText(/Verein.*suchen/i).first()).toBeVisible();

    if (test.info().project.name === 'desktop-chromium') {
      // On desktop, the split-sidebar is visible beside the map
      await expect(page.getByRole('heading', { name: /Filter & Umkreis/i })).toBeVisible();
    } else {
      // On mobile, tap the bottom bar Filter button to slide up the Mobile Bottom Sheet
      const filterPill = bottomBar.getByRole('button', { name: 'Filter', exact: true });
      await filterPill.click();

      // Mobile Bottom Sheet should be open
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('button', { name: /Spiele anzeigen/i })).toBeVisible();

      // Close sheet to take docked screenshot
      await page.getByRole('button', { name: /Spiele anzeigen/i }).click();
    }

    await page.screenshot({
      path: `test-results/variant-d-docked-${test.info().project.name}.png`,
      fullPage: true,
    });

    // No style-switcher chips are rendered anymore
    await expect(bottomBar.getByText(/Kapsel-Style/i)).toHaveCount(0);
    await expect(bottomBar.getByText(/Dock-Ansicht/i)).toHaveCount(0);

    // Locate button is icon-only and visible below the zoom controls
    const locateBtn = page.getByRole('button', { name: 'Auf meinen Standort zentrieren' });
    await expect(locateBtn).toBeVisible();
    await expect(locateBtn).not.toContainText('Mein Standort');

    // 3. Test Navigation Drawer & Settings View
    await menuBtn.click();
    const navDrawer = page.getByRole('dialog', { name: /Navigation & Menü|Navigation/i });
    await expect(navDrawer).toBeVisible();
    await expect(page.getByTestId('nav-item-settings')).toBeVisible();

    // Navigate to /settings
    await page.getByTestId('nav-item-settings').click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole('heading', { name: /Einstellungen & Optionen/i })).toBeVisible();
    await expect(page.getByText('Karten-Engine', { exact: true })).toBeVisible();

    await page.screenshot({
      path: `test-results/settings-dialog-${test.info().project.name}.png`,
      fullPage: true,
    });

    // Navigate back to main view
    await page.getByRole('button', { name: /Zurück/i }).click();
    await expect(page).toHaveURL(/\//);
  });

  test('VenueModal: Opens when match is selected, hides bottom bar to prevent overlap', async ({ page }) => {
    // Navigate with a selected upcoming match (Sample match 102: Remigiussporthalle)
    await page.goto('/?matchId=102');
    await page.waitForLoadState('networkidle');

    // Verify VenueModal is visible
    const venueModalTitle = page.locator('#venue-modal-title');
    await expect(venueModalTitle).toBeVisible();

    // Verify bottom filter bar is HIDDEN while VenueModal is active (zero overlap!)
    const bottomBar = page.getByTestId('bottom-filter-bar');
    await expect(bottomBar).not.toBeVisible();

    // Take screenshot of VenueModal
    await page.screenshot({
      path: `test-results/venue-modal-${test.info().project.name}.png`,
      fullPage: true,
    });

    // Close VenueModal and verify bottom bar returns
    await page.getByRole('button', { name: /Zurück zur Karte/i }).click();
    await expect(bottomBar).toBeVisible();
  });

  test('Mobile Gestures: Swipe-up opens Bottom-Sheet and Swipe-down dismisses', async ({ page }) => {
    if (test.info().project.name !== 'mobile-chromium') {
      return;
    }

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const bottomBar = page.getByTestId('bottom-filter-bar');
    await expect(bottomBar).toBeVisible();

    // 1. Swipe UP on the bottom bar grab handle
    const grabHandle = bottomBar.getByRole('button', { name: /Filter & Suche nach oben ziehen/i });
    await expect(grabHandle).toBeVisible();

    await page.evaluate(() => {
      const handle = document.querySelector('button[aria-label*="Filter & Suche nach oben ziehen"]');

      if (!handle) {
        return;
      }

      const touchStart = new Touch({ identifier: 1, target: handle, clientX: 200, clientY: 700 });
      handle.dispatchEvent(new TouchEvent('touchstart', { touches: [touchStart], changedTouches: [touchStart], bubbles: true }));

      const touchMove = new Touch({ identifier: 1, target: handle, clientX: 200, clientY: 620 });
      handle.dispatchEvent(new TouchEvent('touchmove', { touches: [touchMove], changedTouches: [touchMove], bubbles: true }));

      handle.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [touchMove], bubbles: true }));
    });

    // Mobile Bottom Sheet should now be OPEN from the swipe gesture!
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: /Spiele anzeigen/i })).toBeVisible();

    // 2. Swipe DOWN on the sheet header to dismiss
    await page.evaluate(() => {
      const sheetHeader = document.querySelector('[role="dialog"] .cursor-grab');

      if (!sheetHeader) {
        return;
      }

      const touchStart = new Touch({ identifier: 2, target: sheetHeader, clientX: 200, clientY: 100 });
      sheetHeader.dispatchEvent(new TouchEvent('touchstart', { touches: [touchStart], changedTouches: [touchStart], bubbles: true }));

      const touchMove = new Touch({ identifier: 2, target: sheetHeader, clientX: 200, clientY: 260 });
      sheetHeader.dispatchEvent(new TouchEvent('touchmove', { touches: [touchMove], changedTouches: [touchMove], bubbles: true }));

      sheetHeader.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [touchMove], bubbles: true }));
    });

    // Sheet should smoothly dismiss
    await expect(sheet).not.toBeVisible();
    await expect(bottomBar).toBeVisible();
  });

  test('FilterBar: Filters work interactively (Gender toggle, Date selection, Reset)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const bottomBar = page.getByTestId('bottom-filter-bar');
    await expect(bottomBar).toBeVisible();

    // 1. Toggle "Damen" in Quick Chips
    const damenBtn = bottomBar.getByRole('button', { name: 'Damen' });
    await expect(damenBtn).toBeVisible();
    await damenBtn.click();

    // Verify Damen is now highlighted (active filter)
    await expect(damenBtn).toHaveClass(/border-primary/);

    // 2. Open sheet or use sidebar and change date to "Wochenende"
    if (test.info().project.name === 'mobile-chromium') {
      const filterBtn = bottomBar.getByRole('button', { name: /Filter/i }).first();
      await filterBtn.click();

      const sheet = page.getByRole('dialog');
      await expect(sheet).toBeVisible();

      // Click "Wochenende"
      await sheet.getByRole('button', { name: 'Wochenende' }).click();

      // Reset filters inside sheet
      await sheet.getByRole('button', { name: 'Zurücksetzen' }).first().click();

      // Close sheet
      await sheet.getByRole('button', { name: /Spiele anzeigen/i }).click();
    } else {
      // On desktop, click "Wochenende" in sidebar
      await page.getByRole('complementary').getByRole('button', { name: 'Wochenende' }).click();

      // Reset filters in sidebar
      await page.getByRole('button', { name: 'Zurücksetzen' }).first().click();
    }

    // Verify Damen is no longer selected after reset
    await expect(damenBtn).not.toHaveClass(/border-primary/);
  });

  test('FilterBar: Manual date range selection updates filter state and label', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    if (test.info().project.name === 'mobile-chromium') {
      const bottomBar = page.getByTestId('bottom-filter-bar');
      await bottomBar.getByRole('button', { name: /Filter/i }).first().click();

      const sheet = page.getByRole('dialog');
      await expect(sheet).toBeVisible();

      // Fill in custom date range
      const vonInput = sheet.getByLabel('Startdatum (Von)');
      const bisInput = sheet.getByLabel('Enddatum (Bis)');
      await expect(vonInput).toBeVisible();
      await expect(bisInput).toBeVisible();

      await vonInput.fill('2026-11-01');
      await bisInput.fill('2026-11-05');

      // Verify custom badge or display appears
      await expect(sheet.getByText('Eigener Zeitraum')).toBeVisible();

      // Close sheet
      await sheet.getByRole('button', { name: /Spiele anzeigen/i }).click();
      await expect(sheet).not.toBeVisible();

      // Bottom bar date chip should show the formatted date range
      await expect(bottomBar.getByRole('button', { name: /Nov/ }).last()).toBeVisible();
    } else {
      // On desktop, find the inputs in the sidebar
      const vonInput = page.getByLabel('Startdatum (Von)');
      const bisInput = page.getByLabel('Enddatum (Bis)');
      await expect(vonInput).toBeVisible();
      await expect(bisInput).toBeVisible();

      await vonInput.fill('2026-11-01');
      await bisInput.fill('2026-11-05');

      await expect(page.getByText('Eigener Zeitraum')).toBeVisible();

      // Docked bottom bar date chip should also reflect the range
      const bottomBar = page.getByTestId('bottom-filter-bar');
      await expect(bottomBar.getByRole('button', { name: /Nov/ }).last()).toBeVisible();
    }
  });
});
