import { add, compare, eventEnd, multiply, q, subtract } from '../domain';
import type { NotationSegment, Q, Rest, Sound, WrittenBar } from '../domain';

type Value=Pick<NotationSegment,'duration'|'baseDenominator'|'dots'|'tuplet'>;
const values:Value[]=[];
// At most two dots: the canonical alphaTab engraver (1.8.x) ignores a third dot, so a
// triple-dotted value is spelled as tied double-dotted/plain values instead.
for (const baseDenominator of [1,2,4,8,16,32,64] as const) for (let dots=0;dots<=2;dots++) {
  const plain=multiply(q(4,baseDenominator),q(2**(dots+1)-1,2**dots));
  values.push({duration:plain,baseDenominator,dots,tuplet:null});
  if (dots===0) for (const [actual,normal] of [[3,2],[5,4],[7,4],[9,8],[11,8],[13,8],[15,8]] as const) values.push({duration:multiply(plain,q(normal,actual)),baseDenominator,dots,tuplet:{groupId:'pending',actual,normal,index:0}});
}
values.sort((a,b)=>compare(b.duration,a.duration)||Number(!!a.tuplet)-Number(!!b.tuplet)||a.dots-b.dots);

/** Reconstruct exact spelling durations; never round unsupported denominators. */
export function makeNotation(events:(Sound|Rest)[],bars:WrittenBar[]):NotationSegment[]|null {
  const result:NotationSegment[]=[];
  for (const event of events) {
    const segments:NotationSegment[]=[];
    let at=event.start;
    for (const bar of bars) {
      const end=eventEnd(event),barEnd=add(bar.start,bar.length);
      if (compare(at,bar.start)<0||compare(at,barEnd)>=0||compare(at,end)>=0) continue;
      const until=compare(end,barEnd)<0?end:barEnd;
      let count=0;
      while (compare(at,until)<0) {
        if (++count>256) return null;
        const remaining=subtract(until,at);
        // Prefer a single exact value before a decomposition. Greedy decomposition
        // is restricted to denominators supported by our explicit value vocabulary.
        const value=values.find((v)=>compare(v.duration,remaining)===0)??values.find((v)=>compare(v.duration,remaining)<0&&compatibleDenominator(v.duration,remaining)&&representable(subtract(remaining,v.duration)));
        if (!value) return null;
        segments.push({id:`n${result.length+segments.length+1}`,eventId:event.id,kind:'soundingMidi' in event?'note':'rest',barId:bar.id,voiceId:event.voiceId,start:at,...value,tuplet:value.tuplet?{...value.tuplet}:null,tie:'none'});
        at=add(at,value.duration);
      }
    }
    if (compare(at,eventEnd(event))!==0) return null;
    if ('soundingMidi' in event && segments.length>1) for (const [i,s] of segments.entries()) s.tie=i===0?'start':i===segments.length-1?'end':'continue';
    result.push(...segments);
  }
  // Contiguous equal tuplet values share an explicit group, including rests.
  const voices=[...new Set(result.map((s)=>s.voiceId))];
  let group=0;
  for (const voice of voices) {
    let previous:NotationSegment|undefined;
    for (const segment of result.filter((s)=>s.voiceId===voice).sort((a,b)=>compare(a.start,b.start)||a.id.localeCompare(b.id))) {
      if (segment.tuplet) {
        const p=previous?.tuplet;
        if (p&&p.actual===segment.tuplet.actual&&p.normal===segment.tuplet.normal&&previous!.baseDenominator===segment.baseDenominator&&previous!.barId===segment.barId&&compare(eventEnd(previous!),segment.start)===0&&p.index+1<p.actual) segment.tuplet={...segment.tuplet,groupId:p.groupId,index:p.index+1};
        else segment.tuplet={...segment.tuplet,groupId:`tg${++group}`,index:0};
      }
      previous=segment;
    }
  }
  return result;
}

function representable(time:Q):boolean {
  let d=time.d;
  for (const factor of [2,3,5,7,11,13]) while (d%factor===0) d/=factor;
  return d===1;
}

function compatibleDenominator(value:Q,remaining:Q):boolean {
  // Never introduce an unrelated tuplet prime into a dyadic or triplet value.
  // E.g. 5/4 must split 1+1/4, not greedily consume 16/13 then get stranded.
  let odd=value.d;
  while (odd%2===0) odd/=2;
  return remaining.d%odd===0;
}
