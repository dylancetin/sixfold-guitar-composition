import { q, SourceScoreV1Schema } from '../../src/domain';
import type { ArrangementRequest, MelodySelection, Plan, SourceEvent, SourceScoreV1 } from '../../src/domain';
import { createDefaultRequest } from '../../src/engine';
import { documentDigest } from '../../src/engine/identity';
import { spell } from '../../src/engine/selection';
import { source as original, score } from '../fixtures/original';

type NoteSpec=[id:string,partId:number,start:number,duration:number,pitch:number,denominator?:number,durationDenominator?:number];
export function studyEvent([id,partId,start,duration,pitch,denominator=1,durationDenominator=1]:NoteSpec):SourceEvent {
  const at=q(start,denominator),length=q(duration,durationDenominator);
  const firstBar=Math.floor(start/denominator/4)+1;
  const lastBar=Math.ceil((start/denominator+duration/durationDenominator)/4);
  return {kind:'note',id,partId,voiceId:partId===0?'melody':partId===1?'bass':'harmony',start:at,duration:length,soundingMidi:pitch,spelling:spell(pitch),effects:[],tieChainId:lastBar>firstBar?`tie-${id}`:null,
    refs:Array.from({length:lastBar-firstBar+1},(_,i)=>({sourceNoteId:`raw-${id}-${i}`,partId,barId:`b${firstBar+i}`,voiceId:partId===0?'melody':partId===1?'bass':'harmony',beatId:`beat-${id}-${i}`,noteIndex:0,rawWholeNoteDuration:q(duration,4*durationDenominator),sourcePosition:null}))};
}

export function selectionFor(source:SourceScoreV1,partId=0):MelodySelection {
  const last=source.bars.at(-1)!;
  return {id:'complete-proposed-study-map',sourceRevision:{id:source.revision.id,digest:source.revision.digest},sections:[{id:'all',label:'Complete source-grounded proposed melody, review pending',start:q(0),end:q(last.start.n/last.start.d+last.length.n/last.length.d),selectors:[{partId,voiceId:'melody',eventIds:source.events.filter((e)=>e.partId===partId).map((e)=>e.id)}],intentionalRests:[]}]};
}

export function eightBarStudy():{source:SourceScoreV1;request:ArrangementRequest} {
  const s=structuredClone(original);
  s.revision={id:'original-eight-bar-study-r1',parentId:null,digest:'0'.repeat(64)};
  s.manifest.identity={kind:'original-fixture',name:'Eight-bar turning-register study',author:'Guitar composition project'};
  s.bars=Array.from({length:8},(_,i)=>({id:`b${i+1}`,number:i+1,start:q(i*4),length:q(4),meter:{beats:4,beatUnit:4},kind:'full'}));
  s.form.repeats=[{id:'phrase-repeat',fromBarId:'b3',toBarId:'b4',totalPasses:2}];
  s.tempos.push({id:'t96',barId:'b4',offset:q(0),quarterBpm:96});
  s.events=s.events.filter((e)=>e.partId===0);
  const specs:NoteSpec[]=[['a',0,8,2,59],['b',0,10,1,61],['c',0,11,1,62],['d',0,12,2,64],['e',0,14,1,63,1,3],['f',0,43,1,64,3,6],['g',0,29,1,66,2,2],['h',0,15,1,67],['low',0,16,4,42],['j',0,20,1,54],['k',0,21,1,59],['l',0,22,1,61,1,2],['m',0,45,1,63,2,2],['n',0,23,1,64,1,2],['cross',0,47,3,63,2,2],['tail',0,25,3,59],['outro',0,28,2,64],['final',0,31,1,59]];
  s.events.push(...specs.map(studyEvent));
  s.events.push({kind:'rest',id:'outro-rest',partId:0,voiceId:'melody',start:q(30),duration:q(1),refs:[{sourceNoteId:'raw-outro-rest',partId:0,barId:'b8',voiceId:'melody',beatId:'beat-rest',noteIndex:0,rawWholeNoteDuration:q(1,4),sourcePosition:null}]});
  for (let i=0;i<8;i++) {
    s.events.push(studyEvent([`bass-${i}`,1,i*4,4,[28,31,35,28,35,30,35,28][i]!]));
    s.events.push(studyEvent([`harmony-${i}`,2,i*4,2,[59,57,54,59,54,58,54,59][i]!]));
  }
  s.revision.digest=documentDigest(s);
  const parsed=SourceScoreV1Schema.parse(s);
  const request=createDefaultRequest(parsed,selectionFor(parsed));
  request.budget.maxStates=30000;
  return {source:parsed,request};
}

export function oneBarStudy(specs:NoteSpec[]):{source:SourceScoreV1;request:ArrangementRequest;plan:Plan} {
  const s=structuredClone(original);s.bars=s.bars.slice(0,1);s.events=specs.map(studyEvent);
  s.revision={id:'one-bar-original-study',parentId:null,digest:'0'.repeat(64)};s.revision.digest=documentDigest(s);
  const request=createDefaultRequest(s,selectionFor(s));request.preferences.capo={mode:'chosen',value:0};
  const plan:Plan={version:'literal-source-test',candidates:s.events.filter((e)=>e.partId!==0).map((e,i)=>({id:`p${i}`,role:e.partId===1?'bass':'harmony',sourceEventIds:[e.id],octaveShift:0,density:'sparse',reason:'Original literal test evidence'}))};
  return {source:s,request,plan};
}

export const literalPlanner=score.planner;
