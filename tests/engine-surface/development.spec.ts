import { test, expect } from '@playwright/test';
test('CD01 actual development effect replay retains a borrowed controller and one editable surface', async ({
  page,
}) => {
  await page.goto('/engine');
  const editor = page.getByRole('textbox', { name: 'Engine body' });
  await expect(editor).toBeEditable();
  const replay = await page.evaluate(() =>
    (
      window as unknown as { u07c: { cleanup(): { setups: number; cleanups: number } } }
    ).u07c.cleanup(),
  );
  expect(replay.setups).toBeGreaterThanOrEqual(2);
  expect(replay.cleanups).toBeGreaterThanOrEqual(1);
  await editor.focus();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('Strict replay');
  await expect(page.getByTestId('revision')).toHaveText('1');
  await expect(page.getByTestId('disposed')).toHaveText('false');
  await page.keyboard.press('Control+z');
  await expect(editor).toHaveText('สวัสดี editor');
});

test('CD02 native listeners and observers return to baseline after repeated surface disposal', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const entries: {
      target: EventTarget;
      name: string;
      listener: EventListenerOrEventListenerObject;
      capture: boolean;
    }[] = [];
    const add = EventTarget.prototype.addEventListener,
      remove = EventTarget.prototype.removeEventListener;
    const capture = (value?: boolean | AddEventListenerOptions | EventListenerOptions) =>
      typeof value === 'boolean' ? value : (value?.capture ?? false);
    EventTarget.prototype.addEventListener = function (name, listener, options) {
      if (
        listener &&
        !entries.some(
          (e) =>
            e.target === this &&
            e.name === name &&
            e.listener === listener &&
            e.capture === capture(options),
        )
      )
        entries.push({ target: this, name, listener, capture: capture(options) });
      return add.call(this, name, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (name, listener, options) {
      const i = entries.findIndex(
        (e) =>
          e.target === this &&
          e.name === name &&
          e.listener === listener &&
          e.capture === capture(options),
      );
      if (i >= 0) entries.splice(i, 1);
      return remove.call(this, name, listener, options);
    };
    const observed = new Set<MutationObserver>(),
      NativeObserver = MutationObserver;
    window.MutationObserver = class extends NativeObserver {
      observe(target: Node, options: MutationObserverInit) {
        if (
          target instanceof HTMLElement &&
          target.classList.contains('inkforge-engine-editor') &&
          !target.hasAttribute('aria-label')
        )
          observed.add(this);
        return super.observe(target, options);
      }
      disconnect() {
        observed.delete(this);
        return super.disconnect();
      }
    };
    Object.assign(window, {
      engineResources: () => ({
        main: entries.filter(
          (e) =>
            e.target instanceof HTMLElement &&
            e.target.classList.contains('inkforge-engine-editor') &&
            !e.target.hasAttribute('aria-label'),
        ).length,
        selection: entries.filter((e) => e.target === document && e.name === 'selectionchange')
          .length,
        observers: observed.size,
      }),
    });
  });
  await page.goto('/engine');
  await expect(page.getByRole('textbox', { name: 'Engine body' })).toBeEditable();
  const read = () =>
    page.evaluate(() =>
      (
        window as unknown as {
          engineResources(): { main: number; selection: number; observers: number };
        }
      ).engineResources(),
    );
  const baseline = await read();
  expect(baseline.main).toBeGreaterThan(0);
  expect(baseline.observers).toBe(1);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() =>
      (window as unknown as { u07c: { toggleMount(): void } }).u07c.toggleMount(),
    );
    await expect(page.getByRole('textbox', { name: 'Engine body' })).toHaveCount(0);
    expect(await read()).toEqual({ main: 0, selection: baseline.selection - 1, observers: 0 });
    await page.evaluate(() =>
      (window as unknown as { u07c: { toggleMount(): void } }).u07c.toggleMount(),
    );
    await expect(page.getByRole('textbox', { name: 'Engine body' })).toBeEditable();
    expect(await read()).toEqual(baseline);
  }
});
