import { expect, test } from '@playwright/test';

const MOCK_MATCH = {
  id: 42131,
  leagueId: 1,
  league: {
    id: 1,
    dbbId: 50001,
    name: 'Oberliga Württemberg Herren',
    skName: 'Oberliga',
    akName: 'Senioren',
    geschlecht: 'männlich',
  },
  matchDay: 5,
  matchNo: 502,
  kickoffDate: '2026-11-20',
  kickoffTime: '19:30',
  homeTeam: { id: 10, dbbId: 1010, name: 'TSG Stuttgart' },
  guestTeam: { id: 11, dbbId: 1011, name: 'MTV Ludwigsburg' },
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
  confirmed: true,
  distanceKm: 2.1,
};

test.describe('Match Sharing & Standalone Detail Page (/matches/:id)', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept backend API requests
    await page.route('**/api/matches/42131', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_MATCH),
      });
    });

    await page.route('**/api/matches?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_MATCH]),
      });
    });

    await page.route('**/api/leagues', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_MATCH.league]),
      });
    });
  });

  test('standalone detail page loads and renders polished ticket view', async ({ page }) => {
    await page.goto('/matches/42131');

    // 1. Ticket View Elements
    await expect(page.getByText('TSG Stuttgart')).toBeVisible();
    await expect(page.getByText('MTV Ludwigsburg')).toBeVisible();
    await expect(page.getByText('← Zum Heimspielradar')).toBeVisible();
    await expect(page.getByText('HeimspielRadar Ticket')).toBeVisible();

    // 2. Map and Venue details visible in ticket
    await expect(page.getByText('Sporthalle West')).toBeVisible();

    // 3. Take screenshot for visual inspection
    await page.screenshot({ path: `test-results/ticket-view-${test.info().project.name}.png` });

    // 4. Verify no vertical scrolling is present on root/html/body
    const isScrollable = await page.evaluate(() => {
      return document.documentElement.scrollHeight > document.documentElement.clientHeight;
    });

    expect(isScrollable).toBe(false);

    // 5. Back button returns to /
    await page.getByRole('button', { name: '← Zum Heimspielradar' }).click();
    await expect(page).toHaveURL(/\/?$/);
  });

  test('MatchQuickActions share button copies match link to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/matches/42131');
    await expect(page.getByText('TSG Stuttgart')).toBeVisible();

    const shareBtn = page.locator('button[data-action="share"]').first();
    await expect(shareBtn).toBeVisible();
    await shareBtn.click();

    // Verify copy feedback
    await expect(page.getByText('Link zum Spiel in die Zwischenablage kopiert!')).toBeVisible();
  });
});
