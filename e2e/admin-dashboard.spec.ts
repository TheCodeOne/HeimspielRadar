import { expect, test } from '@playwright/test';

const MOCK_ADMIN_STATUS = {
  uptimeSeconds: 125430,
  nodeVersion: 'v22.2.0',
  memory: {
    heapUsedMb: 45.2,
    heapTotalMb: 92.5,
    rssMb: 120.8,
  },
  databaseConnected: true,
  telegramConfigured: true,
  activeSyncRun: null,
  lastSyncRun: {
    id: 1,
    syncType: 'delta',
    target: 'verband:1',
    startedAt: '2026-10-25T16:00:00.000Z',
    finishedAt: '2026-10-25T16:01:15.000Z',
    durationMs: 75000,
    totalLeagues: 25,
    successfulLeagues: 25,
    syncedMatches: 540,
    geocodedVenues: 12,
    failuresCount: 0,
    status: 'success',
    errorMessage: null,
    createdAt: '2026-10-25T16:00:00.000Z',
  },
};

const MOCK_SYNC_RUNS = [
  {
    id: 1,
    syncType: 'delta',
    target: 'verband:1',
    startedAt: '2026-10-25T16:00:00.000Z',
    finishedAt: '2026-10-25T16:01:15.000Z',
    durationMs: 75000,
    totalLeagues: 25,
    successfulLeagues: 25,
    syncedMatches: 540,
    geocodedVenues: 12,
    failuresCount: 0,
    status: 'success',
    errorMessage: null,
    createdAt: '2026-10-25T16:00:00.000Z',
  },
  {
    id: 2,
    syncType: 'deep',
    target: 'verband:31',
    startedAt: '2026-10-25T14:00:00.000Z',
    finishedAt: '2026-10-25T14:03:30.000Z',
    durationMs: 210000,
    totalLeagues: 10,
    successfulLeagues: 8,
    syncedMatches: 180,
    geocodedVenues: 4,
    failuresCount: 2,
    status: 'partial',
    errorMessage: 'DBB API timeout on 2 leagues',
    createdAt: '2026-10-25T14:00:00.000Z',
  },
];

const MOCK_FAILURES = [
  {
    id: 101,
    entityType: 'league',
    dbbLeagueId: 53941,
    leagueName: 'Oberliga Herren BaWü',
    dbbMatchId: null,
    verbandId: 1,
    errorMessage: 'DBB API HTTP 504 Gateway Timeout',
    retryCount: 1,
    failedAt: '2026-10-25T14:02:10.000Z',
    updatedAt: '2026-10-25T14:02:10.000Z',
  },
];

test.describe('HeimspielRadar Pi Admin Dashboard (/admin)', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept Admin APIs
    await page.route('**/api/admin/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ADMIN_STATUS),
      });
    });

    await page.route('**/api/admin/sync-runs*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SYNC_RUNS),
      });
    });

    await page.route('**/api/admin/failures', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_FAILURES),
      });
    });
  });

  test('renders admin dashboard with system metrics, action bar, failures and sync runs', async ({
    page,
  }, testInfo) => {
    await page.goto('/admin');

    // 1. Verify Header
    await expect(page.locator('h1')).toContainText('HeimspielRadar Pi Admin');
    await expect(page.getByText('Raspberry Pi Scraper & Observability Dashboard')).toBeVisible();

    // 2. Verify System Status Cards
    await expect(page.getByText('Systemlaufzeit')).toBeVisible();
    await expect(page.getByText('Arbeitsspeicher (Heap)')).toBeVisible();
    await expect(page.getByText('45.2 MB')).toBeVisible();
    await expect(page.getByText('Datenbank (PostgreSQL)')).toBeVisible();
    await expect(page.getByText('Verbunden')).toBeVisible();
    await expect(page.getByText('Telegram Alerting')).toBeVisible();
    await expect(page.getByText('Aktiv', { exact: true })).toBeVisible();

    // 3. Verify Quick Action Bar
    await expect(page.getByText('Aktionen & Manuelle Synchronisation')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sync starten' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fehler wiederholen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Telegram Test' })).toBeVisible();

    // 4. Verify Active Failures
    await expect(page.getByText('Aktive Fehler (sync_failures)')).toBeVisible();
    await expect(page.getByText('Oberliga Herren BaWü')).toBeVisible();
    await expect(page.getByText('DBB API HTTP 504 Gateway Timeout')).toBeVisible();

    // 5. Verify Sync Runs Table
    await expect(page.getByText('Sync-Protokoll (sync_runs)')).toBeVisible();
    await expect(page.getByText('Verband 1 (BaWü)')).toBeVisible();
    await expect(page.getByText('Verband 31 (Regio SW)')).toBeVisible();

    // 6. Test Telegram Test action
    await page.route('**/api/admin/telegram/test', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Test message sent' }),
      });
    });

    await page.getByRole('button', { name: 'Telegram Test' }).click();
    await expect(page.getByText('Telegram Testnachricht erfolgreich versendet!')).toBeVisible();

    // 7. Visual screenshot capture
    const projectName = testInfo.project.name;
    const screenshotPath = `test-results/verify-admin-${projectName}.png`;

    await page.screenshot({ path: screenshotPath, fullPage: false });
  });

  test('triggers background sync and shows success feedback', async ({ page }) => {
    await page.route('**/api/admin/sync/trigger', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, runId: 42, status: 'running' }),
      });
    });

    await page.goto('/admin');

    await page.getByRole('button', { name: 'Sync starten' }).click();

    await expect(
      page.getByText('Sync für "verband:1" erfolgreich im Hintergrund gestartet.')
    ).toBeVisible();
  });
});
