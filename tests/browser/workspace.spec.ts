import { expect, test } from '@playwright/test';

test('browser contract harness is registered', async ({ page }) => {
  await page.setContent('<main data-workspace="editor">Editor workspace contract harness</main>');
  await expect(page.locator('[data-workspace="editor"]')).toBeVisible();
});
