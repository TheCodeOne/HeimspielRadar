import { expect, test } from '@playwright/test';
import type { CreateKioskSubmissionDto } from '@sundayleague/shared-types';

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
    matchDay: 4,
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
      kioskDescription: 'Waffeln, Kuchen, Cola & Kaffee',
      parkingNotes: 'Haupteingang über Pausenhof',
    },
    admissionFee: 'Eintritt frei',
    matchNotes: 'Einlass ab 17:15 Uhr',
    submitterName: 'Lena',
    submitterRole: 'Verein',
    result: null,
    confirmed: true,
    distanceKm: 2.1,
  },
  {
    id: 1002,
    leagueId: 1,
    league: MOCK_LEAGUES[0],
    matchDay: 4,
    kickoffDate: '2099-10-25',
    kickoffTime: '20:15',
    homeTeam: { id: 10, dbbId: 1010, name: 'MTV Stuttgart 2' },
    guestTeam: { id: 12, dbbId: 1012, name: 'VfL Waiblingen' },
    venue: {
      id: 502,
      name: 'Remigiussporthalle',
      street: 'Hechinger Straße 115',
      postalCode: '70567',
      city: 'Stuttgart-Möhringen',
      latitude: 48.7233,
      longitude: 9.1483,
      kioskDescription: null,
      parkingNotes: null,
    },
    admissionFee: '3,00 €',
    result: null,
    confirmed: true,
    distanceKm: 5.4,
  },
];

test.describe('Kiosk & Venue Info Badges and Submission Modal (Issue #103)', () => {
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

    await page.route(/\/api\/matches(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_MATCHES),
      });
    });

    await page.route('**/*.png', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64',
        ),
      });
    });
  });

  test('renders admission, kiosk, and parking badges on MatchCard without overlapping quick actions, and submits KioskSubmissionModal', async (
    { page },
    testInfo,
  ) => {
    let submittedPayload: CreateKioskSubmissionDto | null = null;
    let submittedMatchId: string | null = null;

    await page.route('**/api/submissions', async (route) => {
      // SAFETY: Request JSON matches CreateKioskSubmissionDto object structure
      submittedPayload = route.request().postDataJSON() as CreateKioskSubmissionDto;
      submittedMatchId = submittedPayload?.matchId ? String(submittedPayload.matchId) : null;

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 99, status: 'pending' }),
      });
    });

    await page.addInitScript(() => {
      window.localStorage.setItem(
        'heimspielradar:filters:v1',
        JSON.stringify({ viewMode: 'list', onlyUpcoming: false, dateMode: 'all' }),
      );
    });

    await page.goto('/');

    const card1001 = page.locator('[data-match-id="1001"]');
    await expect(card1001).toBeVisible();

    // 1. Verify Badges and Direct Info Tiles on Match 1001 (Eintritt frei, Kiosk, Parkhinweis)
    const admissionBadge1001 = card1001.locator('[data-badge="admission-fee"]');
    await expect(admissionBadge1001).toBeVisible();
    await expect(admissionBadge1001).toContainText('🎟️ Eintritt frei');

    // Direct Info Tiles visible without click
    const kioskTile1001 = card1001.locator('[data-tile="kiosk-info"]');
    await expect(kioskTile1001).toBeVisible();
    await expect(kioskTile1001).toContainText('Waffeln, Kuchen, Cola & Kaffee');

    const parkingTile1001 = card1001.locator('[data-tile="parking-notes"]');
    await expect(parkingTile1001).toBeVisible();
    await expect(parkingTile1001).toContainText('Haupteingang über Pausenhof');

    const notesTile1001 = card1001.locator('[data-tile="match-notes"]');
    await expect(notesTile1001).toBeVisible();
    await expect(notesTile1001).toContainText('Einlass ab 17:15 Uhr');

    const submitterTile1001 = card1001.locator('[data-tile="submitter-info"]');
    await expect(submitterTile1001).toBeVisible();
    await expect(submitterTile1001).toContainText('Gemeldet von Lena (Verein)');

    // Issue #152: Redundant badges 'kiosk-info' and 'parking-notes' are removed to reduce clutter
    await expect(card1001.locator('[data-badge="kiosk-info"]')).toHaveCount(0);
    await expect(card1001.locator('[data-badge="parking-notes"]')).toHaveCount(0);

    // 2. Verify Paid Admission Badge on Match 1002
    const card1002 = page.locator('[data-match-id="1002"]');
    await expect(card1002).toBeVisible();
    const admissionBadge1002 = card1002.locator('[data-badge="admission-fee"]');
    await expect(admissionBadge1002).toContainText('🎟️ Eintritt: 3,00 €');

    // 3. Verify zero overlap between [🌭 Kiosk- & Hallen-Info melden] and DBB Quick-Actions toolbar
    const reportBtn1001 = card1001.locator('[data-action="kiosk-submission"]');
    const quickActions1001 = card1001.getByRole('toolbar', { name: 'Match Quick-Actions' });
    await expect(reportBtn1001).toBeVisible();
    await expect(quickActions1001).toBeVisible();

    const reportBox = await reportBtn1001.boundingBox();
    const toolbarBox = await quickActions1001.boundingBox();
    expect(reportBox).not.toBeNull();
    expect(toolbarBox).not.toBeNull();

    if (reportBox && toolbarBox) {
      const horizontalOverlap =
        reportBox.x < toolbarBox.x + toolbarBox.width &&
        reportBox.x + reportBox.width > toolbarBox.x;

      const verticalOverlap =
        reportBox.y < toolbarBox.y + toolbarBox.height &&
        reportBox.y + reportBox.height > toolbarBox.y;

      expect(horizontalOverlap && verticalOverlap).toBe(false);
    }

    // 4. Click [🌭 Kiosk- & Hallen-Info melden] on Match 1002 and verify accessible form
    const reportBtn1002 = card1002.locator('[data-action="kiosk-submission"]');
    await card1002.scrollIntoViewIfNeeded();
    await reportBtn1002.evaluate((el: HTMLElement) => el.click());

    const modal = page.getByRole('dialog', { name: 'Kiosk- & Hallen-Info melden' });
    await expect(modal).toBeVisible();

    const feeInput = modal.getByLabel('Eintrittspreis');
    const kioskInput = modal.getByLabel('Verpflegung / Kioskangebot');
    const parkingInput = modal.getByLabel('Park- und Hallenhinweise');
    const nameInput = modal.getByLabel('Dein Name (optional)');
    const roleInput = modal.getByLabel('Deine Rolle (optional)');

    await expect(feeInput).toBeVisible();
    await expect(kioskInput).toBeVisible();
    await expect(parkingInput).toBeVisible();
    await expect(nameInput).toBeVisible();
    await expect(roleInput).toBeVisible();

    // Clear feeInput to test validation alert when all content fields are empty
    await feeInput.fill('');
    await modal.getByTestId('kiosk-submit-button').click();
    await expect(modal.getByRole('alert')).toBeVisible();

    // Fill out form fields
    await feeInput.fill('Eintritt frei');
    await kioskInput.fill('Kaffee & Kuchen, Waffeln, Kaltgetränke');
    await parkingInput.fill('Parkplätze direkt an der Hechinger Straße');
    await nameInput.fill('Sarah');
    await roleInput.fill('Trainerin');

    const isMobile = testInfo.project.name.includes('mobile');
    await page.screenshot({
      path: `test-results/verify-kiosk-modal-${isMobile ? 'mobile' : 'desktop'}-chromium.png`,
      fullPage: true,
    });

    await modal.getByTestId('kiosk-submit-button').click();

    // Verify modal closed and feedback toast is visible
    await expect(modal).toBeHidden();
    expect(submittedMatchId).toBe('1002');
    expect(submittedPayload).toEqual({
      matchId: 1002,
      admissionFee: 'Eintritt frei',
      kioskDescription: 'Kaffee & Kuchen, Waffeln, Kaltgetränke',
      parkingNotes: 'Parkplätze direkt an der Hechinger Straße',
      submitterName: 'Sarah',
      submitterRole: 'Trainerin',
      scope: 'matchday',
    });

    const toast = page.getByRole('status');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(
      'Vielen Dank! Deine Info wurde an die Moderation übermittelt und wird in Kürze freigeschaltet.',
    );
  });

  test('displays badges and opens KioskSubmissionModal inside Map Venue Overlay', async (
    { page },
    testInfo,
  ) => {
    await page.route('**/api/submissions', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 100, status: 'pending' }),
      });
    });

    await page.addInitScript(() => {
      window.localStorage.setItem(
        'heimspielradar:filters:v1',
        JSON.stringify({ viewMode: 'map', onlyUpcoming: false }),
      );
    });

    await page.goto('/?matchId=1001');

    const venueModal = page.getByRole('dialog', { name: 'Sporthalle West' });
    await expect(venueModal).toBeVisible({ timeout: 10000 });

    await expect(venueModal.locator('[data-badge="admission-fee"]')).toContainText(
      '🎟️ Eintritt frei',
    );
    await expect(venueModal.locator('[data-tile="kiosk-info"]')).toContainText(
      'Waffeln, Kuchen, Cola & Kaffee',
    );
    await expect(venueModal.locator('[data-tile="parking-notes"]')).toContainText(
      'Haupteingang über Pausenhof',
    );
    await expect(venueModal.locator('[data-badge="kiosk-info"]')).toHaveCount(0);
    await expect(venueModal.locator('[data-badge="parking-notes"]')).toHaveCount(0);

    const isMobile = testInfo.project.name.includes('mobile');
    await page.screenshot({
      path: `test-results/verify-${isMobile ? 'mobile' : 'desktop'}-chromium.png`,
      fullPage: true,
    });

    const reportBtn = venueModal.locator('[data-action="kiosk-submission"]').first();
    await expect(reportBtn).toBeVisible();
    await reportBtn.click();

    const submissionModal = page.getByRole('dialog', {
      name: 'Kiosk- & Hallen-Info melden',
    });

    await expect(submissionModal).toBeVisible();
    await submissionModal.getByTestId('kiosk-submit-button').click();

    await expect(submissionModal).toBeHidden();
    await expect(page.getByRole('status')).toContainText(
      'Vielen Dank! Deine Info wurde an die Moderation übermittelt und wird in Kürze freigeschaltet.',
    );
  });

  test('displays info indicator badge on map pins across all 4 map engines when match has venue/kiosk info', async ({
    page,
  }) => {
    // Return single venue with info so nearby venues do not cluster at default zoom level
    await page.route(/\/api\/matches(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_MATCHES[0]]),
      });
    });

    const engines = ['openlayers', 'maplibre', 'leaflet', 'pigeon'] as const;

    for (const engine of engines) {
      await page.addInitScript((eng) => {
        window.localStorage.setItem(
          'heimspielradar:filters:v1',
          JSON.stringify({
            viewMode: 'map',
            mapEngine: eng,
            onlyUpcoming: false,
            dateMode: 'all',
          }),
        );
      }, engine);

      await page.goto('/');

      // Match 1001 has kiosk/parking info -> Pin should have pin-info-badge / info indicator
      const infoIndicator = page.locator('[data-testid="pin-info-indicator"]').first();
      await expect(infoIndicator).toBeVisible({ timeout: 10000 });
      await expect(infoIndicator).toHaveText('ℹ️');
    }
  });

  test('Issue #244: queues submission when offline or network fails, displays pending badge, and syncs via SettingsView', async ({
    page,
  }) => {
    let syncCallCount = 0;

    // Fail POST submissions initially with network error to simulate failure
    await page.route('**/api/submissions', async (route) => {
      syncCallCount++;

      if (syncCallCount === 1) {
        await route.abort('failed');
      } else {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 101, status: 'pending' }),
        });
      }
    });

    await page.addInitScript(() => {
      window.localStorage.setItem(
        'heimspielradar:filters:v1',
        JSON.stringify({ viewMode: 'list', onlyUpcoming: false, dateMode: 'all' }),
      );
    });

    await page.goto('/');

    // Locate first match card and click report kiosk info
    const matchCard = page.locator('[data-match-id="1001"]').first();
    await expect(matchCard).toBeVisible({ timeout: 10000 });

    const reportButton = matchCard.locator('[data-action="kiosk-submission"]');
    await expect(reportButton).toBeVisible();
    await reportButton.click();

    const submissionModal = page.getByRole('dialog', {
      name: 'Kiosk- & Hallen-Info melden',
    });

    await expect(submissionModal).toBeVisible();

    // Fill in something and submit
    await page.getByRole('button', { name: '2,00 €' }).click();
    await submissionModal.getByTestId('kiosk-submit-button').click();

    await expect(submissionModal).toBeHidden();

    // Verify offline toast feedback
    const toast = page.getByRole('status');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(
      'Offline gespeichert – deine Info wird automatisch gesendet, sobald du wieder Empfang hast.',
    );

    // Verify "Info ausstehend (Offline)" badge appears on MatchCard
    const pendingBadge = matchCard.locator('[data-testid="kiosk-offline-pending-badge"]');
    await expect(pendingBadge).toBeVisible();
    await expect(pendingBadge).toContainText('Info ausstehend (Offline)');

    // Navigate to /settings
    await page.goto('/settings');

    const queueSection = page.locator('[data-testid="settings-offline-queue-section"]');
    await expect(queueSection).toBeVisible();

    const countBadge = queueSection.locator('[data-testid="offline-queue-count-badge"]');
    await expect(countBadge).toHaveText('1');

    const queueItem = queueSection.locator('[data-testid="offline-queue-item"]');
    await expect(queueItem).toBeVisible();
    await expect(queueItem).toContainText('MTV Stuttgart 1843 vs. SV Möhringen');
    await expect(queueItem).toContainText('2,00 €');

    // Click "Jetzt synchronisieren"
    const syncButton = queueSection.locator('[data-testid="sync-offline-queue-button"]');
    await expect(syncButton).toBeEnabled();
    await syncButton.click();

    // Verify count updates to 0 and empty state renders
    await expect(countBadge).toHaveText('0');
    await expect(queueSection.locator('[data-testid="offline-queue-empty-state"]')).toBeVisible();

    // Navigate back to match list
    await page.goto('/');
    await expect(matchCard).toBeVisible();
    await expect(matchCard.locator('[data-testid="kiosk-offline-pending-badge"]')).toHaveCount(0);
  });

  test('Issue #244: allows discarding individual queued offline submissions in SettingsView', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'heimspielradar:kiosk-queue:v1',
        JSON.stringify([
          {
            matchId: 1002,
            matchTitle: 'MTV Stuttgart 2 vs. VfL Waiblingen',
            venueName: 'Remigiussporthalle',
            payload: {
              admissionFee: '4,00 €',
              kioskDescription: 'Brezeln',
              scope: 'matchday',
            },
            queuedAt: new Date().toISOString(),
            retryCount: 0,
          },
        ]),
      );
    });

    await page.goto('/settings');

    const queueSection = page.locator('[data-testid="settings-offline-queue-section"]');
    await expect(queueSection).toBeVisible();
    await expect(queueSection.locator('[data-testid="offline-queue-count-badge"]')).toHaveText('1');

    const discardBtn = queueSection.locator('[data-testid="discard-queue-item-button"]').first();
    await expect(discardBtn).toBeVisible();
    await discardBtn.click();

    await expect(queueSection.locator('[data-testid="offline-queue-count-badge"]')).toHaveText('0');
    await expect(queueSection.locator('[data-testid="offline-queue-empty-state"]')).toBeVisible();
  });
});
