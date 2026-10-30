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

  test('standalone detail page loads and renders all 3 variants', async ({ page }) => {
    await page.goto('/matches/42131');

    // 1. Initial Variant A (Split View)
    await expect(page.getByText('TSG Stuttgart')).toBeVisible();
    await expect(page.getByText('MTV Ludwigsburg')).toBeVisible();
    await expect(page.getByText('Zur Übersicht / Alle Spiele')).toBeVisible();
    await expect(page.getByText('Austragungsort')).toBeVisible();

    // 2. Switch to Variant B (Hero-Map)
    await page.getByRole('button', { name: 'B: Hero-Map' }).click();
    await expect(page.getByRole('button', { name: 'B: Hero-Map' })).toHaveClass(/bg-primary/);

    // 3. Switch to Variant C (Ticket)
    await page.getByRole('button', { name: 'C: Ticket' }).click();
    await expect(page.getByText('MATCHDAY TICKET')).toBeVisible();
    await expect(page.getByText('Spiel weiterleiten')).toBeVisible();

    // 4. Back button returns to /
    await page.getByRole('button', { name: 'Zur Übersicht / Alle Spiele' }).click();
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
