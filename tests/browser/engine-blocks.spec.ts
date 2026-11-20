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

const select = async (page: Page, paragraph: number, start: number, end: number) =>
  body(page).evaluate(
    (element, [index, from, to]) => {
      const text = element.querySelectorAll('p')[index!]!.querySelector('span')!.firstChild!;
      element.ownerDocument.getSelection()!.setBaseAndExtent(text, from!, text, to!);
    },
    [paragraph, start, end],
  );

test('engine toolbar aligns the caret block and clears alignment when chosen again', async ({
  page,
}) => {
  await button(page, 'Align center').click();
  await expect(html(page)).toHaveText(
    '<p class="rte-align-center">First paragraph</p><p>Second paragraph</p>',
  );
  await expect(body(page).locator('p').first()).toHaveCSS('text-align', 'center');
  await expect(button(page, 'Align center')).toHaveAttribute('aria-pressed', 'true');
  await button(page, 'Align right').click();
  await expect(html(page)).toHaveText(
    '<p class="rte-align-right">First paragraph</p><p>Second paragraph</p>',
  );
  await button(page, 'Align right').click();
  await expect(html(page)).toHaveText('<p>First paragraph</p><p>Second paragraph</p>');
  // The styled content stays editable.
  await button(page, 'Align center').click();
  await page.keyboard.type('!');
  await expect(html(page)).toContainText('!');
});

test('engine toolbar styles selected words, a whole block, and resets', async ({ page }) => {
  await select(page, 0, 6, 15);
  await button(page, 'Style: brand').click();
  await expect(html(page)).toHaveText(
    '<p>First <span class="rte-text-brand">paragraph</span></p><p>Second paragraph</p>',
  );
  await body(page).locator('p').last().click();
  await button(page, 'Style: brand').click();
  await expect(html(page)).toHaveText(
    '<p>First <span class="rte-text-brand">paragraph</span></p><p class="rte-text-brand">Second paragraph</p>',
  );
  await button(page, 'Reset content style').click();
  await expect(html(page)).toHaveText(
    '<p>First <span class="rte-text-brand">paragraph</span></p><p>Second paragraph</p>',
  );
});

test('engine toolbar applies subscript and superscript as exclusive marks', async ({ page }) => {
  await select(page, 0, 0, 5);
  await button(page, 'Subscript').click();
  await expect(html(page)).toHaveText('<p><sub>First</sub> paragraph</p><p>Second paragraph</p>');
  await button(page, 'Superscript').click();
  await expect(html(page)).toHaveText('<p><sup>First</sup> paragraph</p><p>Second paragraph</p>');
});

test('content with a registered class and an allowed link is editable under a profile', async ({
  page,
}) => {
  await page.goto('/?engine=styled');
  await expect(body(page)).toHaveAttribute('data-inkforge-phase', 'ready');
  await expect(body(page).locator('p')).toHaveClass('rte-align-center');
  await expect(body(page).locator('a')).toHaveAttribute('href', 'https://example.com/a');
  await body(page).locator('p').click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await expect(html(page)).toHaveText(
    '<p class="rte-align-center">Read <a href="https://example.com/a">the guide</a> first!</p>',
  );
});

test('without a profile the same content stays read only', async ({ page }) => {
  await page.goto('/?engine=nopolicy');
  await expect(body(page)).toHaveAttribute('data-inkforge-phase', 'readOnly');
  await expect(body(page).locator('p')).not.toHaveClass(/rte-/);
  await expect(body(page).locator('a')).not.toHaveAttribute('href');
});
