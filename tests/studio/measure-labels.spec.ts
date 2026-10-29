import { expect, test } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

test('measure details are opt-in, survive layout changes and are included only in the selected-layout PDF', async ({ page, request }) => {
  const library = await (await request.get('/api/arrangements')).json();
  const manifest = library.arrangements[0]?.manifest;
  if (!manifest) throw new Error('Requires a real published arrangement.');
  const path = `/arrangements/${manifest.id}`;
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const files = ['score.json', 'arrangement.pdf', 'arrangement.mid'];
  const before = await Promise.all(files.map(file => request.get(`${path}/${file}`).then(r => r.body())));
  await page.goto(path);
  await page.getByRole('button', { name: 'Restore preview controls' }).click();
  const toggle = page.getByRole('switch', { name: 'Measure details', exact: true });
  await expect(toggle).toBeEnabled({ timeout: 20000 });
  await expect(toggle).not.toBeChecked();
  const labels = () => page.locator('.native-fragment svg text').evaluateAll(nodes => nodes.map(node => node.textContent ?? '').filter(text => /^S\d+$|\/S\d+\/P\d+/.test(text)));
  expect(await labels()).toHaveLength(0);
  const pdf = async (showMeasureLabels: boolean) => {
    const response = await request.get(`${path}/preview.pdf?showMeasureLabels=${showMeasureLabels}`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('application/pdf');
    const task = getDocument({ data: new Uint8Array(await response.body()), useSystemFonts: true });
    try {
      const document = await task.promise, text: string[] = [];
      for (let number = 1; number <= document.numPages; number++) {
        const content = await (await document.getPage(number)).getTextContent();
        text.push(...content.items.flatMap(item => 'str' in item ? [item.str] : []));
      }
      return text.join(' ');
    } finally { await task.destroy(); }
  };
  expect(await pdf(false)).not.toMatch(/\bS\d+\b/);
  await page.getByRole('button', { name: 'Play arrangement', exact: true }).click();
  await page.getByLabel('Jump to measure').selectOption('8');
  await toggle.focus(); await page.keyboard.press('Space');
  await expect(toggle).toBeEnabled(); await expect(toggle).toBeChecked();
  expect((await labels()).length).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Pause playback', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
  await expect(page.getByLabel('Jump to measure')).toHaveValue('8');
  await page.getByLabel('Preview spacing').selectOption('tight');
  await expect(toggle).toBeEnabled(); await expect(toggle).toBeChecked();
  expect((await labels()).length).toBeGreaterThan(0);
  expect(await pdf(true)).toMatch(/\bS\d+\b/);
  const pdfResponse = page.waitForResponse(r => r.url().includes('/preview.pdf?'));
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF score', exact: true }).click();
  await download;
  expect(new URL((await pdfResponse).url()).searchParams.get('showMeasureLabels')).toBe('true');
  await toggle.uncheck(); await expect(toggle).toBeEnabled();
  expect(await labels()).toHaveLength(0);
  await expect(page.getByLabel('Jump to measure')).toHaveValue('8');
  expect(await Promise.all(files.map(file => request.get(`${path}/${file}`).then(r => r.body())))).toEqual(before);
  expect(errors).toEqual([]);
});

test('mobile measure-details switch fits and works with a keyboard', async ({ page, request }) => {
  const library = await (await request.get('/api/arrangements')).json();
  const manifest = library.arrangements[0]?.manifest;
  if (!manifest) throw new Error('Requires a real published arrangement.');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/arrangements/${manifest.id}`);
  await page.getByRole('button', { name: 'Restore preview controls' }).click();
  const toggle = page.getByRole('switch', { name: 'Measure details', exact: true });
  await expect(toggle).toBeEnabled({ timeout: 20000 });
  await expect(toggle).not.toBeChecked();
  await toggle.focus(); await page.keyboard.press('Space');
  await expect(toggle).toBeEnabled(); await expect(toggle).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
