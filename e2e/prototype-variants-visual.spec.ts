import { expect, test } from '@playwright/test';

test.describe('Filter Prototype Variants UI/UX Evaluation', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', lastSyncedAt: '2026-10-25T10:00:00Z' }),
      });
    });
  });

  test('Variant D (Favorit Hybrid): Bottom-Bar, Mobile Bottom-Sheet & Gear Settings', async ({ page }) => {
    await page.goto('/?variant=D');
    await page.waitForLoadState('networkidle');

    // 1. Verify Header Gear Icon is present
    const settingsBtn = page.getByRole('button', { name: /Einstellungen/i });
    await expect(settingsBtn).toBeVisible();

    // 2. Verify Bottom Quick-Filter Bar is visible
    const bottomBar = page.getByTestId('bottom-filter-bar');
    await expect(bottomBar).toBeVisible();
    await expect(bottomBar.getByText(/Heute|Termin/i).first()).toBeVisible();
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

    // Test switching to Capsule style
    await bottomBar.getByText(/Kapsel-Style/i).click();
    await expect(bottomBar.getByText(/Zu Dock-Ansicht/i)).toBeVisible();

    await page.screenshot({
      path: `test-results/variant-d-capsule-${test.info().project.name}.png`,
      fullPage: true,
    });

    // 3. Test Settings Dialog (Verify header and footer are NOT cut off on any screen)
    await settingsBtn.click();
    const settingsModal = page.getByRole('dialog', { name: /Einstellungen/i });
    await expect(settingsModal.getByRole('heading', { name: /Einstellungen & Optionen/i })).toBeVisible();
    await expect(settingsModal.getByText(/Karten-Engine/i)).toBeVisible();
    await expect(settingsModal.getByRole('button', { name: /Fertig/i })).toBeVisible();

    await page.screenshot({
      path: `test-results/settings-dialog-${test.info().project.name}.png`,
      fullPage: true,
    });

    // Close settings modal
    await settingsModal.getByRole('button', { name: /Fertig/i }).click();
  });

  test('Variant A: Quick-Filter Pill Bar on Map renders cleanly', async ({ page }) => {
    await page.goto('/?variant=A');
    await page.waitForLoadState('networkidle');

    // Verify Quick Filter Bar Pills are visible
    const barA = page.getByTestId('quick-filter-bar-a');
    await expect(barA.getByText(/Heute|Termin/i)).toBeVisible();
    await expect(barA.getByText('30 km')).toBeVisible();
    await expect(barA.getByPlaceholder(/Verein \/ Team/i)).toBeVisible();

    await page.screenshot({
      path: `test-results/variant-a-${test.info().project.name}.png`,
      fullPage: true,
    });
  });

  test('Variant B: Accordion Drawer opens and displays segmented controls', async ({ page }) => {
    await page.goto('/?variant=B');
    await page.waitForLoadState('networkidle');

    // Click Filter button in header or map summary
    const filterBtn = page.getByRole('button', { name: /Filter/i }).first();
    await filterBtn.click();

    // Verify Drawer header and accordions
    await expect(page.getByRole('heading', { name: /Filter \(Variante B\)/i })).toBeVisible();
    await expect(page.getByText(/Zielgruppe & Jugend/i)).toBeVisible();
    await expect(page.getByText(/Spielklassen & Einzel-Ligen/i)).toBeVisible();

    await page.screenshot({
      path: `test-results/variant-b-${test.info().project.name}.png`,
      fullPage: true,
    });
  });

  test('Variant C: Desktop Split-Sidebar & Mobile Bottom-Sheet renders cleanly', async ({ page }) => {
    await page.goto('/?variant=C');
    await page.waitForLoadState('networkidle');

    if (test.info().project.name === 'desktop-chromium') {
      // On desktop, the sidebar is permanently visible beside the map
      await expect(page.getByRole('heading', { name: /Filter-Sidebar \(Variante C\)/i })).toBeVisible();
    } else {
      // On mobile, trigger filter to open bottom sheet
      const filterBtn = page.getByRole('button', { name: /Filter/i }).first();
      await filterBtn.click();
      await expect(page.getByText(/Filter & Umkreis/i)).toBeVisible();
    }

    await page.screenshot({
      path: `test-results/variant-c-${test.info().project.name}.png`,
      fullPage: true,
    });
  });

  test('VenueModal: Opens when match is selected, hides bottom bar to prevent overlap', async ({ page }) => {
    // Navigate with a selected upcoming match (Sample match 102: Remigiussporthalle)
    await page.goto('/?variant=D&matchId=102');
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

    await page.goto('/?variant=D');
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

  test('Variant D: Filters work interactively (Gender toggle, Date selection, Reset)', async ({ page }) => {
    await page.goto('/?variant=D');
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
      await page.getByRole('button', { name: 'Wochenende' }).click();

      // Reset filters in sidebar
      await page.getByRole('button', { name: 'Zurücksetzen' }).first().click();
    }

    // Verify Damen is no longer selected after reset
    await expect(damenBtn).not.toHaveClass(/border-primary/);
  });

  test('Variant D: Manual date range selection updates filter state and label', async ({ page }) => {
    await page.goto('/?variant=D');
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
