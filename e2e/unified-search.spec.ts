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
    id: 1001,
    leagueId: 1,
    league: MOCK_LEAGUES[0],
    matchDay: 4,
    kickoffDate: '2099-10-25',
    kickoffTime: '18:00',
    homeTeam: { id: 10, dbbId: 1010, name: 'SV 03 Tübingen' },
    guestTeam: { id: 11, dbbId: 1011, name: 'SV Pfrondorf' },
    venue: {
      id: 501,
      name: 'Uhlandhalle',
      street: 'Uhlandstraße 28',
      postalCode: '72072',
      city: 'Tübingen',
      latitude: 48.5186,
      longitude: 9.0577,
    },
    result: null,
    confirmed: false,
    distanceKm: 2.1,
  },
];

test.describe('Issue #167: Unified Search (Location & Teams)', () => {
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
        body: JSON.stringify([
          {
            id: 101,
            name: 'SV 03 Tübingen',
            shortName: 'SV 03',
            clubId: 50,
            akName: 'Senioren',
            geschlecht: 'männlich',
          },
          {
            id: 102,
            name: 'Tigers Tübingen',
            shortName: 'Tigers',
            clubId: 51,
            akName: 'Senioren',
            geschlecht: 'männlich',
          },
          {
            id: 103,
            name: 'SV Pfrondorf',
            shortName: 'Pfrondorf',
            clubId: 60,
            akName: 'Senioren',
            geschlecht: 'männlich',
          },
        ]),
      });
    });

    await page.route(/\/api\/matches(?!\/teams)/, async (route) => {
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
          features: [
            {
              type: 'Feature',
              properties: {
                name: 'Tübingen',
                city: 'Tübingen',
                postcode: '72074',
                state: 'Baden-Württemberg',
                country: 'Deutschland',
              },
              geometry: {
                type: 'Point',
                coordinates: [9.0576, 48.5216],
              },
            },
          ],
        }),
      });
    });
  });

  test('displays unified search with both cities and teams sections, keyboard navigation, and exclusive selection', async (
    { page },
    testInfo,
  ) => {
    await page.goto('/');

    const isMobile = testInfo.project.name.includes('mobile');
    let drawer;

    if (isMobile) {
      const filterButton = page.getByTestId('bottom-filter-bar').getByRole('button', { name: 'Filter', exact: true });
      await filterButton.click();
      drawer = page.getByRole('dialog', { name: 'Filtereinstellungen' });
      await expect(drawer).toBeVisible();
    } else {
      drawer = page.locator('aside[aria-label="Filtereinstellungen"]');
      await expect(drawer).toBeVisible();
    }

    // 2. Check unified search input
    const searchInput = drawer.getByPlaceholder('Stadt, PLZ oder Verein suchen...');
    await expect(searchInput).toBeVisible();

    // Initially, active location chip is visible (Stuttgart default)
    const activeLocationChip = drawer.getByTestId('active-location-chip');
    await expect(activeLocationChip).toBeVisible();
    await expect(activeLocationChip).toContainText('📍 Stuttgart');
    await expect(activeLocationChip).toContainText('Radius:');

    // 3. Type "Tüb" to trigger both city suggestion (Tübingen) and team suggestions (SV 03 Tübingen, Tigers Tübingen)
    await searchInput.fill('Tüb');

    const dropdown = drawer.getByRole('listbox', {
      name: 'Suchvorschläge für Orte und Vereine',
    });

    await expect(dropdown).toBeVisible();

    // Verify both sections exist
    await expect(dropdown.getByText('Städte & Orte')).toBeVisible();
    await expect(dropdown.getByText('Vereine & Teams')).toBeVisible();

    // Verify city suggestion
    const cityOption = dropdown.getByRole('option', { name: /Tübingen/i }).first();
    await expect(cityOption).toBeVisible();

    // Verify team suggestions
    const teamOption = dropdown.getByRole('option', { name: /SV 03 Tübingen/i });
    await expect(teamOption).toBeVisible();

    // 4. Capture screenshot of open unified search dropdown (Desktop & Mobile)
    await page.screenshot({
      path: `test-results/unified-search-dropdown-${testInfo.project.name}.png`,
      animations: 'disabled',
    });

    // 5. Test keyboard navigation: ArrowDown to first option (city), ArrowDown again to team, Escape to close
    await searchInput.press('ArrowDown');
    await expect(cityOption).toHaveClass(/bg-primary\/15/);

    await searchInput.press('ArrowDown');
    await searchInput.press('ArrowDown');
    // Pressing Escape closes dropdown
    await searchInput.press('Escape');
    await expect(dropdown).toBeHidden();

    // 6. Test Exclusive Selection: City Selection
    await searchInput.fill('Tübingen');
    await expect(dropdown).toBeVisible();
    await cityOption.click();

    // Now active chip shows Tübingen with radius
    await expect(drawer.getByTestId('active-location-chip')).toBeVisible();
    await expect(drawer.getByTestId('active-location-chip')).toContainText('📍 Tübingen');
    await expect(drawer.getByTestId('active-location-chip')).toContainText(/Radius: \d+ km/);
    // Team chip must NOT be visible
    await expect(drawer.getByTestId('active-team-chip')).toBeHidden();

    // 7. Test Exclusive Selection: Switch to Team
    await searchInput.fill('Pfron');
    await expect(dropdown).toBeVisible();
    const pfrondorfOption = dropdown.getByRole('option', { name: /SV Pfrondorf/i });
    await expect(pfrondorfOption).toBeVisible();
    await pfrondorfOption.click();

    // Now active chip shows Team, city chip is cleared
    await expect(drawer.getByTestId('active-team-chip')).toBeVisible();
    await expect(drawer.getByTestId('active-team-chip')).toContainText('🏀 SV Pfrondorf');
    await expect(drawer.getByTestId('active-location-chip')).toBeHidden();

    // Context note is visible explaining radius filter is inactive for team search
    await expect(
      drawer.getByText(/Alle Spiele von SV Pfrondorf werden überregional angezeigt/i),
    ).toBeVisible();

    // Take screenshot of selected team state
    await page.screenshot({
      path: `test-results/unified-search-team-selected-${testInfo.project.name}.png`,
      animations: 'disabled',
    });

    // 8. Test clearing team via [x] button on chip -> restores city filter
    const clearTeamButton = drawer.getByLabel('Vereinsfilter entfernen');
    await clearTeamButton.click();

    await expect(drawer.getByTestId('active-team-chip')).toBeHidden();
    await expect(drawer.getByTestId('active-location-chip')).toBeVisible();

    // 9. Close drawer if mobile
    if (isMobile) {
      await drawer.getByRole('button', { name: /Schließen/i }).click();
      await expect(drawer).toBeHidden();
    }
  });
});
