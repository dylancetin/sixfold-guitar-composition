import { contentDigest, ImportResultSchema, revisionDigest, SourceScoreV1Schema } from '../domain';
import type { Diagnostic, ImportResult, SourceAdapter, SourceScoreV1 } from '../domain';
import { diagnostic, fail, PARSER_VERSION, SourceFailure } from './common';
import { declaredKeySignature, normalizePart, normalizeStructure, sameStructure, sourceKey } from './normalize';
import type { DeclaredKeySignature } from './normalize';
import { checkRestrictions, metadataFromPage, parseBoundary, parseJson, RawPartSchema } from './raw';
import { CDN_HOST, PAGE_HOSTS, parseSongUrl, SourceArtifactStore, Transport } from './transport';
import type { ArtifactSink, SourceFetch } from './transport';

export type SongsterrSourceOptions = {
  fetch?: SourceFetch;
  /** Persist hash-addressed immutable bytes before API source persistence. No URLs/tokens are passed. */
  saveArtifact?: ArtifactSink;
  now?: () => Date;
  /** Explicitly requested simplified draft: retain notated pitch, disclose omitted bend motion. Default rejects selected bends. */
  simplifyBends?: boolean;
  simplifyOrnaments?: boolean;
};
export const songsterrRawArtifacts = new SourceArtifactStore();

export function createSongsterrSourceAdapter(options: SongsterrSourceOptions = {}): SourceAdapter {
  return {
    async import(input, signal): Promise<ImportResult> {
      try {
        if (!input || typeof input !== 'object' || !('kind' in input)) fail('Expected a structured import input.', 'invalid-input', 'invalid-input');
        if (input.kind === 'upload') return { status: 'unsupported', diagnostics: [diagnostic('unsupported-construct', 'This adapter supports public Songsterr pages only. Authorized file imports require a separate format adapter.', 'error')] };
        if (input.kind !== 'songsterr-url' || typeof input.url !== 'string' || Object.keys(input).some((key) => !['kind', 'url'].includes(key))) fail('Expected exactly {kind: songsterr-url, url}; identity allocation belongs to the API.', 'invalid-input', 'invalid-input');
        const parsed = parseSongUrl(input.url);
        const abort = AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(60_000)]);
        abort.throwIfAborted();
        const transport = new Transport(options.fetch ?? ((url, init) => fetch(url, init)), options.saveArtifact ?? ((artifact) => songsterrRawArtifacts.put(artifact)), abort);
        const html = await transport.text(parsed.url, PAGE_HOSTS, 'song-page', 'text/html');
        const metadata = await metadataFromPage(html);
        if (metadata.songId !== parsed.songId) fail('Public page returned a different song; no substitution.', 'unsupported', 'source-mismatch');
        const parts: SourceScoreV1['parts'] = [];
        const events: SourceScoreV1['events'] = [];
        const diagnostics: Diagnostic[] = [];
        let structure: ReturnType<typeof normalizeStructure> | undefined;
        let version: number | undefined;
        const unversionedPartIds: number[] = [];
        const keyDeclarations: Array<{ partId: number; key: DeclaredKeySignature | null }> = [];
        // Sequential acquisition stops immediately on any denial, including an irrelevant part's 403.
        for (const track of metadata.tracks) {
          abort.throwIfAborted();
          const url = new URL(`https://${CDN_HOST}/${metadata.songId}/${metadata.revisionId}/${metadata.image}/${track.partId}.json`);
          const text = await transport.text(url, [CDN_HOST], `part-${track.partId}`, 'application/json');
          const json = parseJson(text);
          checkRestrictions(json);
          const header = json as { songId?: unknown; revisionId?: unknown; partId?: unknown; version?: unknown } | null;
          if (!header || header.songId !== metadata.songId || header.revisionId !== metadata.revisionId || header.partId !== track.partId) fail(`Part ${track.partId} has mismatched song/revision/part identity.`, 'unsupported', 'source-mismatch');
          if (header.version === undefined) unversionedPartIds.push(track.partId);
          const decoded = RawPartSchema.safeParse(json);
          if (!decoded.success && track.isDrums) {
            parts.push({ id: track.partId, name: track.name?.trim() || track.title || `Part ${track.partId}`, program: null, voices: ['p' + track.partId + ':v0'], sourceTuning: null });
            diagnostics.push(diagnostic('unsupported-construct', `Percussion part ${track.partId} has unsupported schema and is retained raw-only; pitched source events are not erased. Do not select this part as melody.`));
            continue;
          }
          const raw = parseBoundary(RawPartSchema, json, `Part ${track.partId}`);
          if (raw.songId !== metadata.songId || raw.revisionId !== metadata.revisionId || raw.partId !== track.partId) fail(`Part ${track.partId} has mismatched song/revision/part identity.`, 'unsupported', 'source-mismatch');
          if (raw.version !== undefined) {
            if (version !== undefined && version !== raw.version) fail('Inconsistent part format versions; no mixed-version score accepted.');
            version = raw.version;
          }
          try {
            const nextStructure = normalizeStructure(raw);
            if (structure && !await sameStructure(structure, nextStructure)) fail(`Part ${track.partId} disagrees on written bars/meter/tempo/repeats.`, 'unsupported', 'form-mismatch');
            structure = nextStructure;
            keyDeclarations.push({ partId: track.partId, key: declaredKeySignature(raw) });
            const normalized = normalizePart(track, raw, structure.bars, { ...(options.simplifyBends === true ? { simplifyBends: true } : {}), ...(options.simplifyOrnaments === true ? { simplifyOrnaments: true } : {}) });
            parts.push(normalized.part); events.push(...normalized.events); diagnostics.push(...normalized.diagnostics);
          } catch (error) {
            if (!(error instanceof SourceFailure) || !(track.isDrums || raw.instrumentId === 1024)) throw error;
            // Canonical V1 cannot encode arbitrary percussion. Preserve identity/raw + explicit exclusion, never erase pitched melody.
            parts.push({ id: track.partId, name: track.name?.trim() || track.title || `Part ${track.partId}`, program: null, voices: ['p' + track.partId + ':v0'], sourceTuning: null });
            diagnostics.push(diagnostic('unsupported-construct', `Percussion part ${track.partId} is raw-only: ${error.message} Pitched parts remain intact; do not select this percussion as melody.`));
          }
        }
        if (!structure) fail('No source parts were acquired.');
        if (!version) fail('No declared supported format version exists in the acquired parts; no version is invented for an entirely unversioned source.');
        if (unversionedPartIds.length) diagnostics.push(diagnostic('unsupported-construct', `Parts ${unversionedPartIds.join(', ')} omit upstream format-version metadata. Their complete musical structure was validated without a version default; manifest unversionedPartIds explicitly excludes them from the declared formatVersion ${version}. Exact raw bytes are retained.`, 'warning'));
        events.sort((a, b) => compareEvents(a, b));
        const provisionalHash = await contentDigest({ songId: metadata.songId, upstreamRevisionId: metadata.revisionId, artifacts: transport.artifacts });
        const source = SourceScoreV1Schema.parse({
          schemaVersion: 1, revision: { id: `provisional-source-${provisionalHash.slice(0, 32)}`, parentId: null, digest: '0'.repeat(64) },
          manifest: { identity: { kind: 'songsterr', url: parsed.url.href, songId: metadata.songId, upstreamRevisionId: metadata.revisionId, formatVersion: version, ...(unversionedPartIds.length ? { unversionedPartIds } : {}) }, retrievedAt: (options.now?.() ?? new Date()).toISOString(), parser: { name: 'songsterr-source-adapter', version: PARSER_VERSION }, artifacts: transport.artifacts },
          key: sourceKey(keyDeclarations, events), parts, events, bars: structure.bars, tempos: structure.tempos, form: structure.form,
        });
        source.revision.digest = await revisionDigest(source);
        diagnostics.push(diagnostic('selection-needed', 'Valid PROVISIONAL IMPORT document: its schema and digest are internally valid, but its header is not an API-allocated saved source identity. API must allocate project/source revision identity and parent, recompute digest BEFORE saving, then call createDefaultMelodySelection(stampedSource). No source data is corrupted or stale.', 'info'));
        diagnostics.push(diagnostic('selection-needed', `Imported all ${parts.length} source part identities. Website default part ${metadata.defaultTrack ?? '(not declared)'} and URL-linked parts do not define melody; use explicit event/voice selection.`, 'info'));
        diagnostics.push(diagnostic('unsupported-construct', 'Source access flags were checked: hasPlayer=true, isBlocked=false, isRestricted=false, restriction empty. Raw page/parts retain flags and source metadata. Sharp display spellings are inferred, not source key declarations.', 'info'));
        return ImportResultSchema.parse({ status: 'source-ready', source, diagnostics });
      } catch (error) {
        if (error instanceof SourceFailure) return { status: error.status, diagnostics: [error.diagnostic] };
        return { status: 'unavailable', diagnostics: [diagnostic('invalid-input', signal?.aborted ? 'Source import cancelled; no partial source returned.' : `Source import failed or timed out; no demo/partial source substituted. ${error instanceof Error ? error.name : 'Unknown error'}`, 'error')] };
      }
    },
  };
}

function compareEvents(a: SourceScoreV1['events'][number], b: SourceScoreV1['events'][number]) {
  const delta = BigInt(a.start.n) * BigInt(b.start.d) - BigInt(b.start.n) * BigInt(a.start.d);
  return (delta < 0n ? -1 : delta > 0n ? 1 : 0) || a.partId - b.partId || a.voiceId.localeCompare(b.voiceId) || a.id.localeCompare(b.id);
}
export const songsterrSourceAdapter: SourceAdapter = createSongsterrSourceAdapter();
