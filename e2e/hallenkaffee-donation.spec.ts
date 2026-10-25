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
    matchDay: 1,
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

test.describe('Hallenkaffee Donation & Transparency Integration', () => {
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
  });

  test('displays header coffee button and filter drawer supporter card with correct links', async ({
    page,
  }, testInfo) => {
    await page.goto('/?legacy=true');

    // 1. Header Coffee Button
    const headerCoffeeButton = page.getByRole('link', {
      name: /Hallenkaffee spendieren \(Serverkosten unterstützen\)/i,
    });

    await expect(headerCoffeeButton).toBeVisible();
    await expect(headerCoffeeButton).toHaveAttribute(
      'href',
      'https://buymeacoffee.com/dimi.kokkonias',
    );
    await expect(headerCoffeeButton).toHaveAttribute('target', '_blank');
    await expect(headerCoffeeButton).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(headerCoffeeButton).toHaveAttribute(
      'title',
      'Hallenkaffee spendieren (Serverkosten unterstützen)',
    );

    const projectName = testInfo.project.name;
    const isMobile = projectName.includes('mobile');

    // On desktop, "Hallenkaffee" text is visible; on mobile, it is hidden to prevent layout shift
    const hallenkaffeeText = headerCoffeeButton.locator('span.hidden.sm\\:inline');

    if (isMobile) {
      await expect(hallenkaffeeText).toBeHidden();
    } else {
      await expect(hallenkaffeeText).toBeVisible();
      await expect(hallenkaffeeText).toHaveText('Hallenkaffee');
    }

    // Capture initial header & viewport screenshot
    await page.screenshot({
      path: `test-results/verify-${projectName}.png`,
    });

    // 2. Open Filter Drawer
    const filterButton = page.getByRole('button', { name: 'Filter', exact: true });

    await filterButton.click();

    const drawer = page.getByRole('dialog', { name: 'Filtereinstellungen' });
    await expect(drawer).toBeVisible();

    // 3. Supporter Card in Drawer
    const supporterCardTitle = drawer.getByText('Gefällt dir HeimspielRadar?');
    await expect(supporterCardTitle).toBeVisible();

    const supporterCardDesc = drawer.getByText(
      /Wir sind 100% werbefrei und Open Source\. Hilf uns, die Server am Laufen zu halten!/i,
    );

    await expect(supporterCardDesc).toBeVisible();

    // 4. Drawer Donation Link
    const drawerDonationLink = drawer.getByRole('link', {
      name: /Einen Kaffee spendieren/i,
    });

    await expect(drawerDonationLink).toBeVisible();
    await expect(drawerDonationLink).toHaveAttribute(
      'href',
      'https://buymeacoffee.com/dimi.kokkonias',
    );
    await expect(drawerDonationLink).toHaveAttribute('target', '_blank');
    await expect(drawerDonationLink).toHaveAttribute('rel', 'noopener noreferrer');

    // 5. Drawer Transparency Link
    const transparencyLink = drawer.getByRole('link', {
      name: /Finanzen einsehen \(TRANSPARENCY\.md\)/i,
    });

    await expect(transparencyLink).toBeVisible();
    await expect(transparencyLink).toHaveAttribute(
      'href',
      'https://github.com/TheCodeOne/HeimspielRadar/blob/main/TRANSPARENCY.md',
    );
    await expect(transparencyLink).toHaveAttribute('target', '_blank');
    await expect(transparencyLink).toHaveAttribute('rel', 'noopener noreferrer');

    // Capture drawer screenshot
    await page.screenshot({
      path: `test-results/verify-${projectName}-drawer.png`,
    });
  });

  test('displays header coffee button on default bottom-sheet layout (Variant D)', async ({
    page,
  }) => {
    await page.goto('/');

    const headerCoffeeButton = page.getByRole('link', {
      name: /Hallenkaffee spendieren \(Serverkosten unterstützen\)/i,
    });

    await expect(headerCoffeeButton).toBeVisible();
    await expect(headerCoffeeButton).toHaveAttribute(
      'href',
      'https://buymeacoffee.com/dimi.kokkonias',
    );
  });
});
