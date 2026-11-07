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
    matchDay: 5,
    matchNo: 901,
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
  {
    id: 9002,
    leagueId: 1,
    league: MOCK_LEAGUES[0],
    matchDay: 5,
    matchNo: 902,
    kickoffDate: '2026-11-08',
    kickoffTime: '17:00',
    confirmed: true,
    homeTeam: {
      id: 103,
      dbbId: 1003,
      name: 'TSV Lustnau',
      shortName: 'Lustnau',
    },
    guestTeam: {
      id: 104,
      dbbId: 1004,
      name: 'SpVgg Mössingen',
      shortName: 'Mössingen',
    },
    venue: {
      id: 502,
      name: 'Uhlandhalle Tübingen',
      street: 'Uhlandstr. 2',
      postalCode: '72072',
      city: 'Tübingen',
      latitude: 48.5200,
      longitude: 9.0550,
    },
  },
];

test.describe('Offline Caching & Offline Status Indicator', () => {
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

  test('displays offline status banner when disconnected and keeps saved matches intact', async ({
    page,
    context,
  }) => {
    // 1. Initial online load
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Matches should be loaded and reflected in match count
    const visibleMatchCount = page.locator(':visible').filter({ hasText: /2 Spiele/ }).first();
    await expect(visibleMatchCount).toBeVisible();

    // Offline indicator must not be visible when online
    const offlineIndicator = page.getByTestId('offline-indicator');
    await expect(offlineIndicator).not.toBeVisible();

    // 2. Simulate connection loss
    await context.setOffline(true);

    // Banner must become visible with exact specified copy
    await expect(offlineIndicator).toBeVisible();
    await expect(offlineIndicator).toContainText('Offline-Modus – gespeicherte Spiele aktiv');

    // 3. Saved matches remain loaded and intact offline without error
    await expect(visibleMatchCount).toBeVisible();

    // 4. Restore online connection
    await context.setOffline(false);

    // Banner hides once connection is restored
    await expect(offlineIndicator).not.toBeVisible();
  });
});
