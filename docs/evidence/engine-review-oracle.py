"""Independent exact live oracle; no engine imports. python FILE SOURCE_DIR SCORE_DIR"""
import json, hashlib, pathlib, sys
from fractions import Fraction as F
from collections import Counter, defaultdict

source_dir, base = map(pathlib.Path, sys.argv[1:3])
source = json.load(open(source_dir/'source.json'))
proposal = json.load(open(source_dir/'melody-proposal.json'))
selection = proposal.get('selection', proposal)
def r(v): return F(v['n'], v['d'])
def end(v): return r(v['start'])+r(v.get('duration', v.get('length')))
def checkdigest(doc):
    d = json.loads(json.dumps(doc)); expected = d['revision'].pop('digest')
    actual = hashlib.sha256(json.dumps(d, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
    assert actual == expected
checkdigest(source)
bars = {b['number']: b for b in source['bars']}
barbyid = {b['id']: b for b in source['bars']}
events = {e['id']: e for e in source['events']}
selected = {i for sec in selection['sections'] for selector in sec['selectors'] for i in selector['eventIds']}
notes = [events[i] for i in selected if events[i]['kind'] == 'note']
part0 = [e for e in notes if e['partId'] == 0]
assert {e['id'] for e in part0} == {e['id'] for e in source['events'] if e['partId'] == 0 and e['kind'] == 'note'}
assert len(notes) == 173 and len(part0) == 141 and sum(len(e['refs']) for e in part0) == 154
visits = list(range(1, 8))+list(range(5, 8))+list(range(8, 20))+list(range(17, 20))+list(range(20, 47))+list(range(43, 47))*3
oracle = []; expected_tempos = []; start = F(0); counts = Counter(); expected_occ = []
written_tempos = sorted([(r(barbyid[t['barId']]['start'])+r(t['offset']), t) for t in source['tempos']], key=lambda v: v[0])
for i, n in enumerate(visits):
    b = bars[n]; left = r(b['start']); right = end(b); counts[n] += 1
    active = [t for at, t in written_tempos if at <= left][-1]
    expected_occ.append((b['id'], counts[n], start, r(b['length']), b['meter'], active['quarterBpm'], 'start' if i == 0 else 'contiguous' if visits[i-1] == n-1 else 'repeat-jump'))
    expected_tempos.append((i, start, active['quarterBpm'], 'entry-restore', active['id']))
    expected_tempos.extend((i, start+at-left, t['quarterBpm'], 'written-point', t['id']) for at, t in written_tempos if left < at < right)
    for e in notes:
        if left <= r(e['start']) < right:
            at = start+r(e['start'])-left
            oracle.append((e['id'], e['soundingMidi'], at, at+r(e['duration'])))
    start += r(b['length'])
assert start == 256 and len(visits) == 64 and len(oracle) == 245
oracle.sort(key=lambda t: (t[2], t[0]))
seconds = sum(float((expected_tempos[i+1][1] if i+1 < len(expected_tempos) else start)-t[1])*60/t[2] for i, t in enumerate(expected_tempos))
assert abs(seconds-172.4056795131845) < 1e-10
rows = []
for difficulty in ['beginner', 'intermediate', 'advanced']:
    for capo in [0, 2, 'recommend']:
        p = base/f'{difficulty}-{capo}.json'; s = json.load(open(p)); checkdigest(s)
        assert s['source']['revision'] == selection['sourceRevision'] and s['source']['manifest'] == source['manifest']
        assert s['selection'] == selection and s['key'] == source['key'] and s['preferences']['transposition'] == {'mode': 'preserve', 'semitones': 0}
        assert s['bars'] == source['bars'] and s['form'] == source['form'] and s['tempos'] == source['tempos']
        assert [(o['writtenBarId'], o['pass'], r(o['start']), r(o['length']), o['meter'], o['entryQuarterBpm'], o['entry']) for o in s['occurrences']] == expected_occ
        oindex = {o['id']: i for i, o in enumerate(s['occurrences'])}
        assert [(oindex[t['occurrenceId']], r(t['start']), t['quarterBpm'], t['origin'], t['sourceTempoId']) for t in s['performedTempos']] == expected_tempos
        sounds = {x['id']: x for x in s['sounds']}; rests = {x['id']: x for x in s['rests']}; written = []; actual = []
        for e in sounds.values():
            if e['role'] == 'melody':
                assert e['provenance']['kind'] == 'source' and len(e['provenance']['eventIds']) == 1
                sid = e['provenance']['eventIds'][0]; se = events[sid]
                assert (e['soundingMidi'], r(e['start']), r(e['duration']), e['spelling']) == (se['soundingMidi'], r(se['start']), r(se['duration']), se['spelling'])
                written.append(sid)
        assert set(written) == {e['id'] for e in notes} and len(written) == 173
        for ps in s['performedSounds']:
            e = sounds[ps['soundId']]
            if e['role'] == 'melody': actual.append((e['provenance']['eventIds'][0], e['soundingMidi'], r(ps['start']), end(ps)))
        actual.sort(key=lambda t: (t[2], t[0])); assert actual == oracle
        for e in [events[i] for i in selected if events[i]['kind'] == 'rest']:
            matches = [x for x in rests.values() if x['role'] == 'melody' and x['provenance'] == {'kind': 'source', 'eventIds': [e['id']]}]
            assert len(matches) == 1 and r(matches[0]['start']) == r(e['start']) and r(matches[0]['duration']) == r(e['duration'])
        segs = defaultdict(list)
        for seg in s['notation']:
            segs[seg['eventId']].append(seg)
            dur = F(4, seg['baseDenominator'])*F(2**(seg['dots']+1)-1, 2**seg['dots'])
            if seg['tuplet']: dur *= F(seg['tuplet']['normal'], seg['tuplet']['actual'])
            assert dur == r(seg['duration']) and (r(seg['start'])*960).denominator == 1 and (dur*960).denominator == 1
        for e in list(sounds.values())+list(rests.values()):
            at = r(e['start']); ss = sorted(segs[e['id']], key=lambda seg: r(seg['start'])); assert ss
            for i, seg in enumerate(ss):
                b = barbyid[seg['barId']]
                assert r(seg['start']) == at and r(b['start']) <= at < end(seg) <= end(b)
                tie = 'none' if e['id'] in rests or len(ss) == 1 else 'start' if i == 0 else 'end' if i == len(ss)-1 else 'continue'
                assert seg['tie'] == tie and seg['voiceId'] == e['voiceId']; at = end(seg)
            assert at == end(e)
        pl = {x['id']: x for x in s['placements']}; contacts = defaultdict(list); boundaries = set()
        for c in s['contacts']: contacts[c['performedSoundId']].append(c)
        for ps in s['performedSounds']:
            e = sounds[ps['soundId']]; placement = pl[ps['placementId']]; cs = contacts[ps['id']]
            assert s['instrument']['tuning'][placement['stringIndex']]+s['instrument']['capo']+placement['fret'] == e['soundingMidi']
            assert placement['fret']+s['instrument']['capo'] <= min(s['instrument']['maxPhysicalFret'], s['ability']['maxPhysicalFret'])
            assert (placement['fret'] == 0) == (placement['finger'] == 0)
            assert len(cs) == 1 and cs[0]['placementId'] == placement['id'] and cs[0]['soundId'] == e['id'] and r(cs[0]['start']) == r(ps['start']) and r(cs[0]['release']) == end(ps)
            boundaries.update([r(ps['start']), end(ps)])
        assert [r(x['at']) for x in s['handStates']] == sorted(boundaries)
        max_poly = 0
        for hs in s['handStates']:
            at = r(hs['at']); held = [ps for ps in s['performedSounds'] if r(ps['start']) <= at < end(ps)]
            pp = [pl[ps['placementId']] for ps in held]; stopped = [p for p in pp if p['fret'] > 0]
            assert len({p['stringIndex'] for p in pp}) == len(pp) and len({p['finger'] for p in stopped}) == len(stopped)
            assert len(pp) <= s['ability']['maxSoundingNotes'] and len(stopped) <= s['ability']['maxFrettedContacts']
            if stopped: assert max(p['fret'] for p in stopped)-min(p['fret'] for p in stopped) <= s['ability']['maxStoppedFretSpan']
            assert set(hs['activeContactIds']) == {contacts[ps['id']][0]['id'] for ps in held}
            max_poly = max(max_poly, len(held))
        bass = sorted([e for e in sounds.values() if e['role'] == 'bass'], key=lambda e: r(e['start']))
        assert all(end(a) <= r(b['start']) for a, b in zip(bass, bass[1:]))
        for e in sounds.values():
            if e['role'] == 'melody': continue
            ids = e['provenance'].get('eventIds', e['provenance'].get('evidenceEventIds'))
            se = next(x for x in (events[i] for i in ids) if r(x['start']) == r(e['start']) and (x['soundingMidi']-e['soundingMidi'])%12 == 0 and r(e['duration']) <= r(x['duration']))
            for needed, kind in [(e['soundingMidi'] != se['soundingMidi'], 'bass-register'), (r(e['duration']) < r(se['duration']), 'shortened-sustain')]:
                if needed: assert any(c['kind'] == kind and c['role'] == e['role'] and se['id'] in c['sourceEventIds'] and e['id'] in c['soundIds'] and c['before'] == {'soundingMidi': se['soundingMidi'], 'duration': se['duration']} and c['after'] == {'soundingMidi': e['soundingMidi'], 'duration': e['duration']} for c in s['changes'])
            if e['role'] == 'bass': assert all(e['soundingMidi'] < m['soundingMidi'] for m in sounds.values() if m['role'] == 'melody' and max(r(e['start']), r(m['start'])) < min(end(e), end(m)))
        for c in s['plan']['candidates']:
            for sid in c['sourceEventIds']:
                kept = any(e['role'] == c['role'] and sid in e['provenance'].get('eventIds', e['provenance'].get('evidenceEventIds', [])) for e in sounds.values())
                omitted = any(x['kind'] == 'omission' and x['role'] == c['role'] and sid in x['sourceEventIds'] for x in s['changes'])
                assert kept != omitted
        roles = {role: {'written': sum(e['role'] == role for e in sounds.values()), 'performed': sum(sounds[ps['soundId']]['role'] == role for ps in s['performedSounds'])} for role in ['melody', 'bass', 'harmony']}
        leaps = [b['soundingMidi']-a['soundingMidi'] for a, b in zip(bass, bass[1:])]
        rows.append({'file': str(p), 'status': 'passed', 'capo': s['instrument']['capo'], 'difficulty': difficulty, 'roles': roles, 'seconds': seconds, 'maxPolyphony': max_poly, 'lastSoundRelease': str(max(end(ps) for ps in s['performedSounds'])), 'changes': dict(Counter(c['kind'] for c in s['changes'])), 'bassMaxLeapSemitones': max(map(abs, leaps), default=0), 'bassOctaveLeaps': sum(abs(d) >= 12 for d in leaps), 'bassWrittenDurationQuarters': str(sum((r(e['duration']) for e in bass), F(0)))})
summary = {'status': 'passed', 'oracle': 'Independent Python Fraction literal visits, source intervals, notation, physical sweep and audits', 'sourceRevision': source['revision'], 'all141Part0': True, 'selectedWrittenAttacks': 173, 'performedMelodyAttacks': 245, 'occurrences': 64, 'quarters': '256', 'seconds': seconds, 'key': source['key'], 'checkedFiles': rows}
print(json.dumps(summary, indent=2))
