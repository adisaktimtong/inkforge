import { test, expect, type Page } from '@playwright/test';
const editor = (p: Page) => p.getByRole('textbox', { name: 'Engine body' });
const toolbar = (p: Page) =>
  p
    .locator('[data-ui-scope="engine-main"]:not([data-ui-portal-root])')
    .getByRole('toolbar', { name: 'Text formatting' });
async function load(p: Page) {
  await p.goto('/engine');
  await expect(editor(p)).toBeEditable();
}
async function probe(p: Page, name: string) {
  return p.evaluate(
    (n) => (window as unknown as { u07c: Record<string, () => unknown> }).u07c[n](),
    name,
  );
}
async function select(p: Page) {
  await editor(p).focus();
  await p.keyboard.press('Control+a');
  await expect
    .poll(() =>
      p.evaluate(() => {
        const s = (
          window as unknown as {
            u07c: { snapshot(): { selection: { anchor: unknown; head: unknown } } };
          }
        ).u07c.snapshot();
        return JSON.stringify(s.selection.anchor) !== JSON.stringify(s.selection.head);
      }),
    )
    .toBe(true);
}
async function model(p: Page) {
  return JSON.parse((await p.getByTestId('model').textContent())!);
}
const text = (n: {
  type: string;
  text?: string;
  children?: unknown[];
  items?: unknown[];
}): string =>
  n.type === 'text'
    ? (n.text ?? '')
    : n.type === 'hard-break'
      ? '\n'
      : (n.children ?? n.items ?? []).map((c) => text(c as Parameters<typeof text>[0])).join('');

test('C01 packed surface hydrates, wires Field ARIA and uses actual shared roving Toolbar', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await load(page);
  await expect(toolbar(page)).toHaveAttribute('data-ui-navigation', 'roving');
  await expect(toolbar(page).getByRole('button', { name: 'Bold', exact: true })).toHaveClass(
    /ui-button/,
  );
  await expect(editor(page)).toHaveAccessibleDescription('Controller-owned rich text');
  expect(errors).toEqual([]);
});
test('C02 real typing updates the granular model and Ctrl-Z restores one typing group', async ({
  page,
}) => {
  await load(page);
  await select(page);
  await page.keyboard.insertText('ภาษาไทย');
  expect(text(await model(page))).toBe('ภาษาไทย');
  await expect(page.getByTestId('revision')).toHaveText('1');
  await page.keyboard.press('Control+z');
  expect(text(await model(page))).toBe('สวัสดี editor');
  await expect(page.getByTestId('revision')).toHaveText('2');
});
test('C03 selection bookmark survives native pointer focus and formatting is one engine transaction', async ({
  page,
}) => {
  await load(page);
  await select(page);
  const before = await page.getByTestId('epoch').textContent();
  await toolbar(page).getByRole('button', { name: 'Bold', exact: true }).click();
  await expect(editor(page).locator('strong')).toHaveText('สวัสดี editor');
  await expect(page.getByTestId('revision')).toHaveText('1');
  await expect(page.getByTestId('epoch')).toHaveText(before!);
  await page.keyboard.press('Control+z');
  await expect(editor(page).locator('strong')).toHaveCount(0);
});
test('C04 Enter over a selection deletes and splits in exactly one revision and history entry', async ({
  page,
}) => {
  await load(page);
  await select(page);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('revision')).toHaveText('1');
  expect((await model(page)).children).toHaveLength(2);
  await page.keyboard.press('Control+z');
  expect(text(await model(page))).toBe('สวัสดี editor');
});
test('C05 Shift-Enter inserts a model hard break and preserves the editable native div', async ({
  page,
}) => {
  await load(page);
  await editor(page).evaluate((el) => Object.assign(window, { originalEngineDiv: el }));
  await editor(page).focus();
  await page.keyboard.press('End');
  await page.keyboard.press('Shift+Enter');
  expect(
    (await model(page)).children[0].children.some((n: { type: string }) => n.type === 'hard-break'),
  ).toBe(true);
  expect(
    await editor(page).evaluate(
      (el) => el === (window as unknown as { originalEngineDiv: Element }).originalEngineDiv,
    ),
  ).toBe(true);
});
test('C06 native grapheme backspace removes an emoji cluster without code-unit fallback', async ({
  page,
}) => {
  await load(page);
  await select(page);
  await page.keyboard.insertText('ก้👩‍👩‍👧‍👦');
  await page.keyboard.press('Backspace');
  expect(text(await model(page))).toBe('ก้');
});
test('C07 native composition blocks checkpoint/toolbar and commits once on browser end', async ({
  page,
}) => {
  await load(page);
  await select(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: 'ทดสอบ', selectionStart: 5, selectionEnd: 5 });
  await expect(page.getByTestId('composing')).toHaveText('true');
  await expect(toolbar(page).getByRole('button', { name: 'Bold', exact: true })).toBeDisabled();
  expect(((await probe(page, 'checkpoint')) as { status: string }).status).toBe('rejected');
  await expect(page.getByTestId('revision')).toHaveText('0');
  await cdp.send('Input.insertText', { text: 'ทดสอบ' });
  await expect(page.getByTestId('composing')).toHaveText('false');
  expect(text(await model(page))).toBe('ทดสอบ');
  await expect(editor(page)).toHaveText('ทดสอบ');
  await expect(page.getByTestId('revision')).toHaveText('1');
  await cdp.detach();
});
test('C08 presentation changes keep native composition editable and uncommitted', async ({
  page,
}) => {
  await load(page);
  await select(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: 'ทดสอบ', selectionStart: 5, selectionEnd: 5 });
  await editor(page).evaluate((el) => {
    const changes: string[] = [];
    const observer = new MutationObserver((records) =>
      records.forEach((r) => changes.push(r.attributeName!)),
    );
    observer.observe(el, {
      attributes: true,
      attributeFilter: ['contenteditable', 'aria-readonly', 'aria-disabled'],
    });
    Object.assign(window, { compositionProbe: { changes, observer, el } });
  });
  await probe(page, 'presentation');
  await expect(editor(page)).toBeEditable();
  expect(
    await editor(page).evaluate((el) => {
      const p = (
        window as unknown as {
          compositionProbe: { changes: string[]; observer: MutationObserver; el: Element };
        }
      ).compositionProbe;
      p.observer.disconnect();
      return { changes: p.changes, same: el === p.el };
    }),
  ).toEqual({ changes: [], same: true });
  await expect(page.getByTestId('revision')).toHaveText('0');
  await cdp.send('Input.insertText', { text: 'ทดสอบ' });
  await expect(page.getByTestId('revision')).toHaveText('1');
  await cdp.detach();
});
test('C09 old pointer release cannot restamp selection or fence after context replacement', async ({
  page,
}) => {
  await load(page);
  await select(page);
  const b = await toolbar(page).getByRole('button', { name: 'Bold', exact: true }).boundingBox();
  if (!b) throw Error('No toolbar');
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await probe(page, 'context');
  await expect(page.locator('[data-ui-adapter="inkforge"]')).toHaveAttribute(
    'data-ui-adapter-context',
    'owner-B',
  );
  await page.mouse.up();
  await expect(page.getByTestId('revision')).toHaveText('0');
  await expect(editor(page).locator('strong')).toHaveCount(0);
});
test('C10 stale composition retains a blocked draft after owner context changes', async ({
  page,
}) => {
  await load(page);
  await select(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: 'ทดสอบ', selectionStart: 5, selectionEnd: 5 });
  await probe(page, 'context');
  await cdp.send('Input.insertText', { text: 'ทดสอบ' });
  await expect(page.getByTestId('status')).toHaveText('invalidDraft');
  await expect(editor(page)).not.toBeEditable();
  await expect(page.getByTestId('revision')).toHaveText('0');
  expect(text(await model(page))).toBe('สวัสดี editor');
  expect(((await probe(page, 'checkpoint')) as { status: string }).status).toBe('rejected');
  await cdp.detach();
});
test('C11 independent borrowed controllers do not share commands or native history', async ({
  page,
}) => {
  await load(page);
  const other = page.getByRole('textbox', { name: 'Other engine' });
  await other.focus();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('Other');
  await expect(editor(page)).toHaveText('สวัสดี editor');
  await expect(page.getByTestId('revision')).toHaveText('0');
  await page.keyboard.press('Control+z');
  await expect(other).toHaveText('สวัสดี editor');
});
test('C12 toggling toolbar and remounting the surface retain borrowed engine content/history', async ({
  page,
}) => {
  await load(page);
  await select(page);
  await page.keyboard.insertText('Kept');
  await page.getByRole('button', { name: 'Toggle toolbar' }).click();
  await expect(editor(page)).toHaveText('Kept');
  await probe(page, 'toggleMount');
  await expect(editor(page)).toHaveCount(0);
  await expect(page.getByTestId('disposed')).toHaveText('false');
  await probe(page, 'toggleMount');
  await expect(editor(page)).toBeEditable();
  await expect(editor(page)).toHaveText('Kept');
  await editor(page).focus();
  await page.keyboard.press('Control+z');
  expect(text(await model(page))).toBe('สวัสดี editor');
});
test('C13 plain-text multiline paste uses one transaction without inserting clipboard HTML', async ({
  page,
}) => {
  await load(page);
  await select(page);
  await editor(page).evaluate((el) => {
    const data = new DataTransfer();
    data.setData('text/plain', 'one\r\ntwo');
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
  });
  expect(text(await model(page))).toBe('one\ntwo');
  await expect(page.getByTestId('revision')).toHaveText('1');
  await editor(page).focus();
  await page.keyboard.press('Control+z');
  expect(text(await model(page))).toBe('สวัสดี editor');
});
test('C14 rich paste/drop/cut are explicitly gated and never mutate the model', async ({
  page,
}) => {
  await load(page);
  await select(page);
  await editor(page).evaluate((el) => {
    const data = new DataTransfer();
    data.setData('text/html', '<img src=x onerror=alert(1)>');
    data.setData('text/plain', 'lossy');
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
    el.dispatchEvent(new ClipboardEvent('cut', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true }));
  });
  await expect(page.getByTestId('revision')).toHaveText('0');
  await expect(editor(page).locator('img')).toHaveCount(0);
  await expect(page.getByTestId('diagnostics')).toContainText('RICH_PASTE_REQUIRES_SLICE');
});
test('C15 unsupported native DOM mutation is quarantined until an explicit discard', async ({
  page,
}) => {
  await load(page);
  await editor(page).evaluate((el) => {
    el.querySelector('[data-inkforge-type="text"]')!.appendChild(
      document.createTextNode('untracked'),
    );
  });
  await expect(page.getByTestId('status')).toHaveText('invalidDraft');
  await expect(page.getByTestId('revision')).toHaveText('0');
  await page.getByRole('button', { name: 'Discard draft' }).click();
  await expect(editor(page)).toBeEditable();
  await expect(editor(page)).toHaveText('สวัสดี editor');
});
test('C16 explicit external load changes session and patches the existing native surface', async ({
  page,
}) => {
  await load(page);
  await editor(page).evaluate((el) => Object.assign(window, { beforeExternal: el }));
  await probe(page, 'replace');
  await expect(editor(page)).toHaveText('Replacement');
  expect(
    await editor(page).evaluate(
      (el) => el === (window as unknown as { beforeExternal: Element }).beforeExternal,
    ),
  ).toBe(true);
  await expect(page.getByTestId('revision')).toHaveText('0');
});

test('C17 bounded noncancelable native replacement reconciles as one model transaction', async ({
  page,
}) => {
  await load(page);
  await select(page);
  await editor(page).evaluate((el) => {
    el.dispatchEvent(
      new InputEvent('beforeinput', {
        inputType: 'insertReplacementText',
        data: 'Corrected',
        bubbles: true,
        cancelable: false,
      }),
    );
    el.querySelector('[data-inkforge-type="text"]')!.firstChild!.nodeValue = 'Corrected';
    el.dispatchEvent(
      new InputEvent('input', {
        inputType: 'insertReplacementText',
        data: 'Corrected',
        bubbles: true,
      }),
    );
  });
  expect(text(await model(page))).toBe('Corrected');
  await expect(editor(page)).toHaveText('Corrected');
  await expect(page.getByTestId('revision')).toHaveText('1');
  await editor(page).focus();
  await page.keyboard.press('Control+z');
  expect(text(await model(page))).toBe('สวัสดี editor');
});
test('C18 unmount during native composition retains a blocked RAM draft for explicit review', async ({
  page,
}) => {
  await load(page);
  await select(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: 'ทดสอบ', selectionStart: 5, selectionEnd: 5 });
  await probe(page, 'toggleMount');
  await expect(editor(page)).toHaveCount(0);
  await expect(page.getByTestId('composing')).toHaveText('true');
  await probe(page, 'toggleMount');
  await expect(page.getByTestId('status')).toHaveText('invalidDraft');
  await expect(editor(page)).toHaveText('ทดสอบ');
  expect(((await probe(page, 'checkpoint')) as { status: string }).status).toBe('rejected');
  await page.getByRole('button', { name: 'Discard draft' }).click();
  await expect(editor(page)).toBeEditable();
  await expect(editor(page)).toHaveText('สวัสดี editor');
  await cdp.detach();
});
test('C19 disabling a composing surface does not force completion or accept its candidate', async ({
  page,
}) => {
  await load(page);
  await select(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: 'ทดสอบ', selectionStart: 5, selectionEnd: 5 });
  await probe(page, 'disabled');
  await expect(page.getByTestId('composing')).toHaveText('true');
  await expect(editor(page)).toHaveAttribute('contenteditable', 'true');
  await cdp.send('Input.insertText', { text: 'ทดสอบ' });
  await expect(page.getByTestId('status')).toHaveText('invalidDraft');
  await expect(page.getByTestId('revision')).toHaveText('0');
  await cdp.detach();
});
test('C20 a changed model selection invalidates an armed formatting bookmark without restamping', async ({
  page,
}) => {
  await load(page);
  await select(page);
  const button = toolbar(page).getByRole('button', { name: 'Bold', exact: true }),
    box = await button.boundingBox();
  if (!box) throw Error('Missing button');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await probe(page, 'move');
  await page.mouse.up();
  await expect(page.getByTestId('revision')).toHaveText('0');
  await expect(editor(page).locator('strong')).toHaveCount(0);
});
test('C21 native toolbar fallback keeps its originally captured host fence', async ({ page }) => {
  await load(page);
  const region = page.getByRole('region', { name: 'Independent native surface' }),
    other = region.getByRole('textbox');
  await other.focus();
  await page.keyboard.press('Control+a');
  const box = await region.getByRole('button', { name: 'Bold', exact: true }).boundingBox();
  if (!box) throw Error('Missing native button');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await probe(page, 'context');
  await expect(page.locator('[data-ui-adapter="inkforge"]')).toHaveAttribute(
    'data-ui-adapter-context',
    'owner-B',
  );
  await page.mouse.up();
  await expect(other.locator('strong')).toHaveCount(0);
});
test('C22 unsupported content presentation/link policy stays read-only without losing the model', async ({
  page,
}) => {
  await load(page);
  await probe(page, 'policy');
  await expect(editor(page)).not.toBeEditable();
  await expect(editor(page).locator('a')).not.toHaveAttribute('href', /./);
  await expect(editor(page).locator('[style]')).toHaveCount(0);
  expect(JSON.stringify(await model(page))).toContain('javascript:window.bad=true');
  await expect(page.getByTestId('diagnostics')).toContainText('CONTENT_POLICY_REQUIRED');
});

test('C23 terminal disposal clears even a native mutation queued in the same browser task', async ({
  page,
}) => {
  await load(page);
  await editor(page).evaluate((el) => {
    el.querySelector('[data-inkforge-type="text"]')!.appendChild(
      document.createTextNode('late-protected'),
    );
    (
      window as unknown as { u07c: { controller: { dispose(): unknown } } }
    ).u07c.controller.dispose();
  });
  await expect(page.getByTestId('disposed')).toHaveText('true');
  await expect(editor(page)).toHaveText('');
  await expect(editor(page)).not.toBeEditable();
});

test('C24 toolbar-focused undo remains with this controller and vetoes an outer history shortcut', async ({
  page,
}) => {
  await load(page);
  await select(page);
  await page.keyboard.insertText('Typed');
  await page.evaluate(() => {
    Object.assign(window, { outerUndo: 0 });
    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.defaultPrevented)
        (window as unknown as { outerUndo: number }).outerUndo++;
    });
  });
  await toolbar(page).getByRole('button', { name: 'Bold', exact: true }).focus();
  await page.keyboard.press('Control+z');
  expect(text(await model(page))).toBe('สวัสดี editor');
  expect(await page.evaluate(() => (window as unknown as { outerUndo: number }).outerUndo)).toBe(0);
  await expect(page.getByTestId('revision')).toHaveText('2');
});
