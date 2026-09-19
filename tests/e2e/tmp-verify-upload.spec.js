import { test, expect } from '@playwright/test';

// TEMPORARY: verifies that the CI failure path uploads traces. Delete.
test('deliberate failure to verify trace upload', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('#this-selector-does-not-exist')).toBeVisible({ timeout: 2000 });
});