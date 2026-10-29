import { expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { prepareArrangement, publishArrangement } from '../../src/agent';
import { createScoreAdapter } from '../../src/adapters/server';
import { guitarValidator } from '../../src/engine';
import { createSongsterrSourceAdapter } from '../../src/source';
import { fixtureFetch, ORIGINAL_URL } from '../source/fixtures';
import { capoFixture } from '../source/capo-fixture';

test('source-capo exercise publishes canonical artifacts with honest, separate source/arrangement capo notes', async () => {
  const root = await mkdtemp('/tmp/opencode/capo-publication-');
  try {
    const prepared = await prepareArrangement({ sourceUrl: ORIGINAL_URL, difficulty: 'intermediate', capo: { mode: 'recommend', compare: [0, 2] }, runsRoot: join(root, 'runs') }, { sourceAdapter: createSongsterrSourceAdapter({ fetch: fixtureFetch(capoFixture()) }) });
    const publication = await publishArrangement({ runDirectory: prepared.directory, baseline: true, baseUrl: 'https://original-fixture.test', storeRoot: join(root, 'published') }, { scoreAdapter: createScoreAdapter({ validator: guitarValidator, getValidationContext: () => ({ approvedRevisions: [] }) }) });
    expect(publication.status).toBe('unreviewed-draft');
    const notes = await readFile(join(publication.directory, 'notes.md'), 'utf8');
    expect(notes).toContain('Source capo offsets in parts 4 are already materialized once');
    expect(notes).toContain('separate fingering choice, not an additional source-pitch transposition');
    expect(notes).toContain('deterministic fallback');
    expect((await readFile(join(publication.directory, 'arrangement.pdf'))).subarray(0, 5).toString()).toBe('%PDF-');
    expect((await readFile(join(publication.directory, 'arrangement.mid'))).subarray(0, 4).toString()).toBe('MThd');
  } finally { await rm(root, { recursive: true, force: true }); }
}, 30000);
