import { expect, test, type Page } from '@playwright/test';

const body = (page: Page) => page.getByRole('textbox', { name: 'Engine body' });
const html = (page: Page) => page.getByTestId('engine-html');
const button = (page: Page, name: string) =>
  page.getByRole('toolbar').getByRole('button', { name, exact: true });

test.beforeEach(async ({ page }) => {
  await page.goto('/?engine=1');
  await expect(body(page)).toBeVisible();
  await body(page).locator('p').first().click();
});

test('engine toolbar turns a paragraph into a quote and a code block', async ({ page }) => {
  await button(page, 'Quote').click();
  await expect(html(page)).toHaveText(
    '<blockquote>First paragraph</blockquote><p>Second paragraph</p>',
  );
  await button(page, 'Code block').click();
  await expect(html(page)).toHaveText('<pre>First paragraph</pre><p>Second paragraph</p>');
  await page.keyboard.type('!');
  await expect(html(page)).toContainText('<pre>');
  await expect(html(page)).toContainText('!');
  await button(page, 'Paragraph').click();
  await expect(html(page)).not.toContainText('<pre>');
});

test('engine toolbar inserts a rule, typing continues below it and Backspace removes it', async ({
  page,
}) => {
  await button(page, 'Horizontal rule').click();
  await expect(html(page)).toHaveText('<p>First paragraph</p><hr><p>Second paragraph</p>');
  await expect(body(page).locator('hr')).toHaveCount(1);
  await page.keyboard.type('X');
  await expect(html(page)).toHaveText('<p>First paragraph</p><hr><p>XSecond paragraph</p>');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await expect(html(page)).toHaveText('<p>First paragraph</p><p>Second paragraph</p>');
  await page.keyboard.type('Y');
  await expect(html(page)).toHaveText('<p>First paragraph</p><p>YSecond paragraph</p>');
});

test('a rule at the end of the document leaves a paragraph to type in', async ({ page }) => {
  await body(page).locator('p').last().click();
  await button(page, 'Horizontal rule').click();
  await page.keyboard.type('next');
  await expect(html(page)).toHaveText(
    '<p>First paragraph</p><p>Second paragraph</p><hr><p>next</p>',
  );
});
