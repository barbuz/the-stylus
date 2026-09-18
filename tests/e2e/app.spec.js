import { test, expect } from '@playwright/test';

import { installStubs, sampleSpreadsheet } from './stubs.js';

const POD_ID = 'POD_SHEET_ID';
const POD_URL = `https://docs.google.com/spreadsheets/d/${POD_ID}/edit`;

/**
 * Keep the app fully offline: the Google CDN scripts are neutralised so they
 * cannot overwrite the stub, and the UserInfo endpoint is answered locally.
 */
async function isolateNetwork(page) {
    await page.route('**/apis.google.com/**', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.route('**/accounts.google.com/**', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.route('**/openidconnect.googleapis.com/**', route => route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ email: 'alice@example.com' })
    }));
    await page.route('**/api.scryfall.com/**', route => route.fulfill({ contentType: 'application/json', body: '{}' }));
}

async function bootApp(page, { preferences = { guruSignature: 'alice', recentPods: [], recentHubs: [] } } = {}) {
    await isolateNetwork(page);
    await installStubs(page, { spreadsheet: sampleSpreadsheet(), preferences });
    await page.goto('/index.html');
}

/** Sign in and wait for the pod URL input to be available. */
async function signIn(page) {
    await page.getByRole('button', { name: /sign in with google/i }).click();
    await expect(page.locator('#app-content')).toBeVisible();
    await expect(page.locator('#sheet-url')).toBeVisible();
}

async function loadPod(page, url = POD_URL) {
    await page.locator('#sheet-url').fill(url);
    await page.locator('#load-sheet-btn').click();
    await expect(page.locator('#sheet-editor')).toBeVisible();
}

test.describe('The Stylus (no Google, no network)', () => {
    test('shows the login screen when not authenticated', async ({ page }) => {
        await bootApp(page);

        await expect(page.locator('#login-section')).toBeVisible();
        await expect(page.locator('#app-content')).toBeHidden();
    });

    test('signs in and restores the guru signature from appData', async ({ page }) => {
        await bootApp(page);

        await signIn(page);

        // The signature came from the stubbed Drive appData preferences, which
        // means the signature section is skipped in favour of the pod input.
        await expect(page.locator('#guru-signature-section')).toBeHidden();
        await expect(page.locator('#sheet-input-section')).toBeVisible();
        await expect(page.locator('#guru-signature-display')).toHaveText('alice');
    });

    test('loads a pod and renders the first match awaiting the guru', async ({ page }) => {
        await bootApp(page);
        await signIn(page);

        await loadPod(page);

        // Row 1 is alice's and unscored, so it is the first match to analyse.
        await expect(page.locator('#current-row-info')).toHaveText('Match 1 of 4');
        await expect(page.locator('#current-analysis-value')).toContainText('Incomplete');
    });

    test('scoring a match writes to the correct cell on the guru sheet', async ({ page }) => {
        await bootApp(page);
        await signIn(page);
        await loadPod(page);

        // The merged sheet's Red Analysis column must map back to column E of
        // the Red Gurus sheet, on the original (unfiltered) row.
        await page.locator('#win-btn').click();

        await expect(page.locator('#status-message')).toContainText('Analysis saved: Win');
        await expect.poll(() => page.evaluate(() => window.__stylus.getCell('Red Gurus', 2, 5))).toBe('1');
    });

    test('navigation moves between matches and reflects claim state', async ({ page }) => {
        await bootApp(page);
        await signIn(page);
        await loadPod(page);

        // Match 1 is claimed by alice and can be scored directly.
        await expect(page.locator('#win-btn')).toBeVisible();
        await expect(page.locator('#claim-button')).toBeHidden();

        await page.locator('#next-btn').click();
        await expect(page.locator('#current-row-info')).toHaveText('Match 2 of 4');

        // Match 3 is unclaimed: it must be claimed before scoring.
        await page.locator('#next-btn').click();
        await expect(page.locator('#current-row-info')).toHaveText('Match 3 of 4');
        await expect(page.locator('#claim-button')).toBeVisible();
        await expect(page.locator('#win-btn')).toBeHidden();
    });

    test('rejects an invalid pod URL without contacting Google', async ({ page }) => {
        await bootApp(page);
        await signIn(page);

        const requestsBefore = await page.evaluate(() => window.__stylus.getRequests().length);

        await page.locator('#sheet-url').fill('https://example.com/not-a-sheet');
        await page.locator('#load-sheet-btn').click();

        await expect(page.locator('#status-message')).toContainText('valid Google Sheets URL');
        await expect(page.locator('#sheet-editor')).toBeHidden();
        expect(await page.evaluate(() => window.__stylus.getRequests().length)).toBe(requestsBefore);
    });

    test('exiting analysis returns to the pod input', async ({ page }) => {
        await bootApp(page);
        await signIn(page);
        await loadPod(page);

        await page.locator('#exit-analysis-btn').click();

        await expect(page.locator('#sheet-editor')).toBeHidden();
        await expect(page.locator('#sheet-input-section')).toBeVisible();
    });

    test('the app boots without unexpected console errors', async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => {
            if (message.type() === 'error') errors.push(message.text());
        });

        await bootApp(page);
        await signIn(page);
        await loadPod(page);

        expect(errors).toEqual([]);
    });
});
