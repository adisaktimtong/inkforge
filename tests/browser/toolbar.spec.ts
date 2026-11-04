import { expect, test, type Locator, type Page } from '@playwright/test';

const article = (page: Page) => page.getByRole('textbox', { name: 'Article body', exact: true });
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Text formatting' }).first();
const button = (page: Page, name: string) =>
  toolbar(page).getByRole('button', { name, exact: true });

async function choose(page: Page, name: string) {
  if (/^(Paragraph|Heading [123])$/.test(name)) await button(page, 'Text style').click();
  await button(page, name).click();
}

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
    await choose(page, name!);
    await expect(button(page, name!)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('controlled-html')).toContainText(`<${tag}>ell</${tag}>`);
    await expect(page.getByTestId('change-count')).toHaveText('1');
    expect(await editor.evaluate((el) => el.ownerDocument.getSelection()!.toString())).toBe('ell');
    await choose(page, name!);
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
    await choose(page, name!);
    await expect(page.getByTestId('change-count')).toHaveText('0');
    await page.keyboard.type('X');
    await expect(page.getByTestId('controlled-html')).toContainText(`<${tag}>X</${tag}>`);
    await choose(page, name!);
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
    await choose(page, name!);
    await expect(editor.locator(tag!)).toHaveCount(2);
    await expect(button(page, 'Text style')).toContainText(name!);
    await expect(page.getByTestId('controlled-html')).toHaveText(
      `<${tag}>One <strong>bold</strong></${tag}><${tag}>Two <a href="/safe">link</a></${tag}>`,
    );
    await choose(page, 'Paragraph');
    await expect(editor.locator('p')).toHaveCount(2);
    await expect(button(page, 'Text style')).toContainText('Paragraph');
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
    await choose(page, name!);
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
  await expect(button(page, 'Clear formatting')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(button(page, 'Bold')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(button(page, 'Clear formatting')).toBeFocused();
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
    await expect(toolbar(page).locator('button:disabled')).toHaveCount(16);
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
  await choose(page, 'Heading 2');
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
  await choose(page, 'Heading 2');
  await expect(page.getByTestId('controlled-html')).toHaveText(
    '<p>Before</p><h2>One</h2><ul><li><h2><strong>Two</strong></h2></li><li>After</li></ul>',
  );
  await choose(page, 'Paragraph');
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
    await expect(button(page, 'Text style')).toContainText(active);
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
  await expect(button(page, 'Text style')).toContainText('Paragraph');
  await expect(button(page, 'Numbered list')).toHaveAttribute('aria-pressed', 'false');
});

for (const [name, tag] of [
  ['Strikethrough', 's'],
  ['Inline code', 'code'],
] as const) {
  test(`${name} preserves partial suffixes and supports collapsed typing`, async ({ page }) => {
    const editor = article(page);
    await fixture(editor, '<p><strong>abcdef</strong> tail</p>');
    await select(editor, 1, 4);
    await button(page, name).click();
    await expect(editor.locator(tag)).toHaveText('bcd');
    await expect(editor).toHaveText('abcdef tail');
    await button(page, name).click();
    await expect(editor.locator(tag)).toHaveCount(0);
    await select(editor, 6);
    await button(page, name).click();
    await page.keyboard.type('XY');
    expect((await editor.locator(tag).allTextContents()).join('')).toBe('XY');
    await button(page, name).click();
    await page.keyboard.type('Z');
    await expect(editor).toHaveText('abcdefXYZ tail');
    expect((await editor.locator(tag).allTextContents()).join('')).toBe('XY');
    expect(await editor.innerHTML()).not.toMatch(/[\u200b\ufeff]/);
  });
}

test('colors coexist with marks/links, partial reset and clear preserve suffixes and targets', async ({
  page,
}) => {
  const editor = article(page);
  await fixture(editor, '<p><a href="/safe"><strong>abcdef</strong></a></p>');
  await select(editor, 1, 4);
  for (const [name, color] of [
    ['Text color', '#dc2626'],
    ['Highlight', '#eab308'],
  ]) {
    await button(page, name!).click();
    await toolbar(page).getByRole('button', { name: color!, exact: true }).click();
  }
  await expect(page.getByTestId('controlled-html')).toContainText(
    'background-color: rgb(234, 179, 8); color: rgb(220, 38, 38)',
  );
  for (const link of await editor.locator('a').all())
    await expect(link).toHaveAttribute('href', '/safe');
  await button(page, 'Text color').click();
  await toolbar(page).getByRole('button', { name: 'Reset color', exact: true }).click();
  expect(await page.getByTestId('controlled-html').innerText()).not.toContain('color: rgb(220');
  await expect(page.getByTestId('controlled-html')).toContainText(
    'background-color: rgb(234, 179, 8)',
  );
  await button(page, 'Text color').click();
  await toolbar(page).getByRole('button', { name: '#dc2626', exact: true }).click();
  await button(page, 'Highlight').click();
  await toolbar(page).getByRole('button', { name: 'Reset color', exact: true }).click();
  await expect(page.getByTestId('controlled-html')).toContainText('color: rgb(220, 38, 38)');
  expect(await page.getByTestId('controlled-html').innerText()).not.toContain('background-color');
  await button(page, 'Clear formatting').click();
  await expect(editor).toHaveText('abcdef');
  expect(await editor.evaluate((el) => getSelection()!.toString())).toBe('bcd');
  await expect(editor.locator('strong')).toHaveText(['a', 'ef']);
  await expect(editor.locator('a')).toHaveCount(3);
  for (const anchor of await editor.locator('a').all())
    await expect(anchor).toHaveAttribute('href', '/safe');
});

test('color picker rejects invalid hex and collapsed color persists across typing', async ({
  page,
}) => {
  const editor = article(page);
  await select(editor, 2);
  await button(page, 'Text color').click();
  await toolbar(page).getByRole('textbox', { name: 'Hex color' }).fill('invalid');
  await toolbar(page).getByRole('button', { name: 'Apply color', exact: true }).click();
  await expect(page.getByTestId('change-count')).toHaveText('0');
  await toolbar(page).getByRole('textbox', { name: 'Hex color' }).fill('#123456');
  await toolbar(page).getByRole('button', { name: 'Apply color', exact: true }).click();
  await page.keyboard.type('XY');
  await expect(page.getByTestId('controlled-html')).toContainText('color: rgb(18, 52, 86)');
  await expect(editor).toHaveText('HeXYllo InkForge');
});

test('link input focus, unsafe validation, create/edit/remove and keyboard cancel', async ({
  page,
}) => {
  const editor = article(page);
  await select(editor, 0, 5);
  await button(page, 'Link').click();
  const url = toolbar(page).getByRole('textbox', { name: 'URL' });
  await expect(url).toBeFocused();
  await url.fill('javascript:alert(1)');
  await toolbar(page).getByRole('button', { name: 'Apply link', exact: true }).click();
  await expect(toolbar(page).getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('change-count')).toHaveText('0');
  await url.fill('/destination');
  await url.press('Enter');
  await expect(editor.locator('a')).toHaveText('Hello');
  await expect(editor.locator('a')).toHaveAttribute('href', '/destination');
  await select(editor, 2);
  await button(page, 'Link').click();
  await url.fill('/edited');
  await toolbar(page).getByRole('button', { name: 'Apply link', exact: true }).click();
  await expect(editor.locator('a')).toHaveAttribute('href', '/edited');
  await button(page, 'Link').click();
  await url.fill('/cancelled');
  await url.press('Escape');
  await expect(button(page, 'Link')).toBeFocused();
  await expect(editor.locator('a')).toHaveAttribute('href', '/edited');
  await button(page, 'Link').click();
  await toolbar(page).getByRole('button', { name: 'Remove link', exact: true }).click();
  await expect(editor.locator('a')).toHaveCount(0);
  await select(editor, 5);
  await button(page, 'Link').click();
  await url.fill('https://example.com');
  await url.press('Enter');
  await expect(editor.locator('a')).toHaveText('https://example.com');
});

test('popups invalidate on external value, lock, foreign selection, and outside pointer', async ({
  page,
}) => {
  const editor = article(page);
  await select(editor, 0, 5);
  await button(page, 'Link').click();
  await page.getByRole('button', { name: 'Reset controlled' }).click();
  await expect(toolbar(page).getByRole('dialog')).toHaveCount(0);
  await select(editor, 0, 3);
  await button(page, 'Text color').click();
  await page.getByLabel('Read only', { exact: true }).check();
  await expect(toolbar(page).getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Read only', { exact: true }).uncheck();
  await select(editor, 0, 3);
  await button(page, 'Link').click();
  await page.getByRole('heading').first().click();
  await expect(toolbar(page).getByRole('dialog')).toHaveCount(0);
});

test('alignment selects semantic blocks and parent list text independently of nested children', async ({
  page,
}) => {
  const editor = article(page);
  await fixture(
    editor,
    '<ul><li>Parent<ul><li>Child</li></ul></li><li>Sibling</li></ul><h2>Heading</h2>',
  );
  await select(editor, 1, 4);
  await button(page, 'Align center').click();
  await expect(editor.locator('li > p')).toHaveCSS('text-align', 'center');
  await expect(editor.locator('li li')).not.toHaveAttribute('style');
  await expect(editor.locator('li').last()).not.toHaveAttribute('style');
  await select(editor, 7, 10);
  await button(page, 'Align right').click();
  await expect(editor.locator('li li')).toHaveCSS('text-align', 'right');
  await select(editor, 20, 22);
  await button(page, 'Align justify').click();
  await expect(editor.locator('h2')).toHaveCSS('text-align', 'justify');
});

test('320px toolbar and input panels fit without horizontal overflow or nested forms', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const editor = article(page);
  await editor.evaluate((el) => {
    const form = document.createElement('form');
    const bar = el.previousElementSibling!;
    bar.before(form);
    form.append(bar, el);
  });
  await select(editor, 0, 5);
  await button(page, 'Link').click();
  await expect(page.locator('form form')).toHaveCount(0);
  const bounds = await toolbar(page).getByRole('dialog').boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  expect(await toolbar(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test('collapsed native marks combine with code and both colors through real typing', async ({
  page,
}) => {
  const editor = article(page);
  await select(editor, 2);
  await button(page, 'Bold').click();
  await button(page, 'Inline code').click();
  for (const name of ['Text color', 'Highlight']) {
    await button(page, name).click();
    await toolbar(page).getByRole('button', { name: '#dc2626', exact: true }).click();
  }
  await page.keyboard.type('XY');
  await expect(editor).toHaveText('HeXYllo InkForge');
  const html = await page.getByTestId('controlled-html').innerText();
  expect(html).toContain('<strong><code>X</code></strong>');
  expect(html).toContain('background-color: rgb(220, 38, 38); color: rgb(220, 38, 38)');
  await select(editor, 0);
  await page.keyboard.type('Z');
  await expect(editor).toHaveText('ZHeXYllo InkForge');
  expect(await page.getByTestId('controlled-html').innerText()).toMatch(/^<p>ZHe/);
});

for (const key of ['Enter', 'Space'])
  test(`keyboard ${key} removes a link without applying the URL input`, async ({ page }) => {
    const editor = article(page);
    await fixture(editor, '<p><a href="/old">linked</a> tail</p>');
    await select(editor, 2);
    await button(page, 'Link').click();
    await toolbar(page).getByRole('textbox', { name: 'URL' }).fill('/should-not-apply');
    const remove = toolbar(page).getByRole('button', { name: 'Remove link', exact: true });
    await remove.focus();
    await page.keyboard.press(key);
    await expect(editor.locator('a')).toHaveCount(0);
    await expect(editor).toHaveText('linked tail');
  });

test('native color-picker focusout without a related target preserves the captured snapshot', async ({
  page,
}) => {
  const editor = article(page);
  await fixture(editor, '<p><b>native bold</b> tail</p>');
  await select(editor, 0, 6);
  await button(page, 'Text color').click();
  const picker = toolbar(page).locator('input[type=color]');
  await picker.focus();
  await picker.dispatchEvent('focusout', { relatedTarget: null });
  await expect(toolbar(page).getByRole('dialog')).toBeVisible();
  await expect(editor.locator('b')).toHaveText('native bold');
  await picker.fill('#123456');
  await toolbar(page).getByRole('button', { name: 'Apply color', exact: true }).click();
  await expect(page.getByTestId('controlled-html')).toContainText('color: rgb(18, 52, 86)');
  await expect(editor.locator('[style*=color]')).toHaveCSS('color', 'rgb(18, 52, 86)');
  await expect(editor).toHaveText('native bold tail');
});

for (const collapsed of [false, true])
  test(`link presentation survives ${collapsed ? 'collapsed' : 'selected'} edit and unlink`, async ({
    page,
  }) => {
    const editor = article(page);
    await fixture(
      editor,
      '<p><a class="custom-link" style="color: rgb(220, 38, 38); background-color: rgb(234, 179, 8)" href="/old"><strong>abcdef</strong></a> tail</p>',
    );
    await select(editor, 1, collapsed ? 1 : 4);
    await button(page, 'Link').click();
    await toolbar(page).getByRole('textbox', { name: 'URL' }).fill('/new');
    await toolbar(page).getByRole('button', { name: 'Apply link', exact: true }).click();
    const changed = editor.locator('a[href="/new"]');
    await expect(changed).toHaveText(collapsed ? 'abcdef' : 'bcd');
    await expect(changed).toHaveClass('custom-link');
    await expect(changed).toHaveCSS('color', 'rgb(220, 38, 38)');
    await expect(changed).toHaveCSS('background-color', 'rgb(234, 179, 8)');
    await button(page, 'Link').click();
    await toolbar(page).getByRole('button', { name: 'Remove link', exact: true }).click();
    const unlinked = editor.locator('span.custom-link');
    await expect(unlinked).toHaveText(collapsed ? 'abcdef' : 'bcd');
    await expect(unlinked).toHaveCSS('color', 'rgb(220, 38, 38)');
    await expect(unlinked).toHaveCSS('background-color', 'rgb(234, 179, 8)');
    expect((await editor.locator('strong').allTextContents()).join('')).toBe('abcdef');
    await expect(editor).toHaveText('abcdef tail');
    await expect(page.getByTestId('controlled-html')).toContainText('class="custom-link"');
    await expect(page.getByTestId('controlled-html')).toContainText(
      'background-color: rgb(234, 179, 8); color: rgb(220, 38, 38)',
    );
  });

test('collapsed link insertion leaves the caret after its URL label', async ({ page }) => {
  const editor = article(page);
  await select(editor, 5);
  await button(page, 'Link').click();
  await toolbar(page).getByRole('textbox', { name: 'URL' }).fill('/new');
  await toolbar(page).getByRole('button', { name: 'Apply link', exact: true }).click();
  expect(await editor.evaluate((el) => el.ownerDocument.getSelection()!.isCollapsed)).toBe(true);
  await page.keyboard.type('X');
  await expect(editor).toHaveText('Hello/newX InkForge');
  await expect(page.getByTestId('controlled-html')).toContainText('/new</a>X');
});

for (const finalize of ['compositionend', 'blur'])
  test(`pending inline tools apply once to the Thai composition buffer on ${finalize}`, async ({
    page,
  }) => {
    const editor = article(page);
    await select(editor, 2);
    await button(page, 'Bold').click();
    await button(page, 'Clear formatting').click();
    await button(page, 'Inline code').click();
    await button(page, 'Strikethrough').click();
    for (const name of ['Text color', 'Highlight']) {
      await button(page, name).click();
      await toolbar(page).getByRole('button', { name: '#dc2626', exact: true }).click();
    }
    const count = await page.getByTestId('change-count').innerText();
    await editor.evaluate((el) => {
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      const range = getSelection()!.getRangeAt(0);
      range.deleteContents();
      const text = document.createTextNode('ภาษาไทย');
      const nativeMark = document.createElement('strong');
      nativeMark.append(text);
      range.insertNode(nativeMark);
      range.setStart(text, text.length);
      range.collapse(true);
      getSelection()!.removeAllRanges();
      getSelection()!.addRange(range);
      el.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          isComposing: true,
          inputType: 'insertCompositionText',
          data: 'ภาษาไทย',
        }),
      );
      document.dispatchEvent(new Event('selectionchange'));
    });
    await expect(page.getByTestId('change-count')).toHaveText(count);
    await expect(editor.locator('code')).toHaveCount(0);
    if (finalize === 'blur') await page.getByRole('button', { name: 'Rerender parent' }).click();
    else await editor.dispatchEvent('compositionend', { data: 'ภาษาไทย' });
    await editor.dispatchEvent('compositionend');
    await editor.dispatchEvent('input');
    await expect(editor).toHaveText('Heภาษาไทยllo InkForge');
    await expect(editor.locator('code')).toHaveText('ภาษาไทย');
    await expect(editor.locator('s')).toHaveText('ภาษาไทย');
    const html = await page.getByTestId('controlled-html').innerText();
    expect(html).toContain('background-color: rgb(220, 38, 38); color: rgb(220, 38, 38)');
    expect(html).not.toMatch(/<strong>[^<]*ภาษาไทย/);
    expect(Number(await page.getByTestId('change-count').innerText())).toBe(Number(count) + 1);
  });

test('mark and alignment pressed states cover every selected leaf and semantic block', async ({
  page,
}) => {
  const editor = article(page);
  await fixture(
    editor,
    '<p style="text-align: center"><code><s>first</s></code> plain</p><h2 style="text-align: right"><code>second</code></h2><p style="text-align: center"><code><s>third</s></code></p>',
  );
  await select(editor, 1);
  await expect(button(page, 'Inline code')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'Strikethrough')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'Align center')).toHaveAttribute('aria-pressed', 'true');
  await select(editor, 1, 8);
  await expect(button(page, 'Inline code')).toHaveAttribute('aria-pressed', 'false');
  await expect(button(page, 'Strikethrough')).toHaveAttribute('aria-pressed', 'false');
  await expect(button(page, 'Align center')).toHaveAttribute('aria-pressed', 'true');
  await select(editor, 1, 15);
  for (const name of ['Align left', 'Align center', 'Align right', 'Align justify'])
    await expect(button(page, name)).toHaveAttribute('aria-pressed', 'false');
  await select(editor, 12);
  await expect(button(page, 'Inline code')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'Strikethrough')).toHaveAttribute('aria-pressed', 'false');
  await expect(button(page, 'Align right')).toHaveAttribute('aria-pressed', 'true');
});

test('panels near the viewport bottom flip and keep their final controls reachable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 500 });
  const editor = article(page);
  await select(editor, 1, 4);
  await toolbar(page).evaluate((el) => {
    (el as HTMLElement).style.position = 'fixed';
    (el as HTMLElement).style.bottom = '8px';
    (el as HTMLElement).style.left = '20px';
    (el as HTMLElement).style.width = 'min(500px,calc(100vw - 40px))';
  });
  await button(page, 'Text color').click();
  const panel = toolbar(page).getByRole('dialog');
  const bounds = await panel.boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(500);
  await toolbar(page).getByRole('button', { name: 'Cancel', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(panel).toHaveCount(0);
});

test('a foreign document selection invalidates a focused popup without an outside click', async ({
  page,
}) => {
  const editor = article(page);
  await select(editor, 0, 5);
  await button(page, 'Link').click();
  const url = toolbar(page).getByRole('textbox', { name: 'URL' });
  await url.fill('/should-not-apply');
  await page.evaluate(() => {
    const foreign = document.querySelector('h1')!;
    const range = document.createRange();
    range.selectNodeContents(foreign);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await expect(toolbar(page).getByRole('dialog')).toHaveCount(0);
  await expect(editor.locator('a')).toHaveCount(0);
  await expect(page.getByTestId('change-count')).toHaveText('0');
});

test('CSS fallback and inherited span colors survive the browser HTML boundary', async ({
  page,
}) => {
  const editor = article(page);
  await fixture(
    editor,
    '<p><span style="color: red; color: not-a-color">fallback</span><span style="color: red"><span style="color: inherit">inherited</span></span></p>',
  );
  await page.getByRole('button', { name: 'Rerender parent' }).click();
  await expect(editor.getByText('fallback', { exact: true })).toHaveCSS('color', 'rgb(255, 0, 0)');
  await expect(editor.getByText('inherited', { exact: true })).toHaveCSS('color', 'rgb(255, 0, 0)');
  const html = await page.getByTestId('controlled-html').innerText();
  expect(html).toContain('color: red; color: not-a-color');
  expect(html).not.toContain('inherit;');
});

test('Link query ampersands and quotes round-trip without corrupting the href', async ({
  page,
}) => {
  const editor = article(page);
  await select(editor, 0, 5);
  const href = 'https://example.com/?a=1&b="two"';
  await button(page, 'Link').click();
  await toolbar(page).getByRole('textbox', { name: 'URL' }).fill(href);
  await toolbar(page).getByRole('button', { name: 'Apply link', exact: true }).click();
  await expect(editor.locator('a')).toHaveAttribute('href', href);
  await expect(page.getByTestId('controlled-html')).toContainText(
    'href="https://example.com/?a=1&amp;b=&quot;two&quot;"',
  );
  await page.getByRole('button', { name: 'Rerender parent' }).click();
  await expect(editor.locator('a')).toHaveAttribute('href', href);
  await select(editor, 2);
  await button(page, 'Link').click();
  await expect(toolbar(page).getByRole('textbox', { name: 'URL' })).toHaveValue(href);
});

test('pending composition formatting covers the owned replacement range only', async ({ page }) => {
  const editor = article(page);
  await select(editor, 2);
  await button(page, 'Inline code').click();
  await editor.evaluate((el) => {
    const node = el.querySelector('p')!.firstChild!;
    const range = document.createRange();
    range.setStart(node, 2);
    range.setEnd(node, 4);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    range.deleteContents();
    const text = document.createTextNode('ไทย');
    range.insertNode(text);
    range.setStart(text, text.length);
    range.collapse(true);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    el.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        isComposing: true,
        inputType: 'insertCompositionText',
        data: 'ไทย',
      }),
    );
  });
  await editor.dispatchEvent('compositionend', { data: 'ไทย' });
  await expect(editor).toHaveText('Heไทยo InkForge');
  await expect(editor.locator('code')).toHaveText('ไทย');
  await expect(editor.locator('strong')).toHaveText('InkForge');
  await expect(page.getByTestId('change-count')).toHaveText('1');
});
