// Newly authored original fixture: a 3/2-quarter bass followed by a 5/2-quarter gap.
import { createHash } from 'node:crypto';
import { compare, q } from '../../src/domain';
import { stamp, study } from './fixture';

export async function gapStudy() {
  const fixture = await study();
  const { source, score } = fixture;
  source.revision.id += '-gap'; score.revision.id += '-gap';
  const sourceBass = source.events.find(e => e.id === 'src-b0')!;
  sourceBass.duration = q(3, 2); sourceBass.refs[0]!.rawWholeNoteDuration = q(3, 8);
  source.manifest.identity = { kind: 'original-fixture', name: 'Dotted-quarter bass and five-halves silence', author: 'Guitar composition project' };
  const rawArtifact = new TextEncoder().encode(JSON.stringify({ parts: source.parts, bars: source.bars, tempos: source.tempos, form: source.form, events: source.events }));
  source.manifest.artifacts = [{ id: 'gap-study-raw', sha256: createHash('sha256').update(rawArtifact).digest('hex'), byteLength: rawArtifact.byteLength, mediaType: 'application/json' }];
  await stamp(source);
  score.source = { revision: { id: source.revision.id, digest: source.revision.digest }, manifest: structuredClone(source.manifest) };
  score.selection.sourceRevision = { ...score.source.revision };
  score.sounds.find(s => s.id === 'bass0')!.duration = q(3, 2);
  Object.assign(score.notation.find(n => n.eventId === 'bass0')!, { duration: q(3, 2), baseDenominator: 4, dots: 1 });
  score.performedSounds.find(p => p.soundId === 'bass0')!.duration = q(3, 2);
  score.contacts.find(c => c.soundId === 'bass0')!.release = q(3, 2);
  const times = [...new Map(score.contacts.flatMap(c => [c.start, c.release]).map(at => [`${at.n}/${at.d}`, at])).values()].sort(compare);
  score.handStates = times.map(at => {
    const active = score.contacts.filter(c => compare(c.start, at) <= 0 && compare(at, c.release) < 0);
    const frets = active.map(c => score.placements.find(p => p.id === c.placementId)!).filter(p => p.fret > 0).map(p => p.fret + score.instrument.capo);
    return { at, activeContactIds: active.map(c => c.id), position: frets.length ? { kind: 'fretting' as const, anchorPhysicalFret: Math.min(...frets) } : { kind: 'released' as const } };
  });
  await stamp(score);
  return { ...fixture, rawArtifact };
}
