import { expect, test } from '@playwright/test';

test.describe('Filter Prototype Variants UI/UX Evaluation', () => {
  test('Variant A: Quick-Filter Pill Bar on Map renders cleanly', async ({ page }) => {
    await page.goto('/?variant=A');
    await page.waitForLoadState('networkidle');

    // Verify Prototype Switcher is visible
    const switcher = page.getByText(/Variante A: Quick-Filter Bar/i);
    await expect(switcher).toBeVisible();

    // Verify Quick Filter Bar Pills are visible
    await expect(page.getByText(/Heute|Termin/i)).toBeVisible();
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
