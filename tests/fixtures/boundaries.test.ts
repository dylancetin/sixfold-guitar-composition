import { describe, expect, test } from 'bun:test';
import { contentDigest, ExportResponseSchema, LocalDownloadPathSchema, overlaps, q, resolveLocalDownloadUrl, revisionDigest, RevisionMutationSchema, SaveResultSchema, ScoreV1Schema, verifyRevisionDigest } from '../../src/domain';
import type { RevisionStore } from '../../src/domain';
import { score } from './original';

const readyDownload = {
  status: 'ready', downloadPath: '/artifacts/current.mid', filename: 'current.mid', mediaType: 'audio/midi',
  manifest: {
    schemaVersion: 1, scoreRevision: { id: score.revision.id, digest: score.revision.digest }, sourceRevision: score.source.revision,
    ability: { id: score.ability.id, version: score.ability.version }, adapter: { name: 'schema-only-fixture', version: '1' },
    format: 'midi', artifactDigest: '0'.repeat(64), byteLength: 1,
    occurrenceCount: 2, soundingAttackCount: 9, notationSegmentCount: 11,
    review: 'unreviewed-draft', validationVersion: 'schema-only-fixture',
    tuning: score.instrument.tuning, capo: 0, midiPitchPolicy: 'already-sounding-no-capo-offset',
  },
};

describe('review boundary regressions — schemas/helpers, not storage or artifact execution', () => {
  test('first create expresses an absent head and requires a parentless revision', () => {
    expect(RevisionMutationSchema.safeParse({ kind: 'create', expectedHead: null, replacement: score }).success).toBe(true);
    expect(RevisionMutationSchema.safeParse({ kind: 'create', expectedHead: score.source.revision, replacement: score }).success).toBe(false);
    expect(RevisionMutationSchema.safeParse({ kind: 'create', expectedHead: null, replacement: { ...score, revision: { ...score.revision, parentId: 'existing-r0' } } }).success).toBe(false);
    expect(RevisionMutationSchema.safeParse({ kind: 'melody-edit', expectedHead: null, replacement: score }).success).toBe(false);
    expect(SaveResultSchema.safeParse({ status: 'conflict', currentHead: null }).success).toBe(true);
  });

  test('typed schema-only first-create -> approve -> edit uses API-allocated identities and existing CAS edits', async () => {
    const initial = structuredClone(score);
    initial.projectId = 'api-allocated-project';
    initial.revision = { id: 'api-r1', parentId: null, digest: '0'.repeat(64) };
    initial.revision.digest = await revisionDigest(initial);
    const firstHead = { id: initial.revision.id, digest: initial.revision.digest };
    const sounds = initial.sounds.filter((s) => s.role === 'melody');
    const rests = initial.rests.filter((r) => r.role === 'melody');
    const scopeDigest = await contentDigest({ sourceRevision: initial.source.revision, selection: initial.selection, transposition: initial.preferences.transposition, sounds, rests });
    const approved = ScoreV1Schema.parse({
      ...initial, revision: { id: 'api-r2', parentId: firstHead.id, digest: '0'.repeat(64) },
      approvals: { stage: 'melodyApproved', melody: { id: 'approval-1', approvedFrom: firstHead, scopeDigest, reviewer: 'schema-only-example', approvedAt: '2026-10-20T21:00:00Z' } },
      locks: [{ role: 'melody', approvedFrom: firstHead, scopeDigest, sounds, rests }],
    });
    approved.revision.digest = await revisionDigest(approved);
    const approvedHead = { id: approved.revision.id, digest: approved.revision.digest };
    const edited = ScoreV1Schema.parse({
      ...approved, revision: { id: 'api-r3', parentId: approvedHead.id, digest: '0'.repeat(64) },
      preferences: { ...approved.preferences, tempoScale: 0.75 },
    });
    edited.revision.digest = await revisionDigest(edited);
    const commands: Parameters<RevisionStore['commit']>[1][] = [
      RevisionMutationSchema.parse({ kind: 'create', expectedHead: null, replacement: initial }),
      RevisionMutationSchema.parse({ kind: 'approve', stage: 'melody', expectedHead: firstHead, replacement: approved }),
      RevisionMutationSchema.parse({ kind: 'preferences-edit', expectedHead: approvedHead, replacement: edited }),
    ];
    expect(commands.map((c) => c.kind)).toEqual(['create', 'approve', 'preferences-edit']);
    expect(commands.map((c) => c.expectedHead)).toEqual([null, firstHead, approvedHead]);
    for (const command of commands) expect(await verifyRevisionDigest(command.replacement)).toBe(true);
    expect(SaveResultSchema.parse({ status: 'conflict', currentHead: firstHead }).status).toBe('conflict');
    // No store call: atomic absent-head/CAS rejection and approval authenticity remain implementation gates.
  });

  test('local download response accepts a root-relative artifact path', () => {
    expect(ExportResponseSchema.safeParse(readyDownload).success).toBe(true);
  });

  test('shared local path schema and URL helper preserve the actual application origin', () => {
    for (const path of ['/artifacts/current.mid', '/artifacts/./current.mid', '/artifacts/study%20one.mid?download=1']) {
      expect(LocalDownloadPathSchema.parse(path)).toBe(path);
      expect(resolveLocalDownloadUrl(path, 'https://guitar.example:8443').origin).toBe('https://guitar.example:8443');
    }
    expect(resolveLocalDownloadUrl('/artifacts/../current.mid', 'https://guitar.example').href).toBe('https://guitar.example/current.mid');
    expect(resolveLocalDownloadUrl('/current.mid', 'http://localhost:3000').origin).toBe('http://localhost:3000');
    expect(() => resolveLocalDownloadUrl('/current.mid', 'file:///tmp/score')).toThrow();
  });

  test.each(['//example.org/x.mid', '/\\example.org/x.mid', '/\n/example.org/x.mid'])(
    'local download response rejects browser cross-origin spelling %j', (downloadPath) => {
      expect(new URL(downloadPath, 'https://guitar.example').origin).toBe('https://example.org');
      expect(ExportResponseSchema.safeParse({ ...readyDownload, downloadPath }).success).toBe(false);
      expect(() => resolveLocalDownloadUrl(downloadPath, 'https://guitar.example')).toThrow();
    },
  );

  test('download paths reject absolute/relative URLs, any backslash and all C0/C1 control characters', () => {
    for (const path of ['https://example.org/x.mid', 'artifacts/current.mid', '/artifacts\\current.mid', '///example.org/x.mid']) {
      expect(LocalDownloadPathSchema.safeParse(path).success).toBe(false);
    }
    for (let code = 0; code <= 0x9f; code++) {
      if (code > 0x1f && code < 0x7f) continue;
      const path = `/artifacts/${String.fromCharCode(code)}current.mid`;
      expect(LocalDownloadPathSchema.safeParse(path).success).toBe(false);
    }
  });

  test('empty or reversed half-open intervals never overlap', () => {
    expect(overlaps(q(1), q(1), q(0), q(2))).toBe(false);
    expect(overlaps(q(0), q(2), q(1), q(1))).toBe(false);
    expect(overlaps(q(2), q(1), q(0), q(3))).toBe(false);
    expect(overlaps(q(0), q(3), q(2), q(1))).toBe(false);
    expect(overlaps(q(0), q(1), q(1), q(2))).toBe(false);
    expect(overlaps(q(0), q(2), q(1), q(3))).toBe(true);
  });
});
