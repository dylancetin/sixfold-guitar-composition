# Songsterr source boundary (U04)

Public entry point: `src/source/index.ts`. Runtime: Bun (the adapted reference
uses `HTMLRewriter` for the one `script#state` element, not a generic scraper).
No new dependencies.

```ts
import { songsterrSourceAdapter, createDefaultMelodySelection } from './source';

const imported = await songsterrSourceAdapter.import({ kind: 'songsterr-url', url }, signal);
if (imported.status !== 'source-ready') return imported;
// API NOW allocates project/source revision identity and parent, schema-parses
// and recomputes revisionDigest. Never save the provisional import header.
const stampedSource = await apiOwnedStampAndPersist(imported.source);
const proposal = createDefaultMelodySelection(stampedSource);
// proposal.status === 'proposed' is complete, source-grounded and UNAPPROVED.
// proposal.status === 'selection-needed' means a real unsupported/conflicting choice.
```

**Identity clarification confirmed by parent, 2026-10-20:** frozen `ImportInput`
has `{kind,url}` only; no identity fields were added or silently accepted.
The adapter returns an internally schema/digest-valid **provisional import document**,
not a corrupted/stale saved score. API owns project and source revision identity,
parent allocation and recomputed digest **before saving or calling the helper**.
Recreate/rebind the selection after stamping; preserve all musical event IDs.
The info diagnostic uses the existing `selection-needed` code because the
frozen diagnostic enum has no dedicated import-provenance code; it is not an
error, and a complete unapproved proposal is not an incomplete melody.

`createSongsterrSourceAdapter({saveArtifact})` lets the API persist immutable raw
bytes by the supplied SHA-256 descriptor, before committing a source document.
Without a sink, `songsterrRawArtifacts.get(sha256)` retrieves copied bytes from
a bounded, ephemeral 64 MiB store. That store can evict old data; it is **not**
durable revision storage. There is no hidden file write in production import.

Limits: 32 parts, 1,000 bars per part, 8 MiB per response, 32 MiB per import,
15 seconds per resource including at most 3 redirects, 60 seconds overall,
and at most 100,000 processed beats per part. Public HTTPS Songsterr pages and
one fixed player CDN only; no auth, alternate CDN retries, premium downloads,
CAPTCHA workaround or fallback demo. Denials/restrictions stop all remaining
requests. Queries/fragments are never forwarded or saved in manifest identity.
Unknown versions, absent access flags, rhythm contradictions, malformed ties,
unsupported form and inconsistent parts fail explicitly without a partial pitched score.

All source fractions are reduced exact rationals in quarters; raw bytes retain
the original whole-fraction syntax and every original field. Merged ties/unison
members retain every ref. Sounding pitch is source tuning[string]+fret, not
final guitar placement. `source-notation` non-melody effects retain per-beat
base/dots/tuplet hints on notes; rest notation is recoverable from raw artifacts
and exact fractions. No parallel canonical model was introduced. Sharp spelling
is disclosed display convention; key remains unknown without sufficient evidence.

Unsupported note effects are retained and diagnosed. A chosen line with a
melody-affecting effect returns `selection-needed`, not invented silence or an
automatic accompaniment substitution. Percussion identifiers have an explicit
`unpitched-percussion`/`affectsMelody` marker and are not pitched melody candidates;
unrepresentable percussion is retained raw-only with its part identity and warning.
V1 has no native percussion-event variant. Expressive playback is not implemented.

The default helper ranks actual source voices by activity, register and
public timbre/name evidence, ignores website-default track identity, and fills
leading/multi-bar silent runs from a disclosed fallback line. It selects whole
event IDs (highest simultaneous onset, held selection wins over overlap), never
clips a tie. Source rests plus reasoned intentional rests cover all written time;
provenance records selected, overlapping omitted and intentional-silence evidence
IDs. Role/intro/outro judgments remain pending musician review.
