import { expect, test, type Locator } from '@playwright/test';

const article = (page: import('@playwright/test').Page) =>
  page.getByRole('textbox', { name: 'Article body', exact: true });

async function caret(editor: Locator, position: number) {
  await editor.evaluate((element, offset) => {
    element.focus();
    const node = element.querySelector('p')?.firstChild ?? element.firstChild ?? element;
    const selection = element.ownerDocument.getSelection()!;
    selection.setBaseAndExtent(node, offset, node, offset);
  }, position);
}

async function paste(editor: Locator, html: string, text = '') {
  await editor.evaluate(
    (element, clipboard) => {
      // Firefox strips synthetic DataTransfer contents. Supply the event's
      // read-only clipboard contract directly so every engine receives the fixture.
      const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', {
        value: {
          getData: (format: string) => (format === 'text/html' ? clipboard.html : clipboard.text),
        },
      });
      element.dispatchEvent(event);
    },
    { html, text },
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('controlled echoes, parent rerenders, and blur retain caret', async ({ page }) => {
  const editor = article(page);
  await caret(editor, 3);
  await page.keyboard.type('XY');
  await expect(editor).toHaveText('HelXYlo InkForge');
  await expect(page.getByTestId('controlled-html')).toContainText('HelXYlo');
  // A click would move focus; trigger the parent update without changing selection.
  await page
    .getByRole('button', { name: 'Rerender parent' })
    .evaluate((button: HTMLButtonElement) => button.click());
  await page.keyboard.type('Z');
  await expect(editor).toHaveText('HelXYZlo InkForge');
  await expect(page.getByTestId('change-count')).toHaveText('3');
  await expect(editor.locator('strong')).toHaveText('InkForge');
});

test('external replacements and reset follow props; defaultValue is one-time', async ({ page }) => {
  const editor = article(page);
  await page.getByRole('button', { name: 'Replace value' }).click();
  await expect(editor.locator('h2')).toHaveText('External replacement');
  await page.getByRole('button', { name: 'Reset controlled' }).click();
  await expect(editor).toHaveText('Hello InkForge');
  const uncontrolled = page.getByRole('textbox', { name: 'Uncontrolled article' });
  await uncontrolled.fill('My draft');
  await page.getByRole('button', { name: 'Change default prop' }).click();
  await expect(uncontrolled).toHaveText('My draft');
  await expect(page.getByTestId('uncontrolled-html')).toHaveText('<p>My draft</p>');
});

test('unsafe external values and formatted paste are sanitized before insertion', async ({
  page,
}) => {
  const editor = article(page);
  await page.getByRole('button', { name: 'Load unsafe HTML' }).click();
  await expect(editor).toHaveText('Safe link');
  await expect(editor.locator('script, [onclick], [href^="javascript:"]')).toHaveCount(0);
  await expect(page.getByTestId('diagnostics')).toContainText('UNSAFE_TAG');
  await page.getByRole('button', { name: 'Clear controlled' }).click();
  await editor.focus();
  await editor.evaluate((element) => {
    const seen: string[] = [];
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) {
          if (
            node instanceof Element &&
            (node.matches('script,[onclick],[href^="javascript:"]') ||
              node.querySelector('script,[onclick],[href^="javascript:"]'))
          )
            seen.push(node.outerHTML);
        }
    }).observe(element, { childList: true, subtree: true });
    (element as HTMLElement & { unsafeSeen?: string[] }).unsafeSeen = seen;
  });
  await paste(
    editor,
    '<h2 onclick="evil()">Heading</h2><p><strong>Bold</strong> <a href="https://example.com">link</a><br>Line</p><ul><li>Item</li></ul><script>evil()</script>',
  );
  await expect(editor.locator('h2')).toHaveText('Heading');
  await expect(editor.locator('strong')).toHaveText('Bold');
  await expect(editor.locator('a')).toHaveAttribute('href', 'https://example.com');
  await expect(editor.locator('br')).toHaveCount(1);
  await expect(editor.locator('li')).toHaveText('Item');
  expect(
    await editor.evaluate(
      (element) => (element as HTMLElement & { unsafeSeen?: string[] }).unsafeSeen,
    ),
  ).toEqual([]);
  await expect(page.getByTestId('controlled-html')).not.toContainText('script');
  await expect(page.getByTestId('diagnostics')).toContainText('UNSAFE_TAG');
});

test('paste in a paragraph retains surrounding text, marks, line breaks and caret', async ({
  page,
}) => {
  const editor = article(page);
  await caret(editor, 3);
  await paste(editor, '<p><em>Paste</em><br>line</p>');
  await expect(editor.locator('em')).toHaveText('Paste');
  await expect(editor.locator('br')).toHaveCount(1);
  await expect(editor).toContainText('Hel');
  await expect(editor).toContainText('lo InkForge');
  await page.keyboard.type('!');
  await expect(page.getByTestId('controlled-html')).toContainText('line!');
});

test('plain clipboard text is escaped and Enter preserves separate lines', async ({ page }) => {
  const editor = article(page);
  await page.getByRole('button', { name: 'Clear controlled' }).click();
  await editor.focus();
  await paste(editor, '', '<script>safe text</script>\nnext');
  await expect(editor).toContainText('<script>safe text</script>');
  await expect(editor.locator('script')).toHaveCount(0);
  await editor.fill('first');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('second');
  await page.getByRole('button', { name: 'Rerender parent' }).click();
  await expect(page.getByTestId('controlled-html')).toContainText('<p>first</p><p>second</p>');
});

for (const finalize of ['compositionend', 'blur']) {
  test(`composition defers emissions and DOM normalization until ${finalize}`, async ({ page }) => {
    const editor = article(page);
    await editor.focus();
    await editor.evaluate((element) => {
      element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      element.innerHTML = '<div>ภาษาไทย</div>';
      element.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          isComposing: true,
          inputType: 'insertCompositionText',
          data: 'ภาษาไทย',
        }),
      );
    });
    await expect(page.getByTestId('change-count')).toHaveText('0');
    await expect(editor.locator('div')).toHaveText('ภาษาไทย');
    if (finalize === 'blur') await page.getByRole('button', { name: 'Rerender parent' }).click();
    else await editor.dispatchEvent('compositionend', { data: 'ภาษาไทย' });
    await editor.dispatchEvent('input');
    await editor.dispatchEvent('compositionend');
    await expect(page.getByTestId('change-count')).toHaveText('1');
    await expect(editor.locator('p')).toHaveText('ภาษาไทย');
    await expect(page.getByTestId('controlled-html')).toHaveText('<p>ภาษาไทย</p>');
  });
}

test('composition defers external replacements until committed', async ({ page }) => {
  const editor = article(page);
  await editor.focus();
  await editor.dispatchEvent('compositionstart');
  await editor.evaluate((element) => {
    element.innerHTML = '<div>กำลังพิมพ์</div>';
  });
  await page
    .getByRole('button', { name: 'Replace value' })
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(editor).toHaveText('กำลังพิมพ์');
  await editor.dispatchEvent('compositionend');
  await expect(editor).toHaveText('External replacementNew draft');
});

test('keyboard focus, ref, empty input, disabled and read-only semantics', async ({ page }) => {
  const editor = article(page);
  await expect(editor).toHaveAttribute('aria-multiline', 'true');
  await page.getByLabel('Reject controlled edits', { exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(editor).toBeFocused();
  expect(await editor.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid');
  await page.getByRole('button', { name: 'Focus editor', exact: true }).click();
  await expect(editor).toBeFocused();
  await page.getByLabel('Read only', { exact: true }).check();
  await expect(editor).toHaveAttribute('aria-readonly', 'true');
  await editor.focus();
  await page.keyboard.type('blocked');
  await expect(editor).toHaveText('Hello InkForge');
  await paste(editor, '<p>blocked paste</p>');
  await expect(editor).toHaveText('Hello InkForge');
  await page.getByLabel('Disabled', { exact: true }).check();
  await expect(editor).toHaveAttribute('aria-disabled', 'true');
  await expect(editor).toHaveAttribute('tabindex', '-1');
  await expect(editor).toHaveAttribute('contenteditable', 'false');
  await page.getByLabel('Disabled', { exact: true }).uncheck();
  await page.getByLabel('Read only', { exact: true }).uncheck();
  await editor.fill('');
  await expect(editor).toBeEmpty();
  await expect(page.getByTestId('controlled-html')).toHaveText('');
  await expect(page.getByRole('textbox', { name: 'Empty article' })).toBeEmpty();
});

test('Next.js server route hydrates and edits without runtime errors', async ({
  page,
  request,
}) => {
  const response = await request.get('http://127.0.0.1:4174/editor');
  expect(await response.text()).toContain('Server rendered <strong>draft</strong>');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:4174/editor');
  const editor = article(page);
  await expect(editor).toHaveText('Server rendered draft');
  await editor.fill('Hydrated edit');
  await expect(page.getByTestId('next-html')).toHaveText('<p>Hydrated edit</p>');
  await page.getByRole('button', { name: 'Reset editor' }).click();
  await expect(editor).toHaveText('Reset from Next.js');
  await page.goto('http://127.0.0.1:4174/');
  await expect(page.getByRole('heading', { name: 'Public content route' })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('controlled host can reject edits while receiving sanitized changes', async ({ page }) => {
  const editor = article(page);
  await page.getByLabel('Reject controlled edits', { exact: true }).check();
  await caret(editor, 3);
  await page.keyboard.type('X');
  await expect(page.getByTestId('change-count')).toHaveText('1');
  await expect(editor).toHaveText('Hello InkForge');
  await expect(page.getByTestId('controlled-html')).toHaveText(
    '<p>Hello <strong>InkForge</strong></p>',
  );
});

test('controlled value reconciles even without a change callback or parent update', async ({
  page,
}) => {
  const editor = page.getByRole('textbox', { name: 'Fixed article', exact: true });
  await editor.fill('Rejected edit');
  await expect(editor).toHaveText('Fixed draft');
});

test('blur normalization preserves a caret after a hard break', async ({ page }) => {
  const editor = page.getByRole('textbox', { name: 'Uncontrolled article' });
  await editor.focus();
  await editor.evaluate((element) => {
    element.innerHTML = '<div>ab<b>cd</b><br>ef</div>';
    element.dispatchEvent(new InputEvent('input', { bubbles: true }));
    const text = element.firstChild!.lastChild!;
    element.ownerDocument.getSelection()!.setBaseAndExtent(text, 0, text, 0);
    element.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
  await expect(editor.locator('strong')).toHaveText('cd');
  await page.keyboard.type('X');
  await expect(page.getByTestId('uncontrolled-html')).toHaveText(
    '<p>ab<strong>cd</strong><br>Xef</p>',
  );
});

test('external replacement preserves an active selection and keeps typing at its offset', async ({
  page,
}) => {
  const editor = article(page);
  await caret(editor, 3);
  await page
    .getByRole('button', { name: 'Replace value' })
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(editor.locator('h2')).toHaveText('External replacement');
  await page.keyboard.type('X');
  await expect(editor.locator('h2')).toHaveText('ExtXernal replacement');
});

for (const fixture of [
  { name: 'paragraphs', html: '<p>abcd</p><p>efgh</p>', selector: 'p', expected: '<p>abXgh</p>' },
  {
    name: 'list items',
    html: '<ul><li>abcd</li><li>efgh</li></ul>',
    selector: 'li',
    expected: '<ul><li>abXgh</li></ul>',
  },
  {
    name: 'paragraph into a list item',
    html: '<p>abcd</p><ul><li>efgh</li></ul>',
    selector: 'p,li',
    expected: '<p>abXgh</p>',
  },
  {
    name: 'list item into a paragraph',
    html: '<ul><li>abcd</li></ul><p>efgh</p>',
    selector: 'li,p',
    expected: '<ul><li>abXgh</li></ul>',
  },
  {
    name: 'paragraphs in list items',
    html: '<ul><li><p>abcd</p></li><li><p>efgh</p></li></ul>',
    selector: 'p',
    expected: '<ul><li>abXgh</li></ul>',
  },
]) {
  test(`regression: paragraph paste merges surviving ${fixture.name}`, async ({ page }) => {
    const editor = page.getByRole('textbox', { name: 'Uncontrolled article' });
    await editor.evaluate((element, data) => {
      element.focus();
      element.innerHTML = data.html;
      const blocks = element.querySelectorAll(data.selector);
      element.ownerDocument
        .getSelection()!
        .setBaseAndExtent(blocks[0]!.firstChild!, 2, blocks[1]!.firstChild!, 2);
    }, fixture);
    await paste(editor, '<p>X</p>');
    await expect(page.getByTestId('uncontrolled-html')).toHaveText(fixture.expected);
    await page.keyboard.type('!');
    await expect(editor).toHaveText('abX!gh');
  });
}

test('regression: sanitized-empty clipboard leaves the selected text unchanged', async ({
  page,
}) => {
  const editor = article(page);
  await editor.evaluate((element) => {
    element.focus();
    const text = element.querySelector('p')!.firstChild!;
    element.ownerDocument.getSelection()!.setBaseAndExtent(text, 1, text, 4);
  });
  await paste(editor, '<script>removed()</script>');
  await expect(editor).toHaveText('Hello InkForge');
  await expect(page.getByTestId('change-count')).toHaveText('0');
  expect(await editor.evaluate((element) => element.ownerDocument.getSelection()!.toString())).toBe(
    'ell',
  );
});

test('regression: inline plain paste keeps typing between insertion and suffix', async ({
  page,
}) => {
  const editor = article(page);
  await caret(editor, 3);
  await paste(editor, '<p>PASTE</p>');
  await page.keyboard.type('!');
  await expect(editor).toHaveText('HelPASTE!lo InkForge');
});

test('regression: wrapper normalization preserves break offsets and backward selection', async ({
  page,
}) => {
  const editor = page.getByRole('textbox', { name: 'Uncontrolled article' });
  await editor.evaluate((element) => {
    element.focus();
    element.innerHTML = '<div><span>ab</span><br><font>cd</font><b>ef</b></div>';
    const block = element.firstChild!;
    element.ownerDocument
      .getSelection()!
      .setBaseAndExtent(block.childNodes[2]!.firstChild!, 1, block.childNodes[2]!.firstChild!, 1);
    element.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
  await page.keyboard.type('!');
  await expect(page.getByTestId('uncontrolled-html')).toHaveText(
    '<p>ab<br>c!d<strong>ef</strong></p>',
  );
  await editor.evaluate((element) => {
    element.innerHTML = '<div><span>ab</span><b>cd</b><i>ef</i></div>';
    const block = element.firstChild!;
    element.ownerDocument
      .getSelection()!
      .setBaseAndExtent(block.lastChild!.firstChild!, 1, block.firstChild!.firstChild!, 1);
    element.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
  const selection = await editor.evaluate((element) => {
    const selected = element.ownerDocument.getSelection()!;
    return {
      text: selected.toString(),
      anchor: selected.anchorNode?.textContent,
      anchorOffset: selected.anchorOffset,
      focus: selected.focusNode?.textContent,
      focusOffset: selected.focusOffset,
    };
  });
  expect(selection).toEqual({
    text: 'bcde',
    anchor: 'ef',
    anchorOffset: 1,
    focus: 'ab',
    focusOffset: 1,
  });
  await page.keyboard.type('X');
  await expect(editor).toHaveText('aXf');
});

for (const position of ['start', 'end']) {
  for (const html of ['<h2>Heading</h2>', '<p>one</p><p>two</p>']) {
    test(`regression: block paste ${html.startsWith('<h2>') ? 'heading' : 'paragraphs'} at ${position} keeps caret inside final block`, async ({
      page,
    }) => {
      const editor = page.getByRole('textbox', { name: 'Uncontrolled article' });
      await editor.evaluate((element, atStart) => {
        element.focus();
        element.innerHTML = '<p>original</p>';
        const text = element.firstChild!.firstChild!;
        const offset = atStart ? 0 : 8;
        element.ownerDocument.getSelection()!.setBaseAndExtent(text, offset, text, offset);
      }, position === 'start');
      await paste(editor, html);
      await page.keyboard.type('!');
      const expectedPaste = html.startsWith('<h2>') ? '<h2>Heading!</h2>' : '<p>one</p><p>two!</p>';
      await expect(page.getByTestId('uncontrolled-html')).toHaveText(
        position === 'start'
          ? expectedPaste + '<p>original</p>'
          : '<p>original</p>' + expectedPaste,
      );
    });
  }
}

for (const deferred of [false, true]) {
  test(`regression: ${deferred ? 'deferred' : 'external'} hard break survives blur after deletion`, async ({
    page,
  }) => {
    const editor = article(page);
    await editor.fill('');
    if (deferred) await editor.dispatchEvent('compositionstart');
    await page
      .getByRole('button', { name: 'Load hard break', exact: true })
      .evaluate((button: HTMLButtonElement) => button.click());
    if (deferred) await editor.dispatchEvent('compositionend');
    await expect(editor.locator('p > br')).toHaveCount(1);
    await editor.dispatchEvent('blur');
    await editor.evaluate((element) =>
      element.dispatchEvent(new FocusEvent('focusout', { bubbles: true })),
    );
    await expect(page.getByTestId('controlled-html')).toHaveText('<p><br></p>');
    await expect(editor.locator('p > br')).toHaveCount(1);
  });
}

test('regression: diagnostics mount once, preserve immediate echo and clear historical clean replacement', async ({
  page,
}) => {
  const editor = article(page);
  await expect(page.getByTestId('diagnostic-count')).toHaveText('1');
  await editor.evaluate((element) => {
    element.innerHTML = '<p>Temporary</p>';
    element.dispatchEvent(new InputEvent('input', { bubbles: true }));
  });
  await expect(page.getByTestId('diagnostic-count')).toHaveText('2');
  await editor.evaluate((element) => {
    element.innerHTML = '<p>Hello <strong>InkForge</strong></p>';
    element.dispatchEvent(new InputEvent('input', { bubbles: true }));
  });
  await expect(page.getByTestId('diagnostic-count')).toHaveText('3');
  await page
    .getByRole('button', { name: 'Load unsafe HTML' })
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByTestId('diagnostics')).toContainText('UNSAFE_TAG');
  await page
    .getByRole('button', { name: 'Reset controlled' })
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByTestId('diagnostics')).toHaveText('[]');
  await expect(page.getByTestId('diagnostic-count')).toHaveText('5');
});

test('regression: clipboard block wrapper keeps paragraph boundaries', async ({ page }) => {
  const editor = page.getByRole('textbox', { name: 'Empty article' });
  await editor.focus();
  await paste(editor, '<div><p>one</p><p>two</p></div>');
  await expect(editor.locator('p')).toHaveText(['one', 'two']);
  await page.keyboard.type('!');
  await expect(editor.locator('p')).toHaveText(['one', 'two!']);
});

test('regression: drop is prevented without changing DOM or emitted HTML', async ({ page }) => {
  const editor = article(page);
  const before = await editor.innerHTML();
  const prevented = await editor.evaluate((element) => {
    const event = new Event('drop', { bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(true);
  expect(await editor.innerHTML()).toBe(before);
  await expect(page.getByTestId('change-count')).toHaveText('0');
  await expect(page.getByTestId('controlled-html')).toHaveText(before);
});
