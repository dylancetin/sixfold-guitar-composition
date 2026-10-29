import { expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { prepareArrangement, publishArrangement } from '../../src/agent';
import { createScoreAdapter } from '../../src/adapters/server';
import { guitarValidator } from '../../src/engine';
import { createSongsterrSourceAdapter } from '../../src/source';
import type { RawBeat } from '../../src/source/raw';
import { fixtureFetch, ORIGINAL_URL } from '../source/fixtures';
import { graceFixture } from '../source/grace-fixture';

test('original grace study prepares and atomically publishes real PDF/MIDI with truthful interpretation notes', async () => {
  const root = await mkdtemp('/tmp/opencode/grace-publication-');
  try {
    const fixture = graceFixture();
    const measures = fixture.parts.get(4)!.measures as { voices: { beats: RawBeat[] }[] }[];
    measures[0]!.voices[0]!.beats.at(-1)!.notes[0]!.staccato = true;
    const unselected = structuredClone(fixture.parts.get(4)!);
    unselected.partId = 6;
    fixture.parts.set(6, unselected);
    fixture.metadata.tracks.push({ partId: 6, name: 'Unselected ornament doubling', instrumentId: 54, tuning: [60, 48] });
    const prepared = await prepareArrangement({ sourceUrl: ORIGINAL_URL, difficulty: 'intermediate', capo: { mode: 'recommend', compare: [0, 2] }, runsRoot: join(root, 'runs') }, { sourceAdapter: createSongsterrSourceAdapter({ fetch: fixtureFetch(fixture) }) });
    const publication = await publishArrangement({ runDirectory: prepared.directory, baseline: true, baseUrl: 'https://original-fixture.test', storeRoot: join(root, 'published') }, { scoreAdapter: createScoreAdapter({ validator: guitarValidator, getValidationContext: () => ({ approvedRevisions: [] }) }) });
    expect(publication.status).toBe('unreviewed-draft');
    expect((await readFile(join(publication.directory, 'arrangement.pdf'))).subarray(0, 5).toString()).toBe('%PDF-');
    expect((await readFile(join(publication.directory, 'arrangement.mid'))).subarray(0, 4).toString()).toBe('MThd');
    const notes = await readFile(join(publication.directory, 'notes.md'), 'utf8');
    expect(notes).toContain('Imported source: 6 grace attacks preserved');
    expect(notes).toContain('This arrangement retains 3 source-derived grace attacks');
    expect(notes).toContain('not small-note ornamental glyphs');
    expect(notes).toContain('articulation-staccato');
    expect(notes).toContain('do not reproduce expressive legato/staccato');
  } finally { await rm(root, { recursive: true, force: true }); }
}, 30000);
