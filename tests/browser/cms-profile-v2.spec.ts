import { expect, test, type Locator, type Page } from '@playwright/test';

const body = (page: Page) => page.getByRole('textbox', { name: 'CMS body', exact: true });
const button = (page: Page, name: string) =>
  page.getByRole('toolbar', { name: 'Text formatting' }).getByRole('button', { name, exact: true });
const html = (page: Page) => page.getByTestId('cms-html');

async function select(editor: Locator, start: number, end = start) {
  await editor.evaluate(
    (element, offsets) => {
      element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      element.focus();
      const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      while (walker.nextNode()) nodes.push(walker.currentNode as Text);
      const point = (offset: number): [Node, number] => {
        for (const node of nodes) {
          if (offset <= node.length) return [node, offset];
          offset -= node.length;
        }
        return [element, element.childNodes.length];
      };
      element.ownerDocument
        .getSelection()!
        .setBaseAndExtent(...point(offsets[0]!), ...point(offsets[1]!));
      element.ownerDocument.dispatchEvent(new Event('selectionchange'));
    },
    [start, end],
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?profile=cms-body-v2');
  await expect(body(page)).toBeVisible();
});

test('alignment is stored as one registered class and can be cleared', async ({ page }) => {
  await select(body(page), 2);
  await button(page, 'Align center').click();
  await expect(html(page)).toHaveText(
    '<p class="rte-align-center">First paragraph</p><p>H2O and x2</p>',
  );
  await expect(button(page, 'Align center')).toHaveAttribute('aria-pressed', 'true');
  await expect(body(page).locator('p').first()).toHaveCSS('text-align', 'center');
  await button(page, 'Align right').click();
  await expect(html(page)).toHaveText(
    '<p class="rte-align-right">First paragraph</p><p>H2O and x2</p>',
  );
  await button(page, 'Align right').click();
  await expect(html(page)).toHaveText('<p>First paragraph</p><p>H2O and x2</p>');
});

test('alignment applies to every selected paragraph and keeps the brand colour', async ({
  page,
}) => {
  await select(body(page), 2, 20);
  await button(page, 'Align justify').click();
  await button(page, 'Content style').click();
  await page.getByRole('dialog', { name: 'Content style' }).getByRole('button').first().click();
  await expect(html(page)).toHaveText(
    '<p class="rte-align-justify rte-text-brand">First paragraph</p><p class="rte-align-justify rte-text-brand">H2O and x2</p>',
  );
  // Alignment classes are offered as buttons, not as content styles.
  await button(page, 'Content style').click();
  await expect(
    page.getByRole('dialog', { name: 'Content style' }).getByRole('button', { name: /align/i }),
  ).toHaveCount(0);
});

test('subscript and superscript are exclusive marks', async ({ page }) => {
  await select(body(page), 16, 17);
  await button(page, 'Subscript').click();
  await expect(html(page)).toHaveText('<p>First paragraph</p><p>H<sub>2</sub>O and x2</p>');
  await expect(button(page, 'Subscript')).toHaveAttribute('aria-pressed', 'true');
  await select(body(page), 24, 25);
  await button(page, 'Superscript').click();
  await expect(html(page)).toHaveText(
    '<p>First paragraph</p><p>H<sub>2</sub>O and x<sup>2</sup></p>',
  );
  await select(body(page), 16, 17);
  await button(page, 'Superscript').click();
  await expect(html(page)).toHaveText(
    '<p>First paragraph</p><p>H<sup>2</sup>O and x<sup>2</sup></p>',
  );
  await button(page, 'Superscript').click();
  await expect(html(page)).toHaveText('<p>First paragraph</p><p>H2O and x<sup>2</sup></p>');
});
