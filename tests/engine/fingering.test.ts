import { expect, test } from 'bun:test';
import { compare, eventEnd, q } from '../../src/domain';
import type { Placement, Sound } from '../../src/domain';
import { guitarEngine, guitarValidator } from '../../src/engine';
import { labelUncalibratedFingers } from '../../src/engine/fingering';
import { literalPlanner, oneBarStudy } from './studies';

test('uncalibrated dyad labels do not mistake index-above-middle for a finger symmetry',()=>{
  const {source,request,plan}=oneBarStudy([['lead',0,0,4,56],['root',1,0,1,37]]);
  request.preferences.capo={mode:'chosen',value:2};
  const r=guitarEngine.arrange(source,request,plan,literalPlanner);
  if(r.status!=='candidate')throw Error(JSON.stringify(r));
  const lead=r.score.placements.find((p)=>r.score.sounds.find((s)=>s.id===p.soundId)!.role==='melody')!;
  const bass=r.score.placements.find((p)=>r.score.sounds.find((s)=>s.id===p.soundId)!.role==='bass')!;
  expect([lead.stringIndex,lead.fret,lead.finger]).toEqual([2,4,4]);
  expect([bass.stringIndex,bass.fret,bass.finger]).toEqual([1,2,2]);
  expect(guitarValidator.validate(source,r.score,{approvedRevisions:[]}).status).toBe('passed');
  expect(r.diagnostics.some((d)=>d.code==='transition-unverified')).toBe(true);
});

test('fixed-position relabelling considers later overlaps, preserves complete held/open contacts and inputs',()=>{
  const specs:[string,number,number,number,number][]=[['anchor',0,4,0,7],['low',1,1,5,4],['middle',2,1,4,5],['open',0,4,3,0]];
  const sounds:Sound[]=specs.map(([id,start,duration])=>({id,role:'melody',voiceId:id,start:q(start),duration:q(duration),soundingMidi:64,spelling:{step:'E',alter:0,octave:4},provenance:{kind:'source',eventIds:[id]}}));
  const placements:Placement[]=specs.map(([id,,,stringIndex,fret],i)=>({id:`pl-${id}`,soundId:id,stringIndex,fret,finger:fret?i+1:0}));
  const before=JSON.stringify({sounds,placements}),result=labelUncalibratedFingers(sounds,placements);
  expect(JSON.stringify({sounds,placements})).toBe(before);
  expect(result.map((p)=>p.finger)).toEqual([4,1,2,0]);
  expect(result.map(({finger,...p})=>p)).toEqual(placements.map(({finger,...p})=>p));
  for(const at of [q(0),q(1),q(2),q(3)]){
    const held=result.filter((p)=>{const s=sounds.find((s)=>s.id===p.soundId)!;return p.fret>0&&compare(s.start,at)<=0&&compare(eventEnd(s),at)>0;});
    expect(new Set(held.map((p)=>p.finger)).size).toBe(held.length);
  }
});

test('four stopped contacts reserve distinct fingers and reuse exactly at release, independent of input order',()=>{
  const specs:[string,number,number,number,number][]=[['a',0,2,0,1],['b',0,2,1,2],['c',0,2,2,3],['d',0,2,3,4],['next',2,1,4,4],['open',0,3,5,0]];
  const sounds:Sound[]=specs.map(([id,start,duration])=>({id,role:'melody',voiceId:id,start:q(start),duration:q(duration),soundingMidi:64,spelling:{step:'E',alter:0,octave:4},provenance:{kind:'source',eventIds:[id]}}));
  const placements:Placement[]=specs.map(([id,,,stringIndex,fret])=>({id:`pl-${id}`,soundId:id,stringIndex,fret,finger:fret?1:0}));
  const freeze=(v:any):any=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
  freeze(sounds);freeze(placements);
  const result=labelUncalibratedFingers(sounds,placements);
  expect(result.map((p)=>p.finger)).toEqual([1,2,3,4,4,0]);
  expect(labelUncalibratedFingers([...sounds].reverse(),[...placements].reverse()).reverse()).toEqual(result);
  expect(result.every((p)=>Number.isInteger(p.finger)&&p.finger>=0&&p.finger<=4)).toBe(true);
  expect(result.map(({finger,...p})=>p)).toEqual(placements.map(({finger,...p})=>p));
  for(const at of [q(0),q(1),q(2),q(3)]){
    const active=result.filter((p)=>{const s=sounds.find((s)=>s.id===p.soundId)!;return p.fret>0&&compare(s.start,at)<=0&&compare(eventEnd(s),at)>0;});
    expect(new Set(active.map((p)=>p.finger)).size).toBe(active.length);
  }
});
