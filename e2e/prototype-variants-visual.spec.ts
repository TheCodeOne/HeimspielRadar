import { expect, test } from '@playwright/test';

test.describe('Filter Prototype Variants UI/UX Evaluation', () => {
  test('Variant D (Favorit Hybrid): Bottom-Bar, Mobile Bottom-Sheet & Gear Settings', async ({ page }) => {
    await page.goto('/?variant=D');
    await page.waitForLoadState('networkidle');

    // 1. Verify Header Gear Icon is present
    const settingsBtn = page.getByRole('button', { name: /Einstellungen/i });
    await expect(settingsBtn).toBeVisible();

    // 2. Verify Bottom Quick-Filter Bar is visible
    const bottomBar = page.getByTestId('bottom-filter-bar');
    await expect(bottomBar).toBeVisible();
    await expect(bottomBar.getByText(/Heute|Termin/i)).toBeVisible();
    await expect(bottomBar.getByText(/30 km/i)).toBeVisible();
    await expect(bottomBar.getByText(/Verein suchen.../i)).toBeVisible();

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
    }

    await page.screenshot({
      path: `test-results/variant-d-${test.info().project.name}.png`,
      fullPage: true,
    });

    // 3. Test Settings Dialog
    if (test.info().project.name === 'desktop-chromium') {
      await settingsBtn.click();
      const settingsModal = page.getByRole('dialog');
      await expect(settingsModal.getByRole('heading', { name: /Einstellungen & Optionen/i })).toBeVisible();
      await expect(settingsModal.getByText(/Karten-Engine/i)).toBeVisible();
      await expect(settingsModal.getByText(/OpenLayers/i).first()).toBeVisible();
      await expect(settingsModal.getByText(/MapLibre GL/i)).toBeVisible();

      await page.screenshot({
        path: `test-results/settings-dialog-${test.info().project.name}.png`,
        fullPage: true,
      });

      // Close settings modal
      await settingsModal.getByRole('button', { name: /Fertig/i }).click();
    }
  });

  test('Variant A: Quick-Filter Pill Bar on Map renders cleanly', async ({ page }) => {
    await page.goto('/?variant=A');
    await page.waitForLoadState('networkidle');

    // Verify Quick Filter Bar Pills are visible
    await expect(page.getByText(/Heute|Termin/i).first()).toBeVisible();
    await expect(page.getByText('30 km')).toBeVisible();
    await expect(page.getByPlaceholder(/Verein \/ Team/i)).toBeVisible();

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
});
