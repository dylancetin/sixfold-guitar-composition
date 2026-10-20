import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ArtifactManifestSchema, canonicalJson, contentDigest, ScoreV1Schema, verifyRevisionDigest } from '../domain';
import type { ArtifactManifest, ScoreV1 } from '../domain';
import { durableWrite, hasCode, jsonBytes, privateDirectory, sha256, syncDirectory } from '../agent/files';
import { PublicationIdSchema, PublicationManifestSchema } from './index';
import type { PublicationManifest } from './index';

export type PublicationBundle = {
  manifest: PublicationManifest; score: Uint8Array; pdf: Uint8Array; midi: Uint8Array; notes: Uint8Array;
};
const names = { score: 'score.json', pdf: 'arrangement.pdf', midi: 'arrangement.mid', notes: 'notes.md' } as const;
const keys = ['score', 'pdf', 'midi', 'notes'] as const;
const sameRef = (a: { id: string; digest: string }, b: { id: string; digest: string }) => a.id === b.id && a.digest === b.digest;

export async function checkArtifactManifest(manifest: ArtifactManifest, score: ScoreV1, format: 'pdf' | 'midi', bytes: Uint8Array, notationCount?: number): Promise<void> {
  ArtifactManifestSchema.parse(manifest);
  if (manifest.format !== format || !sameRef(manifest.scoreRevision, score.revision) || !sameRef(manifest.sourceRevision, score.source.revision)) throw new Error('Artifact references wrong score/source revision');
  if (manifest.artifactDigest !== sha256(bytes) || manifest.byteLength !== bytes.byteLength) throw new Error('Artifact bytes/digest/length mismatch');
  if (manifest.capo !== score.instrument.capo || canonicalJson(manifest.tuning) !== canonicalJson(score.instrument.tuning) || manifest.ability.id !== score.ability.id || manifest.ability.version !== score.ability.version || manifest.occurrenceCount !== score.occurrences.length || manifest.soundingAttackCount !== score.performedSounds.length || (notationCount !== undefined && manifest.notationSegmentCount !== notationCount)) throw new Error('Artifact settings/counts mismatch');
  const magic = new TextDecoder().decode(bytes.slice(0, 8));
  if (format === 'pdf' ? !magic.startsWith('%PDF-') : !magic.startsWith('MThd') || bytes.byteLength < 22) throw new Error('Exporter did not return PDF/MIDI bytes');
}

/** Integrity is necessary, not an independent musical/artifact acceptance audit. */
export async function validatePublicationBundle(bundle: PublicationBundle): Promise<ScoreV1> {
  const manifest = PublicationManifestSchema.parse(bundle.manifest);
  if (!manifest.integrity || !manifest.artifacts) throw new Error('Publisher bundles require integrity and artifact manifests');
  for (const key of keys) if (sha256(bundle[key]) !== manifest.integrity[key]) throw new Error(`Publication ${key} integrity mismatch`);
  const score = ScoreV1Schema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bundle.score)));
  if (!await verifyRevisionDigest(score) || !sameRef(manifest.revision, score.revision)) throw new Error('Publication score revision/digest mismatch');
  if (score.source.manifest.identity.kind === 'songsterr' && score.source.manifest.identity.url !== manifest.sourceUrl) throw new Error('Publication source URL mismatch');
  if (score.planner.mode === 'configured-llm' ? !manifest.agent || manifest.agent.model !== score.planner.model : manifest.agent !== null) throw new Error('Publication agent provenance mismatch');
  const review = score.musicalReview;
  if (manifest.status === 'musically-reviewed' && (score.approvals.stage !== 'arrangementApproved' || review.status !== 'reviewed' || review.verdict !== 'accepted' || review.objections.length || review.abilityId !== score.ability.id || review.abilityVersion !== score.ability.version || review.tempoScale !== score.preferences.tempoScale)) throw new Error('Publication cannot claim musical review');
  for (const format of ['pdf', 'midi'] as const) {
    const artifact = manifest.artifacts[format];
    await checkArtifactManifest(artifact, score, format, bundle[format]);
    if (artifact.review !== manifest.status) throw new Error('Publication/artifact review labels mismatch');
  }
  if (manifest.artifacts.pdf.notationSegmentCount !== manifest.artifacts.midi.notationSegmentCount || await contentDigest(manifest.artifacts.pdf.adapter) !== await contentDigest(manifest.artifacts.midi.adapter) || manifest.artifacts.pdf.validationVersion !== manifest.artifacts.midi.validationVersion) throw new Error('Publication exports came from inconsistent adapter/validation projections');
  return score;
}

async function readDirectory(directory: string, expectedId: string): Promise<PublicationBundle> {
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Publication must be a real directory');
  const entries = await readdir(directory);
  const expected = ['manifest.json', ...Object.values(names)];
  if (entries.length !== expected.length || expected.some((name) => !entries.includes(name))) throw new Error('Incomplete/unexpected publication files');
  async function bytes(name: string) {
    const path = join(directory, name);
    const file = await lstat(path);
    if (!file.isFile() || file.isSymbolicLink() || file.size > 64 * 1024 * 1024) throw new Error('Unsafe publication file');
    return new Uint8Array(await readFile(path));
  }
  const manifest = PublicationManifestSchema.parse(JSON.parse(new TextDecoder().decode(await bytes('manifest.json'))));
  if (manifest.id !== expectedId) throw new Error('Publication path/manifest ID mismatch');
  const bundle = { manifest, score: await bytes(names.score), pdf: await bytes(names.pdf), midi: await bytes(names.midi), notes: await bytes(names.notes) };
  await validatePublicationBundle(bundle);
  return bundle;
}

/** Read-only server helper: never join a request path before validating its ID. */
export async function readPublication(root: string, id: string): Promise<PublicationBundle> {
  PublicationIdSchema.parse(id);
  const directory = resolve(root);
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Publication root must be a real directory');
  return readDirectory(join(directory, id), id);
}

export class PublicationStore {
  readonly root: string;
  constructor(root = '.arrangements') { this.root = resolve(root); }

  async get(id: string): Promise<PublicationBundle | null> {
    PublicationIdSchema.parse(id);
    try { await lstat(join(this.root, id)); }
    catch (error) { if (hasCode(error, 'ENOENT')) return null; throw error; }
    return readPublication(this.root, id); // A present but incomplete publication is corruption, not absence.
  }

  async install(bundle: PublicationBundle, options: {
    signal?: AbortSignal;
    /** Fault-injection/cancellation checkpoint after durable staging, before atomic visibility. */
    beforeCommit?: () => Promise<void>;
  } = {}): Promise<{ directory: string; reused: boolean }> {
    await validatePublicationBundle(bundle);
    options.signal?.throwIfAborted();
    await privateDirectory(this.root);
    const id = bundle.manifest.id;
    const directory = join(this.root, id);
    const lock = join(this.root, `.lock-${id}`);
    // An interrupted process may leave a lock/staging dir; do not guess ownership or erase it.
    try { await mkdir(lock, { mode: 0o700 }); }
    catch (error) { if (hasCode(error, 'EEXIST')) throw new Error('Publication busy or interrupted lock remains; existing publications were not changed'); throw error; }
    const staging = join(this.root, `.staging-${randomUUID()}`);
    try {
      const existing = await this.get(id);
      if (existing) {
        if (sha256(jsonBytes(existing.manifest)) !== sha256(jsonBytes(bundle.manifest)) || keys.some((key) => sha256(existing[key]) !== sha256(bundle[key]))) throw new Error('Immutable publication already exists with different metadata/content');
        return { directory, reused: true };
      }
      await mkdir(staging, { mode: 0o700 });
      for (const key of keys) await durableWrite(join(staging, names[key]), bundle[key]);
      await durableWrite(join(staging, 'manifest.json'), jsonBytes(bundle.manifest));
      await syncDirectory(staging);
      await readDirectory(staging, id);
      await options.beforeCommit?.();
      options.signal?.throwIfAborted();
      await rename(staging, directory); // One same-filesystem visibility point; valid nonempty dirs cannot be overwritten.
      await syncDirectory(this.root);
      return { directory, reused: false };
    } finally {
      await rm(staging, { recursive: true, force: true });
      await rm(lock, { recursive: true, force: true });
    }
  }
}
