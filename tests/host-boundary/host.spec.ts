import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('/host');
  await page.waitForFunction(() => !!(window as any).u07d?.builder);
});
const editor = (page: any, kind = 'standalone') =>
  page.getByRole('textbox', { name: `${kind} content` });
async function append(page: any, text: string, kind = 'standalone') {
  const root = editor(page, kind);
  await root.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.insertText(text);
  await expect(root).toContainText(text);
}
async function summary(page: any, kind = 'standalone') {
  return page.evaluate((k: string) => (window as any).u07d[k].summary(), kind);
}
test('HB01 both public host modes deliver native edits with exact echoes and keep server dirty', async ({
  page,
}) => {
  for (const kind of ['standalone', 'builder']) {
    await append(page, 'ไทย', kind);
    const before = await summary(page, kind);
    const result = await page.evaluate((k: string) => (window as any).u07d[k].flush(), kind);
    expect(result.status).toBe('delivered');
    const after = await summary(page, kind);
    expect(after.host.html).toBe('<p>baseไทย</p>');
    expect(after.binding.localDirty).toBe(false);
    expect(after.binding.serverDirty).toBe(true);
    expect(after.controller.sessionId).toBe(before.controller.sessionId);
    expect(after.controller.canUndo).toBe(true);
    if (kind === 'builder') {
      const body: any = Object.values(after.core.document.nodes).find(
        (n: any) => n.type === 'cms.richText',
      );
      expect(body.props.html.value).toBe(after.host.html);
      expect(body.props.contentProfile.value).toBe('cms-body-v1');
      expect(body.props.body).toBeUndefined();
    }
  }
});
test('HB02 a delayed parent ack leaves a newer native revision and its history intact', async ({
  page,
}) => {
  await append(page, 'A');
  await page.evaluate(() => {
    const p = (window as any).u07d.standalone;
    p.delay();
    p.promise = p.flush();
  });
  await page.waitForFunction(() => (window as any).u07d.standalone.runtime.state.release !== null);
  await append(page, 'B');
  const latest = await summary(page);
  await page.evaluate(() => {
    (window as any).u07d.standalone.release();
  });
  expect((await page.evaluate(() => (window as any).u07d.standalone.promise)).status).toBe(
    'delivered',
  );
  const after = await summary(page);
  expect(after.controller.revision).toBe(latest.controller.revision);
  expect(after.binding.localDirty).toBe(true);
  await expect(editor(page)).toHaveText('baseAB');
});
test('HB03 actual Chromium native composition blocks field preparation and submission until stable', async ({
  page,
  context,
}) => {
  const root = editor(page);
  await root.click();
  await page.keyboard.press('Control+End');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: 'กำลัง', selectionStart: 5, selectionEnd: 5 });
  expect(
    (await page.evaluate(() => (window as any).u07d.standalone.prepare())).diagnostics,
  ).toContain('COMPOSITION_ACTIVE');
  expect((await page.evaluate(() => (window as any).u07d.standalone.flush())).status).toBe(
    'blocked',
  );
  expect((await summary(page)).host.html).toBe('<p>base</p>');
  await cdp.send('Input.insertText', { text: 'กำลัง' });
  await expect(root).toHaveText('baseกำลัง');
  expect((await page.evaluate(() => (window as any).u07d.standalone.flush())).status).toBe(
    'delivered',
  );
  await cdp.detach();
});
test('HB04 quarantined native draft remains a preparation blocker after its surface is hidden', async ({
  page,
}) => {
  await editor(page).evaluate((el: HTMLElement) => {
    el.appendChild(document.createTextNode('unowned'));
  });
  await expect.poll(async () => (await summary(page)).binding.localDirty).toBe(true);
  await page.evaluate(() => (window as any).u07d.standalone.hide());
  await expect(editor(page)).toHaveCount(0);
  expect((await page.evaluate(() => (window as any).u07d.standalone.prepare())).status).toBe(
    'blocked',
  );
  expect((await summary(page)).host.html).toBe('<p>base</p>');
});
test('HB05 authorized hidden idle surface retains its controller/binding for explicit parent delivery', async ({
  page,
}) => {
  await append(page, 'hidden');
  const before = await summary(page);
  await page.evaluate(() => (window as any).u07d.standalone.hide());
  await expect(editor(page)).toHaveCount(0);
  expect((await page.evaluate(() => (window as any).u07d.standalone.flush())).status).toBe(
    'delivered',
  );
  await page.evaluate(() => (window as any).u07d.standalone.show());
  await expect(editor(page)).toHaveText('basehidden');
  expect((await summary(page)).controller.sessionId).toBe(before.controller.sessionId);
});
test('HB06 terminal host disposal clears its owned model/native DOM while the other editor stays active', async ({
  page,
}) => {
  await append(page, 'protected');
  await page.evaluate(() => (window as any).u07d.standalone.dispose());
  await expect(editor(page)).toHaveText('');
  expect((await summary(page)).controller.disposed).toBe(true);
  await append(page, 'still active', 'builder');
  expect((await page.evaluate(() => (window as any).u07d.builder.flush())).status).toBe(
    'delivered',
  );
});
test('HB07 real Builder page undo is an explicit external replacement with a new child session', async ({
  page,
}) => {
  await append(page, 'page', 'builder');
  await page.evaluate(() => (window as any).u07d.builder.flush());
  const before = await summary(page, 'builder');
  const result = await page.evaluate(() => {
    const r = (window as any).u07d.builder.runtime;
    r.underlying.setExternalOrigin('parentUndo');
    const undo = r.core.undo({ expectedSessionId: r.core.getSnapshot().sessionId });
    return { undo, accepted: r.binding.acceptExternalValue() };
  });
  expect(result.undo.status).toBe('committed');
  expect(result.accepted.status).toBe('accepted');
  await expect(editor(page, 'builder')).toHaveText('base');
  expect((await summary(page, 'builder')).controller.sessionId).not.toBe(
    before.controller.sessionId,
  );
});
test('HB08 authorization loss after a real parent commit invalidates the original delayed ack', async ({
  page,
}) => {
  await append(page, 'A', 'builder');
  await page.evaluate(() => {
    const p = (window as any).u07d.builder;
    p.delay();
    p.promise = p.flush();
  });
  await page.waitForFunction(() => (window as any).u07d.builder.runtime.state.release !== null);
  await page.evaluate(() => {
    const p = (window as any).u07d.builder;
    p.revoke();
    p.release();
  });
  expect((await page.evaluate(() => (window as any).u07d.builder.promise)).diagnostics).toContain(
    'HOST_CONTEXT_CHANGED',
  );
  expect((await summary(page, 'builder')).binding.localDirty).toBe(true);
  await expect(editor(page, 'builder')).toHaveText('baseA');
});
