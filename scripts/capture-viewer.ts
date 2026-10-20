import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const origin = process.env.VIEWER_URL;
if (!origin) throw new Error('VIEWER_URL must point to a Project Shelf-managed read-only preview.');
const library = await (await fetch(new URL('/api/arrangements', origin))).json() as { arrangements: { manifest: { id: string; title: string; status: string; agent: unknown; revision: { id: string; digest: string }; integrity: { pdf: string; midi: string } } }[] };
const manifest = (process.env.PUBLICATION_ID ? library.arrangements.find(entry => entry.manifest.id === process.env.PUBLICATION_ID) : library.arrangements[0])?.manifest;
if (!manifest) throw new Error('Capture requires an actual published arrangement; there is no study fallback.');
const directory = 'docs/evidence/viewer-captures';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox'] });
const evidence: unknown[] = [];
try {
  for (const viewport of [{ name: 'desktop', width: 1440, height: 1100 }, { name: 'mobile', width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin);
    await page.getByRole('link', { name: manifest.title, exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    const libraryPath = `${directory}/library-${viewport.name}.png`;
    await page.screenshot({ path: libraryPath, fullPage: true });
    await page.goto(new URL(`/arrangements/${manifest.id}`, origin).href);
    await page.getByRole('button', { name: 'Play arrangement' }).waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('.play-button')?.disabled);
    await page.getByLabel('Inspect a written note').selectOption({ index: 1 });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.scrollTo(0, 0));
    const path = `${directory}/viewer-${viewport.name}.png`;
    await page.screenshot({ path, fullPage: true });
    evidence.push({ viewport, libraryPath, path, errors, layout: await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, nativeNoteTargets: document.querySelectorAll('.native-note-target').length, scoreWidth: document.querySelector('.score-viewport')?.scrollWidth, creationControls: [...document.querySelectorAll('button')].filter(button => /create|import|save|rebuild|approve/i.test(button.textContent ?? '')).length, note: document.querySelector('.selected-pitch')?.textContent })) });
    await page.close();
  }
  const downloads = [];
  for (const [filename, key] of [['arrangement.pdf', 'pdf'], ['arrangement.mid', 'midi']] as const) {
    const url = new URL(`/arrangements/${manifest.id}/${filename}`, origin).href;
    const response = await fetch(url);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (!response.ok || sha256 !== manifest.integrity[key]) throw new Error('Actual published download failed HTTP/hash verification.');
    downloads.push({ url, status: response.status, mediaType: response.headers.get('content-type'), byteLength: bytes.length, sha256 });
  }
  await Bun.write(`${directory}/browser.json`, JSON.stringify({ capturedAt: new Date().toISOString(), browser: await browser.version(), origin, publication: manifest, downloads, audibleCheck: 'Not performed: synthetic-audio browser operations are not human listening or playability certification.', evidence }, null, 2));
} finally { await browser.close(); }
