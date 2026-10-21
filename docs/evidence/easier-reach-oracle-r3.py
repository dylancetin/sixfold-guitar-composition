"""No production music imports. RUN_DIR, REVIEW_DIR, OLD_RUN_DIR, OLD_SCORE required.
Independent Fraction source/form/contact sweep and before/after descriptors.
All full-song data/results remain private. PUBLISH_RESULT optionally audits exports' score.
"""
import os, json, hashlib
from pathlib import Path
from fractions import Fraction as F
from collections import Counter
read=lambda p:json.loads(Path(p).read_text())
run=Path(os.environ['RUN_DIR']);out=Path(os.environ['REVIEW_DIR'])
source=read(run/'source.json');request=read(run/'request.json');plan=read(run/'plan.json')
oldsource=read(Path(os.environ['OLD_RUN_DIR'])/'source.json')
# Exact canonical music is unchanged from the previously raw-reconstructed source.
for k in ['events','bars','tempos','form','parts','key']:assert source[k]==oldsource[k],k
assert source['manifest']['identity']==oldsource['manifest']['identity']
for a in source['manifest']['artifacts']:
    b=(run/'raw'/a['sha256']).read_bytes();assert len(b)==a['byteLength'] and hashlib.sha256(b).hexdigest()==a['sha256']
    if a['id'].startswith('part-'):assert a==next(x for x in oldsource['manifest']['artifacts'] if x['id']==a['id'])
assert read(run/'selection.json')==request['selection']
q=lambda x:F(x['n'],x['d'])
end=lambda e:q(e['start'])+q(e['duration'])
ids=lambda s:s['provenance'].get('eventIds',s['provenance'].get('evidenceEventIds',[]))
src={e['id']:e for e in source['events']}
selected=[src[i] for sec in request['selection']['sections'] for sel in sec['selectors'] for i in sel['eventIds']]
notes=sorted([e for e in selected if e['kind']=='note'],key=lambda e:q(e['start']))
assert len(notes)==173 and sum(e['partId']==0 for e in notes)==141
assert sum(e['kind']=='rest' for e in selected)==16
form=list(range(1,8))+list(range(5,8))+list(range(8,20))+list(range(17,20))+list(range(20,47))+list(range(43,47))*3
def seconds(a,b,tempos):
    return sum(max(F(0),min(b,q(tempos[i+1]['start']) if i+1<len(tempos) else b)-max(a,q(t['start'])))*60/F(str(t['quarterBpm'])) for i,t in enumerate(tempos))
def inspect(s):
    sounds={n['id']:n for n in s['sounds']};pls={p['id']:p for p in s['placements']}
    assert len(sounds)==len(s['sounds']) and len(pls)==len(s['placements'])
    assert s['key']==source['key'] and s['preferences']['transposition']=={'mode':'preserve','semitones':0} and s['preferences']['tempoScale']==1
    for k in ['bars','tempos','form']:assert s[k]==source[k]
    melody=sorted([n for n in s['sounds'] if n['role']=='melody'],key=lambda n:q(n['start']))
    assert [(ids(n),n['soundingMidi'],q(n['start']),end(n),n['spelling']) for n in melody]==[([e['id']],e['soundingMidi'],q(e['start']),end(e),e['spelling']) for e in notes]
    for e in selected:
        if e['kind']=='rest':
            rs=[r for r in s['rests'] if ids(r)==[e['id']]];assert len(rs)==1 and (q(rs[0]['start']),end(rs[0]))==(q(e['start']),end(e))
    silent=[r for r in s['rests'] if r['provenance']['kind']=='intentional'];assert len(silent)==1 and (q(silent[0]['start']),end(silent[0]))==(164,168)
    assert len(s['occurrences'])==len(s['performedTempos'])==64
    visits=Counter();expected=[]
    for i,b in enumerate(form):
        o=s['occurrences'][i];visits[b]+=1
        assert (o['writtenBarId'],q(o['start']),q(o['length']),o['pass'])==(f'bar-{b}',i*4,4,visits[b])
        t=[t for t in source['tempos'] if int(t['barId'][4:])<=b][-1];pt=s['performedTempos'][i]
        assert (q(pt['start']),pt['quarterBpm'],pt['sourceTempoId'],pt['occurrenceId'])==(i*4,t['quarterBpm'],t['id'],o['id'])
        expected.extend((n['id'],F(i*4)+q(n['start'])-(b-1)*4,q(n['duration'])) for n in s['sounds'] if (b-1)*4<=q(n['start'])<b*4)
    assert Counter(expected)==Counter((p['soundId'],q(p['start']),q(p['duration'])) for p in s['performedSounds'])
    for n in s['sounds']+s['rests']:
        at=q(n['start'])
        for seg in sorted([z for z in s['notation'] if z['eventId']==n['id']],key=lambda z:q(z['start'])):
            assert q(seg['start'])==at and seg['voiceId']==n['voiceId'];at+=q(seg['duration'])
        assert at==end(n)
    events=[]
    assert len(s['contacts'])==len(s['performedSounds'])
    for p in s['performedSounds']:
        n=sounds[p['soundId']];pl=pls[p['placementId']];cs=[c for c in s['contacts'] if c['performedSoundId']==p['id']];assert len(cs)==1;c=cs[0]
        assert (c['soundId'],c['placementId'],q(c['start']),q(c['release']))==(n['id'],pl['id'],q(p['start']),end(p))
        assert pl['soundId']==n['id'] and n['soundingMidi']==[40,45,50,55,59,64][pl['stringIndex']]+s['instrument']['capo']+pl['fret']
        assert pl['finger']==0 if pl['fret']==0 else 1<=pl['finger']<=4
        events.append(dict(id=p['id'],contact=c['id'],role=n['role'],pitch=n['soundingMidi'],sourceIds=ids(n),start=q(p['start']),end=end(p),string=6-pl['stringIndex'],fret=pl['fret'],physical=pl['fret']+s['instrument']['capo'],finger=pl['finger']))
    events.sort(key=lambda e:(e['start'],e['id']));times=sorted({t for e in events for t in [e['start'],e['end']]});frames=[]
    assert [q(h['at']) for h in s['handStates']]==times
    for i,(t,h) in enumerate(zip(times,s['handStates'])):
        active=[e for e in events if e['start']<=t<e['end']];st=[e for e in active if e['fret']]
        assert set(h['activeContactIds'])=={e['contact'] for e in active}
        assert len({e['string'] for e in active})==len(active) and len({e['finger'] for e in st})==len(st)
        for a in active:
            for b in active:
                if {'bass':0,'harmony':1,'melody':2}[a['role']]<{'bass':0,'harmony':1,'melody':2}[b['role']]:assert a['pitch']<b['pitch']
        span=max([e['fret'] for e in st],default=0)-min([e['fret'] for e in st],default=0)
        assert span<=s['ability']['maxStoppedFretSpan'] and len(st)<=s['ability']['maxFrettedContacts'] and len(active)<=s['ability']['maxSoundingNotes']
        assert h['position']==({'kind':'fretting','anchorPhysicalFret':min(e['physical'] for e in st)} if st else {'kind':'released'})
        frames.append(dict(at=t,until=times[i+1] if i+1<len(times) else t,span=span,active=active,stopped=st))
    moves=[]
    for a,b in zip(frames,frames[1:]):
        if not a['stopped'] or not b['stopped']:continue
        step=abs(min(e['physical'] for e in a['stopped'])-min(e['physical'] for e in b['stopped']));dt=seconds(a['at'],b['at'],s['performedTempos'])
        moves.append(dict(at=b['at'],step=step,rate=float(step/dt)))
    fingerMoves=[]
    for finger in range(1,5):
        line=[e for e in events if e['finger']==finger]
        for a,b in zip(line,line[1:]):
            assert a['end']<=b['start']
            if (a['string'],a['fret'])!=(b['string'],b['fret']):fingerMoves.append(dict(finger=finger,freeGap=seconds(a['end'],b['start'],s['performedTempos']),fromContact=a,toContact=b))
    bass=sorted([n for n in s['sounds'] if n['role']=='bass'],key=lambda n:q(n['start']));reversals=[]
    for a,b in zip(bass,bass[1:]):
        assert abs(b['soundingMidi']-a['soundingMidi'])<12
        ea,eb=src[ids(a)[0]],src[ids(b)[0]]
        if (ea['partId'],ea['voiceId'])==(eb['partId'],eb['voiceId']) and (eb['soundingMidi']-ea['soundingMidi'])*(b['soundingMidi']-a['soundingMidi'])<0:reversals.append((ea['id'],eb['id']))
    summary=dict(capo=s['instrument']['capo'],written=dict(Counter(n['role'] for n in s['sounds'])),performed=dict(Counter(e['role'] for e in events)),maxPhysicalFret=max(e['physical'] for e in events),maxStoppedSpan=max(f['span'] for f in frames),maxSounding=max(len(f['active']) for f in frames),maxStopped=max(len(f['stopped']) for f in frames),spanAbove2Seconds=float(sum(seconds(f['at'],f['until'],s['performedTempos']) for f in frames if f['span']>2)),occupiedMinimumTravelProxy=sum(m['step'] for m in moves),maxProxyStep=max(m['step'] for m in moves),maxProxyRate=max(m['rate'] for m in moves),bassContourReversals=len(reversals))
    summary['zeroFreeGapFingerReassignments']=sum(m['freeGap']==0 for m in fingerMoves)
    summary['reversedFingerFrames']=sum(any(a['fret']<b['fret'] and a['finger']>b['finger'] for a in f['stopped'] for b in f['stopped']) for f in frames)
    return dict(summary=summary,events=events,frames=frames,moves=moves,reversals=reversals,fingerMoves=fingerMoves)
old=read(os.environ['OLD_SCORE']);results={'old':inspect(old)}
for cap in [0,2,'compare']:
    s=read(out/f'capo{cap}-score.json');assert s['plan']==plan
    assert not any(c['kind'] in ['shortened-sustain','omission'] for c in s['changes'])
    for c in plan['candidates']:
        ns=[n for n in s['sounds'] if n['role']==c['role'] and ids(n)==c['sourceEventIds']];assert len(ns)==1;n=ns[0];e=src[c['sourceEventIds'][0]]
        assert (q(n['start']),q(n['duration']))==(q(e['start']),q(e['duration'])) and (n['soundingMidi']-e['soundingMidi'])%12==0
    results[str(cap)]=inspect(s)
    assert results[str(cap)]['summary']['performed']=={'melody':245,'bass':80,'harmony':9}
assert (results['old']['summary']['maxStoppedSpan'],results['2']['summary']['maxStoppedSpan'])==(3,2)
assert (results['old']['summary']['maxPhysicalFret'],results['2']['summary']['maxPhysicalFret'])==(9,7)
assert results['2']['summary']['occupiedMinimumTravelProxy']==123 and results['old']['summary']['occupiedMinimumTravelProxy']==304
assert results['2']['summary']['bassContourReversals']==9
assert results['2']['summary']['zeroFreeGapFingerReassignments']==49 and results['old']['summary']['zeroFreeGapFingerReassignments']==240
assert results['2']['summary']['reversedFingerFrames']==0 and results['old']['summary']['reversedFingerFrames']==112
oldpairs={(c['role'],i) for c in old['plan']['candidates'] for i in c['sourceEventIds']};newpairs={(c['role'],i) for c in plan['candidates'] for i in c['sourceEventIds']}
selectionDiff=dict(retained=len(oldpairs&newpairs),removed=len(oldpairs-newpairs),added=len(newpairs-oldpairs));assert selectionDiff==dict(retained=50,removed=108,added=14)
bassbars={int(q(src[c['sourceEventIds'][0]]['start'])//4)+1 for c in plan['candidates'] if c['role']=='bass'};assert len(bassbars)==43
if os.environ.get('PUBLISH_RESULT'):
    pub=read(os.environ['PUBLISH_RESULT']);s=read(Path(pub['directory'])/'score.json');original=read(out/'capocompare-score.json')
    assert {k:v for k,v in s.items() if k not in ['projectId','revision']}=={k:v for k,v in original.items() if k not in ['projectId','revision']}
    assert s['musicalReview']['status']=='pending' and s['approvals']['stage']=='sourceReady' and not s['locks'];results['published']=inspect(s)
spots=[]
for bar,beat in [(1,F(4)),(12,F(7,4)),(30,F(7,2)),(35,F(1)),(46,F(4))]:
    row=dict(writtenBar=bar,beat=beat)
    for name in ['old','compare']:
        o=next(o for o in old['occurrences'] if o['writtenBarId']==f'bar-{bar}');at=q(o['start'])+beat-1
        row[name]=next(f for f in results[name]['frames'] if f['at']<=at<f['until'])
    spots.append(row)
transitions=[]
for first,last,ms in [('p0:b29:v0:bt4:n0','p0:b30:v0:bt0:n0',1000/9),('p0:b12:v0:bt1:n0','p0:b12:v0:bt2:n0',1000/6),('p1:b34:v0:bt3:n0','p1:b34:v0:bt4:n0',1000/3)]:
    a=next(e for e in results['compare']['events'] if e['role']=='melody' and e['sourceIds']==[first]);b=next(e for e in results['compare']['events'] if e['role']=='melody' and e['sourceIds']==[last])
    spacing=1000*float(seconds(a['start'],b['start'],s['performedTempos']));assert abs(spacing-ms)<1e-6
    assert a['end']==b['start'];transitions.append(dict(fromContact=a,toContact=b,onsetSpacingMs=spacing,releaseGapMs=0))
report=dict(status='VERIFIED',summaries={k:r['summary'] for k,r in results.items()},spots=spots,remainingTransitions=transitions,fullAudits=results,selectionDiff=selectionDiff,bassSupportedWrittenBars=len(bassbars),sourceMusicalFieldsUnchanged=True,rawArtifactsHashChecked=12,humanAcceptance='pending; descriptors not measured hand motion')
(out/'independent-oracle.json').write_text(json.dumps(report,indent=2,default=lambda x:str(x) if isinstance(x,F) else x)+'\n')
print(json.dumps(report['summaries'],indent=2))
