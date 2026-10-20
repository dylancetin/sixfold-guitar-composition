"""Private-input A04 oracle: no production importer/engine/domain/form imports.
RUN_DIR, AUTHOR_DIR, REVIEW_DIR and PUBLISH_RESULT point to ignored/local data.
Checks raw parts, selected source, every realization, form and held constraints.
"""
import json
import os
import hashlib
from pathlib import Path
from fractions import Fraction as F
from collections import Counter

run = Path(os.environ['RUN_DIR'])
author = Path(os.environ['AUTHOR_DIR'])
out = Path(os.environ['REVIEW_DIR'])
read = lambda p: json.loads(Path(p).read_text())
source = read(run / 'source.json')
request = read(run / 'request.json')
plan = read(run / 'plan.json')
q = lambda v: F(v['n'], v['d'])
end = lambda e: q(e['start']) + q(e['duration'])
ids = lambda e: e['provenance'].get('eventIds', e['provenance'].get('evidenceEventIds', []))
barof = lambda e: int(q(e['start']) // 4) + 1
src = {e['id']: e for e in source['events']}
form = list(range(1, 8)) + list(range(5, 8)) + list(range(8, 20)) + list(range(17, 20)) + list(range(20, 47)) + list(range(43, 47)) * 3

# Reconstruct the raw pitched parts, including merged ties, not just raw hashes.
reconstructed = {}
parts = {}
for artifact in source['manifest']['artifacts']:
    raw = (run / 'raw' / artifact['sha256']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == artifact['sha256'] and len(raw) == artifact['byteLength']
    if not artifact['id'].startswith('part-'):
        continue
    p = json.loads(raw)
    pid = p['partId']
    parts[pid] = p
    assert (p['songId'], p['revisionId'], p['version']) == (692866, 847990, 5)
    if pid == 10:
        continue  # Percussion is not a pitched string source.
    active = {}
    for bi, bar in enumerate(p['measures']):
        for vi, voice in enumerate(bar['voices']):
            at = F(bi * 4)
            for bti, beat in enumerate(voice['beats']):
                duration = F(*beat['duration']) * 4
                prefix = f'p{pid}:b{bi+1}:v{vi}:bt{bti}'
                if beat.get('rest'):
                    reconstructed[prefix + ':rest'] = dict(start=at, duration=duration, kind='rest', refs=[prefix + f':n{ni}' for ni, _ in enumerate(beat['notes'])])
                else:
                    for ni, n in enumerate(beat['notes']):
                        if n.get('rest'):
                            continue
                        pitch = p['tuning'][n['string']] + p.get('capo', 0) + n['fret']
                        nid = prefix + f':n{ni}'
                        key = (vi, n['string'])
                        if n.get('tie'):
                            e = active[key]
                            assert e['pitch'] == pitch and e['start'] + e['duration'] == at
                            e['duration'] += duration
                            e['refs'].append(nid)
                        else:
                            e = dict(start=at, duration=duration, kind='note', pitch=pitch, refs=[nid])
                            reconstructed[nid] = e
                            active[key] = e
                at += duration
            assert at == (bi + 1) * 4
for e in source['events']:
    if e['partId'] == 10:
        continue
    raw = reconstructed[e['id']]
    assert (raw['kind'], raw['start'], raw['duration'], raw['refs']) == (e['kind'], q(e['start']), q(e['duration']), [r['sourceNoteId'] for r in e['refs']])
    if e['kind'] == 'note':
        assert raw['pitch'] == e['soundingMidi']
assert set(reconstructed) == {e['id'] for e in source['events'] if e['partId'] != 10}
repeats = []
begin = None
for i, b in enumerate(parts[0]['measures']):
    if b.get('repeatStart'):
        assert begin is None
        begin = i + 1
    if 'repeat' in b:
        repeats.append((begin, i + 1, b['repeat']))
        begin = None
assert repeats == [(5, 7, 2), (17, 19, 2), (43, 46, 4)]
assert [(int(t['barId'][4:]), q(t['offset']), t['quarterBpm']) for t in source['tempos']] == [(t['measure']+1, F(t['position'])*4, t['bpm']*4/t['type']) for t in parts[0]['automations']['tempo']]
selected = sorted([e for e in source['events'] if e['partId'] == (1 if barof(e) <= 4 or 34 <= barof(e) <= 37 else 0) and barof(e) != 42], key=lambda e: (q(e['start']), e['id']))
assert Counter(e['id'] for e in selected) == Counter(i for sec in request['selection']['sections'] for sel in sec['selectors'] for i in sel['eventIds'])
notes = [e for e in selected if e['kind'] == 'note']
rests = [e for e in selected if e['kind'] == 'rest']
assert len(notes) == 173 and len(rests) == 16 and sum(e['partId'] == 0 for e in notes) == 141

def inspect(score, expected_plan):
    sounds = {s['id']: s for s in score['sounds']}
    placements = {p['id']: p for p in score['placements']}
    assert score['plan'] == expected_plan and score['selection'] == request['selection']
    assert score['instrument']['tuning'] == [40, 45, 50, 55, 59, 64]
    assert score['key'] == source['key'] and score['preferences']['transposition'] == dict(mode='preserve', semitones=0)
    for key in ['bars', 'tempos', 'form']:
        assert score[key] == source[key]
    melody = sorted([s for s in sounds.values() if s['role'] == 'melody'], key=lambda s: q(s['start']))
    assert len(melody) == 173
    for s, e in zip(melody, notes):
        assert (ids(s), q(s['start']), end(s), s['soundingMidi'], s['spelling']) == ([e['id']], q(e['start']), end(e), e['soundingMidi'], e['spelling'])
    assert [b['soundingMidi']-a['soundingMidi'] for a, b in zip(melody, melody[1:])] == [b['soundingMidi']-a['soundingMidi'] for a, b in zip(notes, notes[1:])]
    for e in rests:
        matches = [r for r in score['rests'] if ids(r) == [e['id']]]
        assert len(matches) == 1 and (q(matches[0]['start']), end(matches[0])) == (q(e['start']), end(e))
    silent = [r for r in score['rests'] if r['provenance']['kind'] == 'intentional']
    assert len(silent) == 1 and (q(silent[0]['start']), end(silent[0])) == (164, 168)
    assert src['p0:b42:v0:bt0:rest']['kind'] == 'rest'
    for c in expected_plan['candidates']:
        matches = [s for s in sounds.values() if s['role'] == c['role'] and ids(s) == c['sourceEventIds']]
        assert len(matches) == 1
        s, e = matches[0], src[c['sourceEventIds'][0]]
        assert q(s['start']) == q(e['start']) and (s['soundingMidi']-e['soundingMidi']) % 12 == 0 and 0 < q(s['duration']) <= q(e['duration'])
        if c['role'] == 'harmony':
            assert s['soundingMidi'] == e['soundingMidi'] + 12*c['octaveShift']
    assert sum(s['role'] != 'melody' for s in sounds.values()) == len(expected_plan['candidates'])
    for s in list(sounds.values()) + score['rests']:
        at = q(s['start'])
        for n in sorted([n for n in score['notation'] if n['eventId'] == s['id']], key=lambda n: q(n['start'])):
            assert q(n['start']) == at and n['voiceId'] == s['voiceId'] and q(n['duration']) > 0
            b = next(b for b in score['bars'] if b['id'] == n['barId'])
            assert q(b['start']) <= at and at + q(n['duration']) <= q(b['start']) + q(b['length'])
            at += q(n['duration'])
        assert at == end(s)
    expected = []
    visits = Counter()
    for i, b in enumerate(form):
        visits[b] += 1
        o = score['occurrences'][i]
        assert (o['writtenBarId'], q(o['start']), q(o['length']), o['pass']) == (f'bar-{b}', i*4, 4, visits[b])
        for s in sounds.values():
            if barof(s) == b:
                expected.append((s['id'], F(i*4) + q(s['start']) - (b-1)*4, q(s['duration'])))
        t = [t for t in source['tempos'] if int(t['barId'][4:]) <= b][-1]
        pt = score['performedTempos'][i]
        assert (q(pt['start']), pt['quarterBpm'], pt['sourceTempoId']) == (i*4, t['quarterBpm'], t['id'])
    performed = score['performedSounds']
    assert len(score['occurrences']) == len(score['performedTempos']) == 64
    assert Counter((p['soundId'], q(p['start']), q(p['duration'])) for p in performed) == Counter(expected)
    assert sum(sounds[p['soundId']]['role'] == 'melody' for p in performed) == 245
    contacts = {c['performedSoundId']: c for c in score['contacts']}
    assert len(contacts) == len(performed)
    for p in performed:
        s, pl, c = sounds[p['soundId']], placements[p['placementId']], contacts[p['id']]
        assert pl['soundId'] == s['id'] and c['soundId'] == s['id'] and c['placementId'] == pl['id']
        assert (q(c['start']), q(c['release'])) == (q(p['start']), end(p))
        assert s['soundingMidi'] == [40,45,50,55,59,64][pl['stringIndex']] + score['instrument']['capo'] + pl['fret']
        assert 0 <= pl['fret'] and pl['fret'] + score['instrument']['capo'] <= min(score['ability']['maxPhysicalFret'], score['instrument']['maxPhysicalFret'])
        assert pl['finger'] == 0 if pl['fret'] == 0 else 1 <= pl['finger'] <= 4
    points = sorted({q(p['start']) for p in performed} | {end(p) for p in performed})
    assert [q(h['at']) for h in score['handStates']] == points
    maximum_span = maximum_contacts = maximum_stopped = 0
    rank = dict(bass=0, harmony=1, melody=2)
    for at, h in zip(points, score['handStates']):
        active = [p for p in performed if q(p['start']) <= at < end(p)]
        pp = [placements[p['placementId']] for p in active]
        stopped = [p for p in pp if p['fret']]
        assert len({p['stringIndex'] for p in pp}) == len(pp) and len({p['finger'] for p in stopped}) == len(stopped)
        assert set(h['activeContactIds']) == {contacts[p['id']]['id'] for p in active}
        span = max([p['fret'] for p in stopped], default=0) - min([p['fret'] for p in stopped], default=0)
        assert span <= score['ability']['maxStoppedFretSpan'] and len(pp) <= score['ability']['maxSoundingNotes'] and len(stopped) <= score['ability']['maxFrettedContacts']
        maximum_span, maximum_contacts, maximum_stopped = max(maximum_span, span), max(maximum_contacts, len(pp)), max(maximum_stopped, len(stopped))
        for a in active:
            for b in active:
                sa, sb = sounds[a['soundId']], sounds[b['soundId']]
                if rank[sa['role']] < rank[sb['role']]:
                    assert sa['soundingMidi'] < sb['soundingMidi'], 'held role crossing'
    bass = sorted([s for s in sounds.values() if s['role'] == 'bass'], key=lambda s: q(s['start']))
    errors = []
    for a, b in zip(bass, bass[1:]):
        sa, sb = src[ids(a)[0]], src[ids(b)[0]]
        if (sa['partId'], sa['voiceId']) == (sb['partId'], sb['voiceId']):
            actual_delta, source_delta = b['soundingMidi']-a['soundingMidi'], sb['soundingMidi']-sa['soundingMidi']
            if actual_delta != source_delta:
                errors.append(dict(sourceDelta=source_delta, actualDelta=actual_delta))
    assert not any(abs(b['soundingMidi']-a['soundingMidi']) >= 12 for a, b in zip(bass, bass[1:]))
    assert sum(abs(e['actualDelta']-e['sourceDelta']) for e in errors) == (0 if score['instrument']['capo'] == 0 else 96)
    assert sum(e['actualDelta']*e['sourceDelta'] < 0 for e in errors) == (0 if score['instrument']['capo'] == 0 else 8)
    assert bass[-1]['soundingMidi'] == 42 and q(bass[-1]['start']) == 183 and end(bass[-1]) == 184
    return dict(written=dict(Counter(s['role'] for s in sounds.values())), performed=dict(Counter(sounds[p['soundId']]['role'] for p in performed)), boundaries=len(points), maxPhysicalFret=max(p['fret']+score['instrument']['capo'] for p in placements.values()), maxSpan=maximum_span, maxSounding=maximum_contacts, maxStopped=maximum_stopped, bassRange=[min(s['soundingMidi'] for s in bass), max(s['soundingMidi'] for s in bass)], contourError=sum(abs(e['actualDelta']-e['sourceDelta']) for e in errors), contourReversals=sum(e['actualDelta']*e['sourceDelta'] < 0 for e in errors), roleCrossings=0, octaveBassLeaps=0)

results = []
retained_plan = read(author / 'retained-plan.json')
signature = lambda s: (s['role'], tuple(ids(s)), q(s['start']), q(s['duration']), s['soundingMidi'], json.dumps(s['spelling'], sort_keys=True))
for capo in [0, 2, 'compare']:
    retained = read(out / f'retained-plan-capo{capo}.json')
    omitted = read(out / f'm2-omission-plan-capo{capo}.json')
    results.append(dict(plan='retained', request=capo, **inspect(retained, retained_plan)))
    results.append(dict(plan='omitted', request=capo, **inspect(omitted, plan)))
    missing = [s for s in retained['sounds'] if ids(s) == ['p7:b35:v0:bt4:n0'] and s['role'] == 'harmony']
    assert len(missing) == 1 and (missing[0]['soundingMidi'], q(missing[0]['start']), end(missing[0])) == (52, 138, 139)
    overlaps = sorted([s for s in retained['sounds'] if s['role'] == 'melody' and max(q(s['start']), F(138)) < min(end(s), F(139))], key=lambda s: q(s['start']))
    assert [(s['soundingMidi']-52, q(s['duration'])) for s in overlaps] == [(4, F(1,2)), (2, F(1,2))]
    assert Counter(signature(s) for s in retained['sounds'] if s is not missing[0]) == Counter(signature(s) for s in omitted['sounds']), 'all other realized music exact, irrespective of regenerated IDs'
    assert not any(c['kind'] == 'omission' for c in omitted['changes'])
pub = read(os.environ['PUBLISH_RESULT'])
published = read(Path(pub['directory']) / 'score.json')
results.append(dict(plan='published', request='compare', **inspect(published, plan)))
original = read(out / 'm2-omission-plan-capocompare.json')
assert {k:v for k,v in published.items() if k not in ['projectId','revision']} == {k:v for k,v in original.items() if k not in ['projectId','revision']}
report = dict(status='VERIFIED', rawArtifacts=len(source['manifest']['artifacts']), pitchedEvents=len(reconstructed), melody=dict(main=141, written=173, performed=245, selectedRests=16, intentionalSilentBars=1), form=form, results=results, M2='one E3 omitted; retained low third then second independently confirmed; every other realized pitch/time/spelling exact', humanAcceptance='INCONCLUSIVE')
(out / 'independent-oracle.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report, indent=2))
