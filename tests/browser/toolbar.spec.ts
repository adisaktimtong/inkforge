import { expect, test, type Locator, type Page } from '@playwright/test';

const article = (page: Page) => page.getByRole('textbox', { name: 'Article body', exact: true });
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Text formatting' }).first();
const button = (page: Page, name: string) =>
  toolbar(page).getByRole('button', { name, exact: true });

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

async function fixture(editor: Locator, html: string) {
  await editor.evaluate((element, source) => {
    element.innerHTML = source;
    element.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }, html);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

for (const [name, tag] of [
  ['Bold', 'strong'],
  ['Italic', 'em'],
  ['Underline', 'u'],
]) {
  test(`${name} toggles selected text on/off once per command and keeps typing position`, async ({
    page,
  }) => {
    const editor = article(page);
    await select(editor, 1, 4);
    await button(page, name!).click();
    await expect(button(page, name!)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('controlled-html')).toContainText(`<${tag}>ell</${tag}>`);
    await expect(page.getByTestId('change-count')).toHaveText('1');
    expect(await editor.evaluate((el) => el.ownerDocument.getSelection()!.toString())).toBe('ell');
    await button(page, name!).click();
    await expect(button(page, name!)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('controlled-html')).toHaveText(
      '<p>Hello <strong>InkForge</strong></p>',
    );
    await expect(page.getByTestId('change-count')).toHaveText('2');
    await page.keyboard.type('X');
    await expect(editor).toHaveText('HXo InkForge');
  });

  test(`${name} at collapsed caret applies to newly typed text and toggles off`, async ({
    page,
  }) => {
    const editor = article(page);
    await select(editor, 2);
    await button(page, name!).click();
    await expect(page.getByTestId('change-count')).toHaveText('0');
    await page.keyboard.type('X');
    await expect(page.getByTestId('controlled-html')).toContainText(`<${tag}>X</${tag}>`);
    await button(page, name!).click();
    await page.keyboard.type('Y');
    await expect(editor).toHaveText('HeXYllo InkForge');
    await expect(page.getByTestId('controlled-html')).toContainText(`He<${tag}>X</${tag}>Yllo`);
  });
}

for (const [name, tag] of [
  ['Heading 1', 'h1'],
  ['Heading 2', 'h2'],
  ['Heading 3', 'h3'],
]) {
  test(`${name} and Paragraph preserve inline content across multiple blocks`, async ({ page }) => {
    const editor = article(page);
    await fixture(editor, '<p>One <strong>bold</strong></p><p>Two <a href="/safe">link</a></p>');
    await select(editor, 0, 16);
    await button(page, name!).click();
    await expect(editor.locator(tag!)).toHaveCount(2);
    await expect(button(page, name!)).toHaveAttribute('aria-pressed', 'true');
    for (const competing of ['Paragraph', 'Heading 1', 'Heading 2', 'Heading 3'].filter(
      (action) => action !== name,
    ))
      await expect(button(page, competing)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('controlled-html')).toHaveText(
      `<${tag}>One <strong>bold</strong></${tag}><${tag}>Two <a href="/safe">link</a></${tag}>`,
    );
    await button(page, 'Paragraph').click();
    await expect(editor.locator('p')).toHaveCount(2);
    await expect(button(page, 'Paragraph')).toHaveAttribute('aria-pressed', 'true');
    await expect(button(page, name!)).toHaveAttribute('aria-pressed', 'false');
    await expect(editor.locator('strong')).toHaveText('bold');
    await expect(editor.locator('a')).toHaveAttribute('href', '/safe');
    await page.keyboard.type('Replaced');
    await expect(editor).toHaveText('Replaced');
  });
}

for (const [name, tag, other, otherTag] of [
  ['Bulleted list', 'ul', 'Numbered list', 'ol'],
  ['Numbered list', 'ol', 'Bulleted list', 'ul'],
]) {
  test(`${name} converts, changes type and removes multi-block marked/link lists through reload`, async ({
    page,
  }) => {
    const editor = article(page);
    const source = '<p>One <strong>bold</strong></p><p>Two <a href="/safe"><em>link</em></a></p>';
    await fixture(editor, source);
    await select(editor, 0, 16);
    await button(page, name!).click();
    const expected = `<${tag}><li>One <strong>bold</strong></li><li>Two <a href="/safe"><em>link</em></a></li></${tag}>`;
    await expect(page.getByTestId('controlled-html')).toHaveText(expected);
    await expect(button(page, name!)).toHaveAttribute('aria-pressed', 'true');
    await expect(button(page, other!)).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: 'Rerender parent' }).click();
    await expect(editor).toHaveJSProperty('innerHTML', expected);
    // Re-import exported HTML through the same boundary and exercise the other list type.
    await fixture(editor, await page.getByTestId('controlled-html').innerText());
    await select(editor, 0, 16);
    await button(page, other!).click();
    await expect(page.getByTestId('controlled-html')).toHaveText(
      expected.replace(`<${tag}>`, `<${otherTag}>`).replace(`</${tag}>`, `</${otherTag}>`),
    );
    await expect(button(page, other!)).toHaveAttribute('aria-pressed', 'true');
    await expect(button(page, name!)).toHaveAttribute('aria-pressed', 'false');
    await button(page, other!).click();
    await expect(button(page, other!)).toHaveAttribute('aria-pressed', 'false');
    await expect(button(page, name!)).toHaveAttribute('aria-pressed', 'false');
    await expect(editor.locator('ul,ol')).toHaveCount(0);
    await expect(page.getByTestId('controlled-html')).toHaveText(source);
  });
}

test('real keyboard Tab/arrows/Home/End/Enter/Space restore selection and expose focus', async ({
  page,
}) => {
  const editor = article(page);
  await select(editor, 1, 4);
  await page.keyboard.press('Shift+Tab');
  await expect(button(page, 'Bold')).toBeFocused();
  expect(await button(page, 'Bold').evaluate((el) => getComputedStyle(el).outlineStyle)).toBe(
    'solid',
  );
  await page.keyboard.press('Enter');
  await expect(button(page, 'Bold')).toBeFocused();
  await expect(page.getByTestId('controlled-html')).toContainText('<strong>ell</strong>');
  await page.keyboard.press('ArrowRight');
  await expect(button(page, 'Italic')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(button(page, 'Italic')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('End');
  await expect(button(page, 'Numbered list')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(button(page, 'Bold')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(button(page, 'Numbered list')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(editor).toBeFocused();
  await page.keyboard.type('X');
  await expect(editor).toHaveText('HXo InkForge');
});

test('keyboard collapsed toggle survives returning to editor', async ({ page }) => {
  const editor = article(page);
  await select(editor, 2);
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  await page.keyboard.type('X');
  await expect(page.getByTestId('controlled-html')).toContainText('He<strong>X</strong>llo');
});

test('pointer, touch and native form button semantics preserve the intended range', async ({
  page,
}) => {
  const editor = article(page);
  await editor.evaluate((el) => {
    const bar = el.previousElementSibling!;
    const form = document.createElement('form');
    bar.before(form);
    form.append(bar, el);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      form.dataset.submitted = 'true';
    });
  });
  await select(editor, 0, 5);
  await button(page, 'Bold').dispatchEvent('pointerdown', { pointerType: 'touch', button: 0 });
  await button(page, 'Bold').dispatchEvent('click');
  await expect(page.getByTestId('controlled-html')).toContainText('<strong>Hello</strong>');
  await expect(page.locator('form')).not.toHaveAttribute('data-submitted');
  await expect(toolbar(page).locator('button:not([type="button"])')).toHaveCount(0);
});

for (const locked of ['Disabled', 'Read only', 'composition']) {
  test(`${locked} blocks commands then restores normal formatting`, async ({ page }) => {
    const editor = article(page);
    await select(editor, 1, 4);
    if (locked === 'composition') await editor.dispatchEvent('compositionstart');
    else await page.getByLabel(locked, { exact: true }).check();
    await expect(toolbar(page).locator('button:disabled')).toHaveCount(9);
    await button(page, 'Bold').evaluate((el: HTMLButtonElement) => el.click());
    await expect(page.getByTestId('controlled-html')).toHaveText(
      '<p>Hello <strong>InkForge</strong></p>',
    );
    if (locked === 'composition') await editor.dispatchEvent('compositionend');
    else await page.getByLabel(locked, { exact: true }).uncheck();
    await select(editor, 1, 4);
    await button(page, 'Bold').click();
    await expect(page.getByTestId('controlled-html')).toContainText('<strong>ell</strong>');
  });
}

test('same-turn composition start guards commands before React rerenders', async ({ page }) => {
  const editor = article(page);
  await select(editor, 1, 4);
  await editor.evaluate((el) => {
    el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    (el.previousElementSibling!.querySelector('button') as HTMLButtonElement).click();
  });
  await expect(editor).toHaveJSProperty('innerHTML', '<p>Hello <strong>InkForge</strong></p>');
  await expect(page.getByTestId('change-count')).toHaveText('0');
});

test('two editors and outside selections never receive each other’s commands', async ({ page }) => {
  const editor = article(page);
  const second = page.getByRole('textbox', { name: 'Uncontrolled article' });
  await select(second, 0, 12);
  await select(editor, 0, 5);
  await page
    .getByRole('toolbar')
    .nth(1)
    .getByRole('button', { name: 'Italic', exact: true })
    .click();
  await expect(editor).toHaveJSProperty('innerHTML', '<p>Hello <strong>InkForge</strong></p>');
  await expect(second).toHaveText('Uncontrolled draft');
  await expect(second.locator('em')).toHaveCount(0);
  await page.getByRole('heading', { name: 'InkForge editor playground' }).evaluate((el) => {
    const selection = document.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await button(page, 'Bold').click();
  await expect(editor).toHaveJSProperty('innerHTML', '<p>Hello <strong>InkForge</strong></p>');
  await expect(
    page.getByRole('heading', { name: 'InkForge editor playground' }).locator('b,strong'),
  ).toHaveCount(0);
});

test('external replacement invalidates stale bookmarks and fresh selections format the new document', async ({
  page,
}) => {
  const editor = article(page);
  await select(editor, 1, 4);
  await page.getByRole('button', { name: 'Replace value' }).click();
  await button(page, 'Bold').evaluate((el: HTMLButtonElement) => el.click());
  await expect(editor).toHaveJSProperty(
    'innerHTML',
    '<h2>External replacement</h2><p>New draft</p>',
  );
  await select(editor, 0, 8);
  await button(page, 'Underline').click();
  await expect(page.getByTestId('controlled-html')).toContainText('<u>External</u>');
});

test('bare editors stay bare and Next toolbar hydrates with content-only route intact', async ({
  page,
  request,
}) => {
  await expect(
    page.getByRole('textbox', { name: 'Fixed article' }).locator('..').getByRole('toolbar'),
  ).toHaveCount(0);
  const response = await request.get('http://127.0.0.1:4174/editor');
  expect(await response.text()).toContain('role="toolbar"');
  await page.goto('http://127.0.0.1:4174/editor');
  await select(article(page), 0, 6);
  await button(page, 'Italic').click();
  await expect(page.getByTestId('next-html')).toContainText('<em>Server</em>');
  await page.goto('http://127.0.0.1:4174/');
  await expect(page.getByRole('toolbar')).toHaveCount(0);
});

for (const direction of ['paragraph to list', 'list to paragraph']) {
  test(`mixed ${direction} selection converts every selected block and keeps siblings`, async ({
    page,
  }) => {
    const editor = article(page);
    const html =
      direction === 'paragraph to list'
        ? '<p>Before</p><p>First</p><ul><li><strong>Second</strong></li><li>After</li></ul>'
        : '<ul><li>Before</li><li>First</li></ul><p><strong>Second</strong></p><p>After</p>';
    await fixture(editor, html);
    await select(editor, 6, 17);
    await button(page, 'Numbered list').click();
    await expect(page.getByTestId('controlled-html')).toHaveText(
      direction === 'paragraph to list'
        ? '<p>Before</p><ol><li>First</li><li><strong>Second</strong></li></ol><ul><li>After</li></ul>'
        : '<ul><li>Before</li></ul><ol><li>First</li><li><strong>Second</strong></li></ol><p>After</p>',
    );
  });
}

test('partial and nested list selections change only intended items', async ({ page }) => {
  const editor = article(page);
  await fixture(editor, '<ul><li>Before</li><li><strong>Chosen</strong></li><li>After</li></ul>');
  await select(editor, 6, 12);
  await button(page, 'Bulleted list').click();
  await expect(page.getByTestId('controlled-html')).toHaveText(
    '<ul><li>Before</li></ul><p><strong>Chosen</strong></p><ul><li>After</li></ul>',
  );
  await fixture(
    editor,
    '<ul><li>Parent<ul><li><a href="/safe">Nested</a></li><li>Sibling</li></ul></li><li>After</li></ul>',
  );
  await select(editor, 6, 12);
  await button(page, 'Numbered list').click();
  await expect(page.getByTestId('controlled-html')).toHaveText(
    '<ul><li><p>Parent</p><ol><li><a href="/safe">Nested</a></li></ol><ul><li>Sibling</li></ul></li><li>After</li></ul>',
  );
});

test('element-boundary selections and empty blocks retain selection and editable paragraphs', async ({
  page,
}) => {
  const editor = article(page);
  await fixture(editor, '<p>First</p><p><strong>Second</strong></p>');
  await editor.evaluate((el) => {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    el.focus();
    document.getSelection()!.setBaseAndExtent(el, 0, el, 2);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await button(page, 'Heading 2').click();
  await expect(page.getByTestId('controlled-html')).toHaveText(
    '<h2>First</h2><h2><strong>Second</strong></h2>',
  );
  expect(
    await editor.evaluate((el) => document.getSelection()!.toString().replace(/\n/g, '')),
  ).toBe('FirstSecond');
  await fixture(editor, '<ul><li></li></ul>');
  await editor.evaluate((el) => {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    el.focus();
    const item = el.querySelector('li')!;
    document.getSelection()!.setBaseAndExtent(item, 0, item, 0);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await button(page, 'Bulleted list').click();
  await expect(page.getByTestId('controlled-html')).toHaveText('<p></p>');
  await page.keyboard.type('New');
  await expect(editor).toHaveText('New');
});

for (const mode of ['controlled', 'uncontrolled']) {
  test(`${mode} toolbar toggles preserve live surface, selection, edits and forwarded ref`, async ({
    page,
  }) => {
    const editor =
      mode === 'controlled'
        ? article(page)
        : page.getByRole('textbox', { name: 'Uncontrolled article' });
    const focus = page.getByRole('button', {
      name: mode === 'controlled' ? 'Focus editor' : 'Focus uncontrolled editor',
      exact: true,
    });
    await editor.fill('Edited live draft');
    await select(editor, 2, 8);
    await editor.evaluate((el) => {
      (window as Window & { liveEditor?: HTMLElement }).liveEditor = el;
    });
    for (const enabled of [false, true, false, true]) {
      await page
        .getByRole('button', { name: 'Toggle toolbars', exact: true })
        .evaluate((el: HTMLButtonElement) => el.click());
      await expect(page.getByRole('toolbar')).toHaveCount(enabled ? 2 : 0);
      await expect(editor).toHaveText('Edited live draft');
      expect(
        await editor.evaluate(
          (el) => el === (window as Window & { liveEditor?: HTMLElement }).liveEditor,
        ),
      ).toBe(true);
      expect(await editor.evaluate((el) => el.ownerDocument.getSelection()!.toString())).toBe(
        'ited l',
      );
    }
    await page.keyboard.type('X');
    await expect(editor).toHaveText('EdXive draft');
    await focus.click();
    await expect(editor).toBeFocused();
    await editor.evaluate((el) => {
      const range = el.ownerDocument.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const selection = el.ownerDocument.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    });
    await page.keyboard.type('!');
    await expect(editor).toHaveText('EdXive draft!');
  });
}

test('mixed paragraph and direct-inline list item both change heading and paragraph style', async ({
  page,
}) => {
  const editor = article(page);
  await fixture(
    editor,
    '<p>Before</p><p>One</p><ul><li><strong>Two</strong></li><li>After</li></ul>',
  );
  await select(editor, 6, 12);
  await button(page, 'Heading 2').click();
  await expect(page.getByTestId('controlled-html')).toHaveText(
    '<p>Before</p><h2>One</h2><ul><li><h2><strong>Two</strong></h2></li><li>After</li></ul>',
  );
  await button(page, 'Paragraph').click();
  await expect(page.getByTestId('controlled-html')).toHaveText(
    '<p>Before</p><p>One</p><ul><li><strong>Two</strong></li><li>After</li></ul>',
  );
  expect(
    await editor.evaluate(
      (el) => el.ownerDocument.getSelection()!.getRangeAt(0).cloneContents().textContent,
    ),
  ).toBe('OneTwo');
});

test('list conversion merges the full contiguous list run without restarting numbering', async ({
  page,
}) => {
  const editor = article(page);
  await fixture(editor, '<ul><li>A</li></ul><p>B</p><ul><li>C</li></ul>');
  await select(editor, 0, 3);
  await button(page, 'Numbered list').click();
  await expect(page.getByTestId('controlled-html')).toHaveText(
    '<ol><li>A</li><li>B</li><li>C</li></ol>',
  );
  await expect(editor.locator('ol')).toHaveCount(1);
});

test('list removal ignores element-boundary markers and promotes inherited item presentation', async ({
  page,
}) => {
  const editor = article(page);
  await fixture(editor, '<ul><li><p><strong>Selected</strong></p></li></ul>');
  await editor.evaluate((el) => {
    el.focus();
    const item = el.querySelector('li')!;
    document.getSelection()!.setBaseAndExtent(item, 0, item, 1);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await button(page, 'Bulleted list').click();
  await expect(page.getByTestId('controlled-html')).toHaveText('<p><strong>Selected</strong></p>');
  await expect(editor.locator('p')).toHaveCount(1);
  expect(
    await editor.evaluate((el) => el.ownerDocument.getSelection()!.toString().replace(/\n/g, '')),
  ).toBe('Selected');
  await fixture(
    editor,
    '<ul><li class="item" style="color: red; font-family: serif"><p class="child">Inherited</p><p style="color: blue">Override</p></li></ul>',
  );
  await select(editor, 0, 17);
  await button(page, 'Bulleted list').click();
  await expect(page.getByTestId('controlled-html')).toHaveText(
    '<p class="item child" style="color: red; font-family: serif">Inherited</p><p class="item" style="color: blue; font-family: serif">Override</p>',
  );
  await expect(editor.locator('p')).toHaveCount(2);
});

for (const mutateExisting of [false, true]) {
  test(`fresh ref focus and host-created selection (${mutateExisting ? 'mutated Range' : 'new Range'}) work after external replacement`, async ({
    page,
  }) => {
    const editor = article(page);
    await select(editor, 1, 4);
    await page.getByRole('button', { name: 'Replace value' }).click();
    await page.getByRole('button', { name: 'Focus editor', exact: true }).click();
    await expect(editor).toBeFocused();
    await editor.evaluate((el, mutateExisting) => {
      const text = el.querySelector('p')!.firstChild!;
      const selection = el.ownerDocument.getSelection()!;
      if (mutateExisting && selection.rangeCount) {
        const range = selection.getRangeAt(0);
        range.setStart(text, 0);
        range.setEnd(text, 3);
      } else selection.setBaseAndExtent(text, 0, text, 3);
      el.ownerDocument.dispatchEvent(new Event('selectionchange'));
    }, mutateExisting);
    await button(page, 'Italic').click();
    await expect(page.getByTestId('controlled-html')).toHaveText(
      '<h2>External replacement</h2><p><em>New</em> draft</p>',
    );
  });
}

test('removing the document selection clears bookmarks, pressed states and typing marks', async ({
  page,
}) => {
  const editor = article(page);
  await select(editor, 2);
  await button(page, 'Bold').click();
  await expect(button(page, 'Bold')).toHaveAttribute('aria-pressed', 'true');
  await editor.evaluate((el) => {
    el.ownerDocument.getSelection()!.removeAllRanges();
    // Activate immediately, before the browser delivers selectionchange.
    (
      el.previousElementSibling!.querySelector('[aria-label="Italic"]') as HTMLButtonElement
    ).click();
    el.ownerDocument.dispatchEvent(new Event('selectionchange'));
  });
  await expect(toolbar(page).locator('[aria-pressed="true"]')).toHaveCount(0);
  await button(page, 'Underline').click();
  await expect(page.getByTestId('change-count')).toHaveText('0');
  await expect(editor).toHaveJSProperty('innerHTML', '<p>Hello <strong>InkForge</strong></p>');
  await select(editor, 3);
  await page.keyboard.type('X');
  await expect(page.getByTestId('controlled-html')).toHaveText(
    '<p>HelXlo <strong>InkForge</strong></p>',
  );
});

test('block and list pressed states follow caret movement and exclude competing states', async ({
  page,
}) => {
  const editor = article(page);
  await fixture(
    editor,
    '<p>Plain</p><h1>First</h1><h2>Second</h2><h3>Third</h3><ul><li>Bullet</li></ul><ol><li>Number</li></ol>',
  );
  for (const [offset, active] of [
    [2, 'Paragraph'],
    [7, 'Heading 1'],
    [12, 'Heading 2'],
    [18, 'Heading 3'],
  ] as const) {
    await select(editor, offset);
    for (const name of ['Paragraph', 'Heading 1', 'Heading 2', 'Heading 3'])
      await expect(button(page, name)).toHaveAttribute('aria-pressed', String(name === active));
    await expect(button(page, 'Bulleted list')).toHaveAttribute('aria-pressed', 'false');
    await expect(button(page, 'Numbered list')).toHaveAttribute('aria-pressed', 'false');
  }
  await select(editor, 23);
  await expect(button(page, 'Bulleted list')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'Numbered list')).toHaveAttribute('aria-pressed', 'false');
  await select(editor, 29);
  await expect(button(page, 'Bulleted list')).toHaveAttribute('aria-pressed', 'false');
  await expect(button(page, 'Numbered list')).toHaveAttribute('aria-pressed', 'true');
  await select(editor, 2);
  await expect(button(page, 'Paragraph')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'Numbered list')).toHaveAttribute('aria-pressed', 'false');
});
