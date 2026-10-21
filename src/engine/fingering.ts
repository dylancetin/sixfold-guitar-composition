import { compare, eventEnd, overlaps } from '../domain';
import type { Placement, Sound } from '../domain';

/** Label already-solved uncalibrated contacts, not a new position/movement solver.
 * Lowest-unused finger is not an ergonomic symmetry: it can put index at fret 4
 * above middle at fret 2. Use known full sustains to reserve a conventional
 * fret-ordered shape. This heuristic never moves a held finger or creates a barre;
 * it does not establish human comfort or replace specified transition search.
 */
export function labelUncalibratedFingers(sounds:Sound[],placements:Placement[]):Placement[] {
  const bySound=new Map(sounds.map((s)=>[s.id,s]));
  const contacts=placements.map((p)=>({sound:bySound.get(p.soundId)!,placement:{...p}}));
  contacts.sort((a,b)=>compare(a.sound.start,b.sound.start)||a.placement.fret-b.placement.fret||a.placement.id.localeCompare(b.placement.id));
  const labelled:typeof contacts=[];
  for (const contact of contacts) {
    const {sound,placement}=contact;
    if (!placement.fret) {placement.finger=0;labelled.push(contact);continue;}
    const held=labelled.filter((c)=>c.placement.fret>0&&compare(eventEnd(c.sound),sound.start)>0);
    const frets=contacts.filter((c)=>c.placement.fret>0&&overlaps(sound.start,eventEnd(sound),c.sound.start,eventEnd(c.sound))).map((c)=>c.placement.fret);
    const anchor=Math.max(1,Math.min(Math.min(...frets),Math.max(...frets)-3));
    const preferred=Math.max(1,Math.min(4,placement.fret-anchor+1));
    const cost=(finger:number)=>held.reduce((cost,c)=>{
      const fretDelta=placement.fret-c.placement.fret,fingerDelta=finger-c.placement.finger;
      const reversed=fretDelta*fingerDelta<0?100:0;
      const compressed=Math.max(0,Math.abs(fretDelta)-Math.abs(fingerDelta));
      return cost+reversed+5*compressed;
    },Math.abs(finger-preferred));
    // Only currently free fingers; a contact keeps this label until its release.
    placement.finger=[1,2,3,4].filter((f)=>!held.some((c)=>c.placement.finger===f)).sort((a,b)=>cost(a)-cost(b)||a-b)[0]!;
    labelled.push(contact);
  }
  const byId=new Map(contacts.map((c)=>[c.placement.id,c.placement]));
  return placements.map((p)=>byId.get(p.id)!);
}
