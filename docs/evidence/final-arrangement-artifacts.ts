// Actual-byte oracle adapted from the independent round-1 artifact checker.
// No production renderer/engine/projection imports. Inputs/results stay private.
// RUN_DIR, REVIEW_DIR, PUBLISH_RESULT required; VERIFY_ORIGIN optionally adds HTTP.
// EXPECTED_ROLE_COUNTS may specify independently reviewed revision counts as JSON;
// default retains round-2's literal expectation (not inferred from the score).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parseMidi, writeMidi } = require('midi-file');
const { Midi } = require('@tonejs/midi');
const { createCanvas } = require('@napi-rs/canvas');
const { getDocument, OPS } = await import(require.resolve('pdfjs-dist/legacy/build/pdf.mjs'));
const out = process.env.REVIEW_DIR!, run = process.env.RUN_DIR!;
assert(out && run && process.env.PUBLISH_RESULT);
const json = async (p: string) => JSON.parse(await readFile(p, 'utf8'));
const publication = await json(process.env.PUBLISH_RESULT!), dir = publication.directory;
const source = await json(`${run}/source.json`), score = await json(`${dir}/score.json`), manifest = await json(`${dir}/manifest.json`), receipt = await json(`${run}/delegation.json`);
const hash = (b: any) => createHash('sha256').update(b).digest('hex');
const roles = ['melody', 'bass', 'harmony'];
const expectedRoleCounts = process.env.EXPECTED_ROLE_COUNTS ? JSON.parse(process.env.EXPECTED_ROLE_COUNTS) : {melody:245,bass:146,harmony:98};
assert.deepEqual(Object.keys(expectedRoleCounts).sort(), [...roles].sort());
assert(Object.values(expectedRoleCounts).every(n=>Number.isSafeInteger(n)&&Number(n)>0));
const ticks = (r: any) => { const n = BigInt(r.n)*960n, d = BigInt(r.d); assert.equal(n%d, 0n); return Number(n/d); };
const writtenForm = [1,2,3,4,5,6,7,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,43,44,45,46,43,44,45,46,43,44,45,46];
function expected(s: any) {
  const sounds = new Map(s.sounds.map((n: any) => [n.id, n]));
  const notes = s.performedSounds.map((p: any) => { const n: any = sounds.get(p.soundId); assert(n); return { role:n.role, pitch:n.soundingMidi, start:ticks(p.start), end:ticks(p.start)+ticks(p.duration) }; });
  const keys = notes.map((n: any) => `${n.role}/${n.pitch}/${n.start}/${n.end}`).sort();
  const tempos = s.performedTempos.map((t: any) => ({ tick:ticks(t.start), micros:Math.floor(60000000/t.quarterBpm) }));
  assert.deepEqual(s.occurrences.map((o: any) => Number(o.writtenBarId.slice(4))), writtenForm);
  assert.equal(ticks(s.occurrences.at(-1).start)+ticks(s.occurrences.at(-1).length), 245760);
  const written = source.tempos.map((t: any) => ({ at:ticks(source.bars.find((b: any) => b.id===t.barId).start)+ticks(t.offset), bpm:t.quarterBpm })).sort((a: any,b: any) => a.at-b.at);
  assert.deepEqual(s.performedTempos.map((t: any) => t.quarterBpm), s.occurrences.map((o: any) => { const at=ticks(source.bars.find((b: any) => b.id===o.writtenBarId).start); return written.filter((t: any) => t.at<=at).at(-1).bpm*s.preferences.tempoScale; }));
  const seconds = (tick: number) => { let sum=0; for(let i=0;i<tempos.length;i++){ const t=tempos[i]; if(t.tick>=tick)break; const end=Math.min(tick,tempos[i+1]?.tick??tick); sum+=(end-t.tick)*t.micros/960000000; } return sum; };
  return { notes, keys, tempos, seconds, lastOff:Math.max(...notes.map((n: any) => n.end)) };
}
function inspectMidi(bytes: Uint8Array, s: any) {
  const e=expected(s), m=parseMidi(bytes); assert.equal(m.header.format,1); assert.equal(m.header.ticksPerBeat,960); assert.equal(m.tracks.length,4);
  const keys: string[]=[], tempos: any[]=[], ends: number[]=[], programs: any[]=[], velocities=new Set();
  for(const [index,track] of m.tracks.entries()) {
    let tick=0; const active=new Map<string,number>();
    for(const ev of track) { tick+=ev.deltaTime;
      if(ev.type==='setTempo')tempos.push({tick,micros:ev.microsecondsPerBeat});
      if(ev.type==='programChange'){programs.push({channel:ev.channel,program:ev.programNumber});assert.equal(ev.channel,index-1);assert.equal(ev.programNumber,24);}
      if(ev.type==='noteOn'||ev.type==='noteOff') { assert.equal(ev.channel,index-1); const k=`${ev.channel}/${ev.noteNumber}`;
        if(ev.type==='noteOn'&&ev.velocity>0){assert(!active.has(k));active.set(k,tick);velocities.add(ev.velocity);}
        else {assert(active.has(k));keys.push(`${roles[ev.channel]}/${ev.noteNumber}/${active.get(k)}/${tick}`);active.delete(k);}
      }
    }
    assert.equal(active.size,0);assert.equal(track.at(-1).type,'endOfTrack');assert.equal(tick,245760);ends.push(tick);
  }
  assert.deepEqual(keys.sort(),e.keys,'exact complete canonical role/pitch/on/off union');assert.deepEqual(tempos,e.tempos);assert.equal(programs.length,3);
  const tone=new Midi(bytes);assert.deepEqual(tone.tracks.flatMap((t: any)=>t.notes.map((n: any)=>`${t.name}/${n.midi}/${n.ticks}/${n.ticks+n.durationTicks}`)).sort(),e.keys);assert(Math.abs(tone.duration-e.seconds(e.lastOff))<1e-7);
  const roleCounts=Object.fromEntries(roles.map(role=>[role,e.notes.filter((n: any)=>n.role===role).length]));
  assert.deepEqual(roleCounts,expectedRoleCounts);assert.equal(keys.length,Object.values(expectedRoleCounts).reduce((sum:number,n)=>sum+Number(n),0));assert.equal(tempos.length,64);
  return {attacks:keys.length,roleCounts,tempoEntries:tempos.length,tempoChanges:tempos.filter((t: any,i: number)=>i===0||t.micros!==tempos[i-1].micros),lastNoteOffTick:e.lastOff,allTrackEnds:ends,secondsToLastNoteOff:tone.duration,velocities:[...velocities],balancedPairs:true,twoParserUnion:true};
}
type Matrix=[number,number,number,number,number,number];type Line={x:number;y:number;w:number};
const mul=(a:Matrix,b:number[]):Matrix=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
function horizontal(ops:any){let m:Matrix=[1,0,0,1,0,0];const stack:Matrix[]=[],lines:Line[]=[];for(const[i,fn]of ops.fnArray.entries()){const a=ops.argsArray[i];if(fn===OPS.save)stack.push(m);else if(fn===OPS.restore){assert(stack.length);m=stack.pop()!;}else if(fn===OPS.transform)m=mul(m,a);else if(fn===OPS.constructPath&&a[0]===OPS.fill&&a[2]){const[x1,y1,x2,y2]=a[2];const cs=[[x1,y1],[x1,y2],[x2,y1],[x2,y2]].map(([x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]]),xs=cs.map(p=>p[0]),ys=cs.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;if(w>20&&h>0.1&&h<2)lines.push({x,y:y+h/2,w});}}return lines;}
function groups(lines:Line[],count:number,gap:number){const ys=lines.map(l=>l.y).sort((a,b)=>a-b).filter((y,i,a)=>i===0||y-a[i-1]>0.15),has=(y:number)=>ys.some(z=>Math.abs(y-z)<0.15);return ys.filter(y=>!has(y-gap)&&Array.from({length:count},(_,i)=>has(y+i*gap)).every(Boolean)).map(bottom=>({bottom,top:bottom+(count-1)*gap,gap})).sort((a,b)=>b.top-a.top);}
function textRuns(ops:any){let m:Matrix=[1,0,0,1,0,0],tm:Matrix=[1,0,0,1,0,0],fontSize=0;const stack:Matrix[]=[],runs:any[]=[];for(const[i,fn]of ops.fnArray.entries()){const a=ops.argsArray[i];if(fn===OPS.save)stack.push(m);else if(fn===OPS.restore)m=stack.pop()!;else if(fn===OPS.transform)m=mul(m,a);else if(fn===OPS.beginText)tm=[1,0,0,1,0,0];else if(fn===OPS.setFont)fontSize=a[1];else if(fn===OPS.setTextMatrix)tm=Array.from(a.length===1?a[0]:a)as Matrix;else if(fn===OPS.moveText)tm=mul(tm,[1,0,0,1,a[0],a[1]]);else if(fn===OPS.showText){const mt=mul(m,tm),str=a[0].filter((g:any)=>typeof g==='object'&&g.unicode).map((g:any)=>g.unicode).join('');runs.push({str,x:mt[4],y:mt[5],height:Math.hypot(mt[2],mt[3])*fontSize});}}return runs;}
function notationFor(s:any,indices:number[]){return indices.flatMap(index=>{const o=s.occurrences[index],bar=s.bars.find((b:any)=>b.id===o.writtenBarId);return s.notation.filter((n:any)=>n.kind==='note'&&n.barId===bar.id).map((n:any)=>{const sound=s.sounds.find((x:any)=>x.id===n.eventId),p=s.performedSounds.find((p:any)=>p.soundId===sound.id&&p.occurrenceIds.includes(o.id));assert(p);const pl=s.placements.find((p2:any)=>p2.id===p.placementId),tie=ticks(o.start)+ticks(n.start)-ticks(bar.start)>ticks(p.start);return{role:sound.role,at:ticks(o.start)+ticks(n.start)-ticks(bar.start),string:pl.stringIndex,fret:pl.fret,diatonic:(sound.spelling.octave+1)*7+({C:0,D:1,E:2,F:3,G:4,A:5,B:6}[sound.spelling.step]),tie,tabVisible:!tie||ticks(n.start)===ticks(bar.start)};});});}
async function inspectPdf(bytes:Uint8Array,s:any,path:string,raster=true){
  assert.equal(new TextDecoder().decode(bytes.slice(0,5)),'%PDF-');await mkdir(path,{recursive:true});
  const task=getDocument({data:new Uint8Array(bytes),fontExtraProperties:true,useSystemFonts:true,standardFontDataUrl:new URL('../../node_modules/pdfjs-dist/standard_fonts/',import.meta.url).pathname});const pages:any[]=[];
  try{const pdf=await task.promise;
    for(let number=1;number<=pdf.numPages;number++){
      const page=await pdf.getPage(number),content=await page.getTextContent(),ops=await page.getOperatorList(),text=content.items.filter((i:any)=>'str'in i).map((i:any)=>i.str).join(' ');
      assert(text.includes('unreviewed-draft'));assert(text.includes(`Capo ${s.instrument.capo}`));assert(text.includes(s.revision.digest));
      const systems=[...text.matchAll(/SYSTEM(\d+)/g)].map(m=>Number(m[1])),labels=[...text.matchAll(/\bo(\d+)\/S(\d+)\/P(\d+)\b/g)].map(m=>({occurrence:Number(m[1]),writtenBar:Number(m[2]),pass:Number(m[3])}));
      assert.equal([...text].filter(c=>c==='\ue050').length,systems.length);assert.equal([...text].filter(c=>c==='\ue06d').length,systems.length);
      const fontIds=[...new Set(ops.fnArray.flatMap((fn:any,i:number)=>fn===OPS.setFont?[ops.argsArray[i][0]]:[]))],fonts=fontIds.map((id:any)=>{const f=page.commonObjs.get(id);return{name:f.name,bytes:f.data?.length??0};});assert(fonts.some(f=>f.name?.includes('Bravura')&&f.bytes>1000));
      const runs=textRuns(ops),base=page.getViewport({scale:1}),view=page.getViewport({scale:1.5}),canvas=createCanvas(Math.ceil(view.width),Math.ceil(view.height)),ctx=canvas.getContext('2d');await page.render({canvas:null,canvasContext:ctx,viewport:view,background:'white'}).promise;
      if(raster)await writeFile(`${path}/page-${String(number).padStart(2,'0')}.png`,canvas.toBuffer('image/png'));
      const scale=(base.width-56)/750,lines=horizontal(ops),staff=groups(lines.filter(l=>l.w>100),5,9*scale),tab=groups(lines,6,13*scale);assert.equal(staff.length,systems.length);assert.equal(tab.length,systems.length);
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let minimumCoverage=1;
      for(const[gs,count]of[[staff,5],[tab,6]]as const)for(const g of gs)for(let i=0;i<count;i++){const y=g.bottom+i*g.gap,seg=lines.filter(l=>Math.abs(l.y-y)<0.15).sort((a,b)=>b.w-a.w)[0];assert(seg);assert(y>30&&y<base.height-30);assert(seg.x>=27&&seg.x+seg.w<=base.width-27);let hits=0;for(let j=1;j<=30;j++){const px=Math.round((seg.x+seg.w*j/31)*1.5),py=Math.round((base.height-y)*1.5);let ink=false;for(let dy=-2;dy<=2;dy++){const k=((py+dy)*canvas.width+px)*4;if(pixels[k]<220||pixels[k+1]<220||pixels[k+2]<220)ink=true;}if(ink)hits++;}minimumCoverage=Math.min(minimumCoverage,hits/30);assert(hits>=20);}
      const evidence:any[]=[];
      for(const[local,system]of systems.entries()){
        const indices=[(system-1)*2,(system-1)*2+1],ns=notationFor(s,indices),g=tab[local],digits=runs.filter((i:any)=>/^\(?\d{1,2}\)?$/.test(i.str)&&i.y>=g.bottom-5*scale&&i.y<=g.top+scale),expectedTab=ns.filter((n:any)=>n.tabVisible);
        assert.equal(digits.length,expectedTab.length,`PDF TAB count system ${system}`);const actual=Array.from({length:6},()=>[]as any[]);
        for(const digit of digits){const string=Math.round((digit.y+3.661*scale-g.bottom)/(13*scale));assert(string>=0&&string<6);assert(Math.abs(digit.y-(g.bottom+string*13*scale-3.661*scale))<0.2);const tie=digit.str.startsWith('(')||runs.some((p:any)=>p.str==='('&&Math.abs(p.y-digit.y)<0.2&&p.x<digit.x&&digit.x-p.x<8*scale);actual[string].push({x:digit.x,fret:Number(digit.str.replace(/[()]/g,'')),tie});}
        const fretExpected=Array.from({length:6},(_,string)=>expectedTab.filter((n:any)=>n.string===string).sort((a:any,b:any)=>a.at-b.at).map((n:any)=>({fret:n.fret,tie:n.tie})));
        assert.deepEqual(actual.map(notes=>notes.sort((a,b)=>a.x-b.x).map(({fret,tie})=>({fret,tie}))),fretExpected,`PDF canonical fret/tie sequences system ${system}`);
        const heads=runs.filter((i:any)=>/[\ue0a2-\ue0a4]/u.test(i.str)&&i.y>=staff[local].bottom-100*scale&&i.y<=staff[local].top+100*scale),steps=heads.flatMap((i:any)=>[...i.str].filter(c=>/[\ue0a2-\ue0a4]/u.test(c)).map(()=>{assert(Math.abs(i.height-34*scale)<0.02);const step=38+Math.round((i.y-staff[local].top)/(4.5*scale));assert(Math.abs(i.y-(staff[local].top+(step-38)*4.5*scale))<0.2);return step;})).sort((a:number,b:number)=>a-b);
        assert.deepEqual(steps,ns.map((n:any)=>n.diatonic).sort((a:number,b:number)=>a-b),`PDF canonical written staff positions system ${system}`);
        evidence.push({system,occurrenceIndices:indices,notePlacements:ns.length,printedTabPlacements:expectedTab.length,actualTabAndStaffEqualCanonical:true});
      }
      pages.push({number,width:base.width,height:base.height,systems,labels,embeddedBravura:true,minimumRasterLineCoverage:minimumCoverage,musicPlacements:evidence,text});
    }
    assert.deepEqual(pages.flatMap(p=>p.systems),Array.from({length:32},(_,i)=>i+1));assert.deepEqual(pages.flatMap(p=>p.labels),s.occurrences.map((o:any,i:number)=>({occurrence:i+1,writtenBar:writtenForm[i],pass:o.pass})));
    const captions=pages.flatMap(p=>[...p.text.matchAll(/=\s*(\d+(?:\.\d+)?)/g)].map(m=>Number(m[1])));assert.deepEqual(captions,s.performedTempos.map((t:any)=>t.quarterBpm));
    return {pageCount:pages.length,systemCount:32,occurrenceCount:64,notePlacements:pages.flatMap(p=>p.musicPlacements).reduce((sum,m)=>sum+m.notePlacements,0),captionCount:captions.length,pages:pages.map(({text,...p})=>p),reviewRasters:[1,Math.ceil(pages.length/2),pages.length].map(p=>`${path}/page-${String(p).padStart(2,'0')}.png`)};
  }finally{await task.destroy();}
}
assert.equal(manifest.status,'unreviewed-draft');assert.deepEqual(manifest.agent,{model:receipt.model,taskId:receipt.taskId});assert.equal(score.planner.mode,'configured-llm');
for(const k of ['model','provider','callId','calledAt','responseDigest'])assert.equal(score.planner[k],receipt[k]);
assert.deepEqual(score.plan,await json(`${run}/plan.json`));assert.equal(hash(await readFile(`${run}/plan.json`)),receipt.responseDigest);
const integrity:any={};for(const key of ['score','pdf','midi','notes']){const b=await readFile(`${dir}/${manifest.files[key]}`);assert.equal(hash(b),manifest.integrity[key]);integrity[key]={sha256:hash(b),bytes:b.length};}
integrity.manifest={sha256:hash(await readFile(`${dir}/manifest.json`)),bytes:(await readFile(`${dir}/manifest.json`)).length};
// Artifact mappings count unfolded notation (including rests), not written segments.
const performedSegments=score.occurrences.reduce((sum:number,o:any)=>sum+score.notation.filter((n:any)=>n.barId===o.writtenBarId).length,0);
for(const format of ['pdf','midi']){const a=manifest.artifacts[format],b=await readFile(`${dir}/${manifest.files[format]}`);assert.equal(a.artifactDigest,hash(b));assert.equal(a.byteLength,b.length);assert.deepEqual(a.scoreRevision,manifest.revision);assert.deepEqual(a.sourceRevision,{id:source.revision.id,digest:source.revision.digest});assert.equal(a.occurrenceCount,score.occurrences.length);assert.equal(a.soundingAttackCount,score.performedSounds.length);assert.equal(a.notationSegmentCount,performedSegments);assert.equal(a.validationVersion,'independent-guitar-validator-2-role-order-v1');assert.equal(a.adapter.version,'canonical-guitar-1.0.1');assert.equal(a.review,'unreviewed-draft');}
const midi=new Uint8Array(await readFile(`${dir}/arrangement.mid`)),pdf=new Uint8Array(await readFile(`${dir}/arrangement.pdf`));
const result:any={status:'VERIFIED',createdAt:new Date().toISOString(),id:publication.id,integrity,midi:inspectMidi(midi,score),pdf:await inspectPdf(pdf,score,`${out}/rasters`),negativeControls:[]};
const wrong=parseMidi(midi),on=wrong.tracks[1].find((e:any)=>e.type==='noteOn'&&e.velocity>0),pitch=on.noteNumber;on.noteNumber+=1;const off=wrong.tracks[1].find((e:any)=>e.type==='noteOff'&&e.noteNumber===pitch);assert(off);off.noteNumber+=1;
assert.throws(()=>inspectMidi(new Uint8Array(writeMidi(wrong)),score),/exact complete canonical role\/pitch\/on\/off union/);result.negativeControls.push('structurally-valid paired MIDI pitch corruption rejected');
const wrongScore=structuredClone(score);wrongScore.placements.find((p:any)=>p.soundId==='m1').fret+=1;
await assert.rejects(()=>inspectPdf(pdf,wrongScore,`${out}/negative-pdf`,false),/PDF canonical fret\/tie sequences system 1/);result.negativeControls.push('unchanged PDF with wrong canonical expected fret rejected');
if(process.env.VERIFY_ORIGIN){
  const origin=process.env.VERIFY_ORIGIN;assert.equal(new URL(publication.links.viewer).origin,origin);result.http=[];
  for(const [url,mime,file] of [[`${origin}/`,'text/html',null],[publication.links.viewer,'text/html',null],...[['manifest.json','application/json'],['score.json','application/json'],['notes.md','text/plain'],['arrangement.pdf','application/pdf'],['arrangement.mid','audio/midi']].map(([f,m])=>[`${publication.links.viewer}/${f}`,m,f])] as const){
    const response=await fetch(url),body=new Uint8Array(await response.arrayBuffer());assert.equal(response.status,200);assert(response.headers.get('content-type')?.startsWith(mime));
    const head=await fetch(url,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('content-type'),response.headers.get('content-type'));assert.equal((await head.arrayBuffer()).byteLength,0);
    if(file){if(file==='manifest.json')assert.deepEqual(JSON.parse(new TextDecoder().decode(body)),manifest);else assert.deepEqual(body,new Uint8Array(await readFile(`${dir}/${file}`)));assert.equal(Number(response.headers.get('content-length')),body.length);assert.equal(head.headers.get('content-length'),response.headers.get('content-length'));assert(response.headers.get('cache-control')?.includes('immutable'));assert(response.headers.get('etag'));}
    if(file==='arrangement.pdf'||file==='arrangement.mid')assert(response.headers.get('content-disposition')?.includes('attachment'));
    result.http.push({url,status:response.status,mime:response.headers.get('content-type'),bytes:body.length,sha256:hash(body),headAgrees:true,persistedBytesEqual:!!file&&file!=='manifest.json',manifestSemanticEqual:file==='manifest.json'});
  }
  const library=await fetch(`${origin}/api/arrangements`);assert.equal(library.status,200);const data=await library.json();assert.equal(data.unavailableCount,0);assert.deepEqual(data.arrangements.find((a:any)=>a.manifest.id===publication.id).manifest,manifest);result.library={id:publication.id,status:200,exactManifest:true,count:data.arrangements.length};
  assert.equal((await fetch(`${publication.links.viewer}/missing.json`)).status,404);assert.equal((await fetch(`${origin}/api/arrangements`,{method:'POST'})).status,405);
}
await writeFile(`${out}/artifact-verification.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,id:result.id,integrity,midi:result.midi,pdf:{...result.pdf,pages:undefined},http:result.http,library:result.library,negativeControls:result.negativeControls},null,2));
