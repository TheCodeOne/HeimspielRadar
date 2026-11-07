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
  homeTeam: { id: 10, dbbId: 1010, name: 'SV 03 Tübingen' },
  guestTeam: { id: 11, dbbId: 1011, name: 'MTV Ludwigsburg' },
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
  confirmed: true,
  distanceKm: 2.1,
};

test.describe('Issue #226: ClubStoryHub match loading, prompt state and localStorage persistence', () => {
  test('renders prompt state and does not fetch /api/matches when no club selected', async ({ page }) => {
    let apiMatchesCalled = false;

    await page.route('**/api/matches?*', async (route) => {
      apiMatchesCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_MATCH]),
      });
    });

    await page.goto('/story');

    // Onboarding prompt is visible
    const prompt = page.getByTestId('story-onboarding-prompt');
    await expect(prompt).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Wähle oben deinen Verein oder dein Team aus' })
    ).toBeVisible();

    // Result tabs are hidden
    await expect(page.getByRole('button', { name: 'Anstehende Spiele' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Letzte Ergebnisse' })).not.toBeVisible();

    // Verify /api/matches was not called
    expect(apiMatchesCalled).toBe(false);
  });

  test('fetches matches when team is selected, persists in localStorage, and clears properly', async ({ page }) => {
    await page.route('**/api/matches/teams?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 10,
            name: 'SV 03 Tübingen',
            shortName: 'SV 03',
            clubId: 50,
          },
        ]),
      });
    });

    await page.route('**/api/matches?teamQuery=*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_MATCH]),
      });
    });

    await page.goto('/story');

    // Type query into search input
    const searchInput = page.getByPlaceholder('Verein suchen');
    await searchInput.fill('Tübingen');

    // Suggestion dropdown should appear
    const suggestion = page.getByRole('option', { name: /SV 03 Tübingen/i }).first();
    await expect(suggestion).toBeVisible();
    await suggestion.click();

    // Onboarding prompt disappears and tabs become visible
    await expect(page.getByTestId('story-onboarding-prompt')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Anstehende Spiele' })).toBeVisible();
    await expect(page.getByText('Uhlandhalle')).toBeVisible();

    // Check localStorage persistence
    const savedClub = await page.evaluate(() => {
      return localStorage.getItem('heimspielradar:story-club:v1');
    });

    expect(savedClub).toBe('SV 03 Tübingen');

    // Reload page to verify persistence
    await page.reload();

    await expect(page.getByTestId('story-onboarding-prompt')).not.toBeVisible();
    await expect(searchInput).toHaveValue('SV 03 Tübingen');
    await expect(page.getByText('Uhlandhalle')).toBeVisible();

    // Clear club selection using the clear button in search input
    const clearBtn = page.getByRole('button', { name: /Zurücksetzen/i });
    await clearBtn.click();

    // Onboarding prompt should reappear
    await expect(page.getByTestId('story-onboarding-prompt')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anstehende Spiele' })).not.toBeVisible();

    // localStorage should now be empty string
    const clearedClub = await page.evaluate(() => {
      return localStorage.getItem('heimspielradar:story-club:v1');
    });

    expect(clearedClub).toBe('');

    // Reload again — should stay empty and NOT fall back
    await page.reload();
    await expect(page.getByTestId('story-onboarding-prompt')).toBeVisible();
    await expect(searchInput).toHaveValue('');
  });

  test('falls back to loadPersistedFilters().teamQuery if story-club is never set', async ({ page }) => {
    await page.addInitScript(() => {
      // Simulate persisted filter with teamQuery using FILTER_STORAGE_KEY ('heimspielradar:filters:v1')
      localStorage.setItem(
        'heimspielradar:filters:v1',
        JSON.stringify({
          version: 1,
          teamQuery: 'TSG Reutlingen',
          viewMode: 'map',
          dateMode: 'all',
          radiusKm: 30,
        })
      );
    });

    await page.route('**/api/matches?teamQuery=*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            ...MOCK_MATCH,
            homeTeam: { id: 20, dbbId: 2020, name: 'TSG Reutlingen' },
          },
        ]),
      });
    });

    await page.goto('/story');

    const searchInput = page.getByPlaceholder('Verein suchen');
    await expect(searchInput).toHaveValue('TSG Reutlingen');
    await expect(page.getByTestId('story-onboarding-prompt')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Anstehende Spiele' })).toBeVisible();
  });
});
