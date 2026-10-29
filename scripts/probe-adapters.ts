// Bounded original-fixture artifact probe. Production adapters never import this script/tests.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseMidi, writeMidi } from 'midi-file';
import { createAlphaTabScore, createPlaybackController } from '../src/adapters';
import { encodePdf } from '../src/adapters/pdf';
import { createScoreAdapter } from '../src/adapters/server';
import { PdfLayoutSettingsSchema } from '../src/adapters/pdf-settings';
import { checkMidi, checkPdf } from '../tests/adapters/artifact-oracle';
import { envelope, fixtureFingerprint, oracleValidator, study } from '../tests/adapters/fixture';
import { FakeAudioContext } from '../tests/adapters/fake-audio';

const root = path.resolve(process.argv[2] ?? '/tmp/opencode/guitar-adapters-u11-u12');
await mkdir(root, { recursive: true });
for (const [source, name] of [['node_modules/@coderline/alphatab/LICENSE', 'alphaTab-MPL-2.0.txt'], ['node_modules/@coderline/alphatab/dist/font/Bravura-OFL.txt', 'Bravura-OFL.txt']] as const) {
  await writeFile(path.join(root, name), await readFile(source));
}
const json = async (file: string, value: object) => writeFile(path.join(root, file), `${JSON.stringify(value, null, 2)}\n`);
const results: object[] = [], negatives: object[] = [];
const fixture = await study(12, 2, 2), validator = oracleValidator(12, 2);
for (const capo of [0, 2] as const) {
  const fixture = await study(12, capo, 2), draft = envelope(fixture.source, fixture.score, validator);
  const dir = path.join(root, `capo-${capo}`); await mkdir(dir, { recursive: true });
  await json(`capo-${capo}/score.json`, fixture.score); await json(`capo-${capo}/source.json`, fixture.source);
  await writeFile(path.join(dir, 'source-raw.json'), fixture.rawArtifact);
  const notation = createAlphaTabScore(fixture.score, { notationMode: 'unfolded', showMeasureLabels: true }), layout = await notation.renderSvg();
  await json(`capo-${capo}/projection.json`, notation.projection); await json(`capo-${capo}/placements.json`, notation.placements);
  await json(`capo-${capo}/layout.json`, layout);
  for (const pdfPageSize of ['A4', 'LETTER'] as const) {
    const adapter = createScoreAdapter({ validator, getValidationContext: () => ({ approvedRevisions: [] }), pdfPageSize, notationMode: 'unfolded', pdfLayout: PdfLayoutSettingsSchema.parse({ showMeasureLabels: true }) });
    const pdf = await adapter.exportArtifact(fixture.source, draft, 'pdf');
    await writeFile(path.join(dir, `${pdfPageSize}.pdf`), pdf.bytes); await json(`capo-${capo}/${pdfPageSize}-manifest.json`, pdf.manifest);
    const rasterDir = path.join(dir, `${pdfPageSize}-rasters`); await mkdir(rasterDir, { recursive: true });
    const rasters: Promise<void>[] = [];
    const inspection = await checkPdf(pdf.bytes, 12, capo, 66, (page, bytes) => { rasters.push(writeFile(path.join(rasterDir, `page-${String(page).padStart(2, '0')}.png`), bytes)); });
    await Promise.all(rasters);
    await json(`capo-${capo}/${pdfPageSize}-inspection.json`, inspection);
    results.push({ capo, format: 'pdf', size: pdfPageSize, path: path.join(dir, `${pdfPageSize}.pdf`), ...inspection });
  }
  const adapter = createScoreAdapter({ validator, getValidationContext: () => ({ approvedRevisions: [] }) });
  const midi = await adapter.exportArtifact(fixture.source, draft, 'midi');
  await writeFile(path.join(dir, 'fixture.mid'), midi.bytes); await json(`capo-${capo}/midi-manifest.json`, midi.manifest);
  results.push({ capo, format: 'midi', path: path.join(dir, 'fixture.mid'), ...checkMidi(midi.bytes, 12, 2) });
}

const rejected = async (name: string, file: string, bytes: Uint8Array, check: () => unknown | Promise<unknown>) => {
  await writeFile(path.join(root, file), bytes);
  let message = '';
  try { await check(); } catch (error) { message = error instanceof Error ? error.message : String(error); }
  assert(message, `Negative ${name} was accepted`); negatives.push({ name, file: path.join(root, file), rejected: true, message });
};
const notation = createAlphaTabScore(fixture.score, { notationMode: 'unfolded', showMeasureLabels: true }), layout = await notation.renderSvg();
const last = layout.systems.at(-1)!.index;
const mutations = [
  { name: 'missing-last-system', layout: { ...layout, systems: layout.systems.slice(0, -1), fragments: layout.fragments.filter(f => f.system !== last) }, capo: 2 },
  { name: 'fontless', layout: { ...layout, fragments: layout.fragments.map(f => ({ ...f, svg: f.svg.replaceAll('font-family="alphaTab"', 'font-family="Helvetica"') })) }, capo: 2 },
  { name: 'clipped-last-tab', layout: { ...layout, fragments: layout.fragments.map(f => f.system === last ? { ...f, svg: f.svg.replace(/(<svg[^>]*>)/, `$1<defs><clipPath id="probe-clip"><rect x="0" y="0" width="${f.width}" height="${f.height * 0.55}"/></clipPath></defs><g clip-path="url(#probe-clip)">`).replace('</svg>', '</g></svg>') } : f) }, capo: 2 },
  { name: 'wrong-capo-caption-and-frets', layout: { ...layout, fragments: layout.fragments.map(f => ({ ...f, svg: f.svg.replaceAll('Capo 2', 'Capo 0') })) }, capo: 0 },
];
for (const mutation of mutations) {
  const pdf = await encodePdf(mutation.layout, `unreviewed-draft | Capo ${mutation.capo} | actual negative bytes`, 'A4');
  await rejected(mutation.name, `negative-${mutation.name}.pdf`, pdf.bytes, () => checkPdf(pdf.bytes, 12, mutation.capo));
}
const draft = envelope(fixture.source, fixture.score, validator);
const midi = await createScoreAdapter({ validator, getValidationContext: () => ({ approvedRevisions: [] }) }).exportArtifact(fixture.source, draft, 'midi');
for (const name of ['missing-last-note', 'wrong-octave', 'unmatched-off', 'stale-tempo'] as const) {
  const parsed = parseMidi(midi.bytes);
  if (name === 'missing-last-note') {
    const bass = parsed.tracks[2]!;
    const indices = bass.flatMap((event, i) => (event.type === 'noteOn' || event.type === 'noteOff') && event.noteNumber === 45 ? [i] : []).slice(-2).reverse();
    for (const i of indices) { bass[i + 1]!.deltaTime += bass[i]!.deltaTime; bass.splice(i, 1); }
  } else if (name === 'wrong-octave') {
    for (const track of parsed.tracks) for (const e of track) if (e.type === 'noteOn' || e.type === 'noteOff') e.noteNumber += 12;
  } else if (name === 'unmatched-off') {
    const e = parsed.tracks[1]!.find(e => e.type === 'noteOff')!; if (e.type === 'noteOff') e.noteNumber++;
  } else {
    const e = parsed.tracks[0]!.filter(e => e.type === 'setTempo')[2]!; if (e.type === 'setTempo') e.microsecondsPerBeat = 500000;
  }
  const bytes = new Uint8Array(writeMidi(parsed));
  await rejected(name, `negative-${name}.mid`, bytes, () => checkMidi(bytes, 12, 2));
}

const audioFixture = await study(), ctx = new FakeAudioContext(), audio = createPlaybackController(audioFixture.score, ctx.options());
audio.setLoop({ startQuarter: 0, endQuarter: 8 }); await audio.play(); ctx.advance(120.02);
const metrics = audio.getMetrics();
assert.equal(metrics.loopCount, 20); assert(metrics.maxScheduleLatenessMs < 0.001);
await json('audio-clock-simulation.json', { kind: 'deterministic-boundary-double-not-speaker-proof', snapshot: audio.getSnapshot(), metrics });
await audio.dispose();
const summary = { root, createdAt: new Date().toISOString(), runtime: { bun: Bun.version, node: process.version }, fixture: 'Original two-bar held-voice study, 12 explicit passes, source pitches authored +2; NOT requested song or U02 16-written/24-occurrence fixture', fixtureFingerprint: await fixtureFingerprint(), validator: 'independent-literal-fixture-1 (test-only, production requires injected actual validator)', results, negatives, validatorCalls: validator.calls, audio: { loopCount: metrics.loopCount, maxScheduleLatenessMs: metrics.maxScheduleLatenessMs, realBrowserAudition: 'pending' } };
await json('verification.json', summary);
console.log(JSON.stringify(summary, null, 2));
