// Actual-byte acceptance oracle. No adapter/exporter/engine/form implementation imports.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const work = '/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-cf255def';
const require = createRequire(`${work}/package.json`);
const { parseMidi } = require('midi-file');
const { Midi } = require('@tonejs/midi');
const { createCanvas } = require('@napi-rs/canvas');
const { getDocument, OPS } = await import(require.resolve('pdfjs-dist/legacy/build/pdf.mjs'));
const root = '/tmp/opencode/guitar-live-exports';
const source = JSON.parse(await readFile('/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-7364a0c1/tests/source/.local/live/source.json','utf8'));
const generation = JSON.parse(await readFile(`${root}/generation.json`, 'utf8'));
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const roles = ['melody', 'bass', 'harmony'];
const ticks = (r: any) => { const n=BigInt(r.n)*960n,d=BigInt(r.d);assert.equal(n%d,0n,'No expected tick rounding permitted');return Number(n/d); };
const writtenForm=[1,2,3,4,5,6,7,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,43,44,45,46,43,44,45,46,43,44,45,46];
function expected(score:any){
  const sounds=new Map(score.sounds.map((s:any)=>[s.id,s]));
  const notes=score.performedSounds.map((p:any)=>{const s:any=sounds.get(p.soundId);assert(s);return{id:p.id,soundId:s.id,role:s.role,pitch:s.soundingMidi,start:ticks(p.start),end:ticks(p.start)+ticks(p.duration)};});
  const keys=notes.map((n:any)=>`${n.role}/${n.pitch}/${n.start}/${n.end}`).sort();
  const tempos=score.performedTempos.map((t:any)=>({tick:ticks(t.start),micros:Math.floor(60000000/t.quarterBpm)}));
  const numbers=score.occurrences.map((o:any)=>source.bars.find((b:any)=>b.id===o.writtenBarId).number);assert.deepEqual(numbers,writtenForm,'literal complete requested-song form');
  assert.equal(ticks(score.occurrences.at(-1).start)+ticks(score.occurrences.at(-1).length),245760);
  // Independently derive each entry from written source position; never trust candidate's tempo claim.
  const written=source.tempos.map((t:any)=>({id:t.id,at:ticks(source.bars.find((b:any)=>b.id===t.barId).start)+ticks(t.offset),bpm:t.quarterBpm})).sort((a:any,b:any)=>a.at-b.at);
  assert.deepEqual(score.performedTempos.map((t:any)=>t.quarterBpm),score.occurrences.map((o:any)=>{const at=ticks(source.bars.find((b:any)=>b.id===o.writtenBarId).start);return written.filter((t:any)=>t.at<=at).at(-1).bpm*score.preferences.tempoScale;}));
  const seconds=(tick:number)=>{let sum=0;for(let i=0;i<tempos.length;i++){const t=tempos[i];if(t.tick>=tick)break;const end=Math.min(tick,tempos[i+1]?.tick??tick);sum+=(end-t.tick)*t.micros/960000000;}return sum;};
  return{notes,keys,tempos,seconds,lastOff:Math.max(...notes.map((n:any)=>n.end))};
}
function inspectMidi(bytes:Uint8Array,score:any){
  const e=expected(score),m=parseMidi(bytes);assert.equal(m.header.format,1);assert.equal(m.header.ticksPerBeat,960);assert.equal(m.tracks.length,4);
  const keys:string[]=[],tempos:any[]=[],ends:number[]=[],programs:any[]=[];
  for(const [index,track] of m.tracks.entries()){
    let tick=0;const active=new Map<string,number>();
    for(const event of track){tick+=event.deltaTime;if(event.type==='setTempo')tempos.push({tick,micros:event.microsecondsPerBeat});if(event.type==='programChange'){programs.push({channel:event.channel,program:event.programNumber});assert.equal(event.channel,index-1);assert.equal(event.programNumber,24);}
      if(event.type==='noteOn'||event.type==='noteOff'){assert.equal(event.channel,index-1);const key=`${event.channel}/${event.noteNumber}`;if(event.type==='noteOn'&&event.velocity>0){assert(!active.has(key),'duplicate/unison on');active.set(key,tick);}else{assert(active.has(key),'unmatched off');keys.push(`${roles[event.channel]}/${event.noteNumber}/${active.get(key)}/${tick}`);active.delete(key);}}
    }assert.equal(active.size,0,'unbalanced note pair');assert.equal(track.at(-1).type,'endOfTrack');assert.equal(tick,245760);ends.push(tick);
  }
  assert.deepEqual(keys.sort(),e.keys,'exact complete canonical role/pitch/on/off union');assert.deepEqual(tempos,e.tempos,'all exact effective tempos');assert.equal(programs.length,3);
  const tone=new Midi(bytes),toneKeys=tone.tracks.flatMap((t:any)=>t.notes.map((n:any)=>`${t.name}/${n.midi}/${n.ticks}/${n.ticks+n.durationTicks}`)).sort();assert.deepEqual(toneKeys,e.keys,'second independent parser union');assert(Math.abs(tone.duration-e.seconds(e.lastOff))<1e-7);
  const roleCounts=Object.fromEntries(roles.map(role=>[role,e.notes.filter((n:any)=>n.role===role).length]));
  return{attacks:keys.length,roleCounts,tempoEntries:tempos.length,tempoChanges:tempos.filter((t:any,i:number)=>i===0||t.micros!==tempos[i-1].micros),lastNoteOffTick:e.lastOff,allTrackEnds:ends,secondsToLastNoteOff:tone.duration,secondsToPerformanceEnd:e.seconds(245760),balancedPairs:true,twoParserUnion:true};
}
type Matrix=[number,number,number,number,number,number];type Line={x:number;y:number;w:number};
const mul=(a:Matrix,b:number[]):Matrix=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
function horizontal(ops:any){let m:Matrix=[1,0,0,1,0,0];const stack:Matrix[]=[],lines:Line[]=[];for(const[i,fn]of ops.fnArray.entries()){const args=ops.argsArray[i];if(fn===OPS.save)stack.push(m);else if(fn===OPS.restore){assert(stack.length);m=stack.pop()!;}else if(fn===OPS.transform)m=mul(m,args);else if(fn===OPS.constructPath&&args[0]===OPS.fill&&args[2]){const[x1,y1,x2,y2]=args[2];const corners=[[x1,y1],[x1,y2],[x2,y1],[x2,y2]].map(([x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]]),xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;if(w>20&&h>0.1&&h<2)lines.push({x,y:y+h/2,w});}}return lines;}
function groups(lines:Line[],count:number,gap:number){const ys=lines.map(l=>l.y).sort((a,b)=>a-b).filter((y,i,a)=>i===0||y-a[i-1]>0.15);const has=(y:number)=>ys.some(z=>Math.abs(y-z)<0.15);return ys.filter(y=>!has(y-gap)&&Array.from({length:count},(_,i)=>has(y+i*gap)).every(Boolean)).map(bottom=>({bottom,top:bottom+(count-1)*gap,gap})).sort((a,b)=>b.top-a.top);}
// PDF.js getTextContent can merge nearby notes at DIFFERENT staff heights into one text item.
// Inspect each actual showText run with its own CTM/text matrix instead of reusing a merged baseline.
function textRuns(ops:any){let m:Matrix=[1,0,0,1,0,0],tm:Matrix=[1,0,0,1,0,0],fontSize=0;const stack:Matrix[]=[],runs:any[]=[];for(const[i,fn]of ops.fnArray.entries()){const a=ops.argsArray[i];if(fn===OPS.save)stack.push(m);else if(fn===OPS.restore)m=stack.pop()!;else if(fn===OPS.transform)m=mul(m,a);else if(fn===OPS.beginText)tm=[1,0,0,1,0,0];else if(fn===OPS.setFont)fontSize=a[1];else if(fn===OPS.setTextMatrix)tm=Array.from(a.length===1?a[0]:a)as Matrix;else if(fn===OPS.moveText)tm=mul(tm,[1,0,0,1,a[0],a[1]]);else if(fn===OPS.showText){const matrix=mul(m,tm);const str=a[0].filter((g:any)=>typeof g==='object'&&g.unicode).map((g:any)=>g.unicode).join('');runs.push({str,x:matrix[4],y:matrix[5],height:Math.hypot(matrix[2],matrix[3])*fontSize});}}return runs;}
function notationFor(score:any,indices:number[]){return indices.flatMap(index=>{const o=score.occurrences[index],bar=score.bars.find((b:any)=>b.id===o.writtenBarId);return score.notation.filter((n:any)=>n.kind==='note'&&n.barId===bar.id).map((n:any)=>{const s=score.sounds.find((s:any)=>s.id===n.eventId);const p=score.performedSounds.find((p:any)=>p.soundId===s.id&&p.occurrenceIds.includes(o.id));assert(p);const placement=score.placements.find((pl:any)=>pl.id===p.placementId),tie=ticks(o.start)+ticks(n.start)-ticks(bar.start)>ticks(p.start);return{segmentId:n.id,eventId:s.id,role:s.role,occurrenceId:o.id,at:ticks(o.start)+ticks(n.start)-ticks(bar.start),string:placement.stringIndex,fret:placement.fret,pitch:s.soundingMidi,diatonic:(s.spelling.octave+1)*7+({C:0,D:1,E:2,F:3,G:4,A:5,B:6}[s.spelling.step]),tie,tabVisible:!tie||ticks(n.start)===ticks(bar.start)};});});}
async function inspectPdf(bytes:Uint8Array,score:any,dir:string){
  assert.equal(new TextDecoder().decode(bytes.slice(0,5)),'%PDF-');await mkdir(dir,{recursive:true});
  const task=getDocument({data:new Uint8Array(bytes),fontExtraProperties:true,useSystemFonts:true,standardFontDataUrl:`${work}/node_modules/pdfjs-dist/standard_fonts/`});const pages:any[]=[];
  try{const pdf=await task.promise;
    for(let number=1;number<=pdf.numPages;number++){
      const page=await pdf.getPage(number),content=await page.getTextContent(),ops=await page.getOperatorList(),items=content.items.filter((i:any)=>'str'in i),text=items.map((i:any)=>i.str).join(' ');
      assert(text.includes('unreviewed-draft'));assert(text.includes(`Capo ${score.instrument.capo}`));assert(text.includes(score.revision.digest),'PDF binds exact revision digest');
      const systems=[...text.matchAll(/SYSTEM(\d+)/g)].map(m=>Number(m[1]));
      const labels=[...text.matchAll(/\bo(\d+)\/S(\d+)\/P(\d+)\b/g)].map(m=>({occurrence:Number(m[1]),writtenBar:Number(m[2]),pass:Number(m[3])}));
      assert.equal([...text].filter(c=>c==='\ue050').length,systems.length,'treble clefs');assert.equal([...text].filter(c=>c==='\ue06d').length,systems.length,'TAB clefs');
      const fontIds=[...new Set(ops.fnArray.flatMap((fn:any,i:number)=>fn===OPS.setFont?[ops.argsArray[i][0]]:[]))];const fonts=fontIds.map((id:any)=>{const f=page.commonObjs.get(id);return{name:f.name,bytes:f.data?.length??0};});assert(fonts.some(f=>f.name?.includes('Bravura')&&f.bytes>1000),'embedded music font');
      const runs=textRuns(ops),base=page.getViewport({scale:1}),view=page.getViewport({scale:1.5}),canvas=createCanvas(Math.ceil(view.width),Math.ceil(view.height)),ctx=canvas.getContext('2d');await page.render({canvas:null,canvasContext:ctx,viewport:view,background:'white'}).promise;
      await writeFile(`${dir}/page-${String(number).padStart(2,'0')}.png`,canvas.toBuffer('image/png'));
      // Ledger lines can exceed 20pt at Letter scale. Staff groups require long actual staff lines;
      // TAB still permits short line fragments interrupted by fret digits.
      const scale=(base.width-56)/750,lines=horizontal(ops),staff=groups(lines.filter(l=>l.w>100),5,9*scale),tab=groups(lines,6,13*scale);assert.equal(staff.length,systems.length,'staff groups');assert.equal(tab.length,systems.length,'TAB groups');
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let minimumCoverage=1;
      for(const[gs,count]of[[staff,5],[tab,6]]as const)for(const g of gs)for(let i=0;i<count;i++){const y=g.bottom+i*g.gap;const seg=lines.filter(l=>Math.abs(l.y-y)<0.15).sort((a,b)=>b.w-a.w)[0];assert(seg);assert(y>30&&y<base.height-30,'vertical print bounds');assert(seg.x>=27&&seg.x+seg.w<=base.width-27,'horizontal print bounds');let hits=0;for(let j=1;j<=30;j++){const px=Math.round((seg.x+seg.w*j/31)*1.5),py=Math.round((base.height-y)*1.5);let ink=false;for(let dy=-2;dy<=2;dy++){const k=((py+dy)*canvas.width+px)*4;if(pixels[k]<220||pixels[k+1]<220||pixels[k+2]<220)ink=true;}if(ink)hits++;}minimumCoverage=Math.min(minimumCoverage,hits/30);assert(hits>=20,'clipped/invisible staff or TAB raster');}
      const evidence:any[]=[];
      for(const[local,system]of systems.entries()){
        const indices=[(system-1)*2,(system-1)*2+1];const expectedNotes=notationFor(score,indices),g=tab[local];
        const digits=runs.filter((i:any)=>/^\(?\d{1,2}\)?$/.test(i.str)&&i.y>=g.bottom-5*scale&&i.y<=g.top+scale);
        // alphaTab convention: same-bar tied continuations keep staff heads/ties but omit redundant TAB digits;
        // bar-entry tied continuations print a parenthesized fret. Check both independently.
        const expectedTab=expectedNotes.filter((n:any)=>n.tabVisible);
        if(digits.length!==expectedTab.length)await writeFile(`${dir}/tab-debug.json`,JSON.stringify({system,tab:g,scale,expectedNotes,runs:runs.filter((i:any)=>i.y>=g.bottom-5*scale&&i.y<=g.top+scale),items:items.filter((i:any)=>i.transform[5]>=g.bottom-5*scale&&i.transform[5]<=g.top+scale)},null,2));
        assert.equal(digits.length,expectedTab.length,`PDF actual TAB placement count system ${system}`);
        const actual=Array.from({length:6},()=>[]as any[]);
        for(const digit of digits){const string=Math.round((digit.y+3.661*scale-g.bottom)/(13*scale));assert(string>=0&&string<6);assert(Math.abs(digit.y-(g.bottom+string*13*scale-3.661*scale))<0.2,'TAB string alignment');const tie=digit.str.startsWith('(')||runs.some((p:any)=>p.str==='('&&Math.abs(p.y-digit.y)<0.2&&p.x<digit.x&&digit.x-p.x<8*scale);actual[string].push({x:digit.x,fret:Number(digit.str.replace(/[()]/g,'')),tie});}
        const fretExpected=Array.from({length:6},(_,string)=>expectedTab.filter((n:any)=>n.string===string).sort((a:any,b:any)=>a.at-b.at).map((n:any)=>({fret:n.fret,tie:n.tie})));
        assert.deepEqual(actual.map(notes=>notes.sort((a,b)=>a.x-b.x).map(({fret,tie})=>({fret,tie}))),fretExpected,`all actual canonical fret/tie sequences system ${system}`);
        // Independently reconstruct every staff note's displayed diatonic position (including the guitar octave).
        const heads=runs.filter((i:any)=>/[\ue0a2-\ue0a4]/u.test(i.str)&&i.y>=staff[local].bottom-100*scale&&i.y<=staff[local].top+100*scale);
        const actualSteps=heads.flatMap((i:any)=>[...i.str].filter(c=>/[\ue0a2-\ue0a4]/u.test(c)).map(()=>{assert(Math.abs(i.height-34*scale)<0.02);const step=38+Math.round((i.y-staff[local].top)/(4.5*scale));assert(Math.abs(i.y-(staff[local].top+(step-38)*4.5*scale))<0.2,'staff head grid alignment');return step;})).sort((a:number,b:number)=>a-b);
        if(JSON.stringify(actualSteps)!==JSON.stringify(expectedNotes.map((n:any)=>n.diatonic).sort((a:number,b:number)=>a-b)))await writeFile(`${dir}/staff-debug.json`,JSON.stringify({system,staff:staff[local],scale,actualSteps,expectedNotes,heads,digits},null,2));
        assert.deepEqual(actualSteps,expectedNotes.map((n:any)=>n.diatonic).sort((a:number,b:number)=>a-b),`all actual guitar written staff positions system ${system}`);
        evidence.push({system,occurrenceIndices:indices,notePlacements:expectedNotes.length,printedTabPlacements:expectedTab.length,intraBarTiedTabDigitsOmitted:expectedNotes.length-expectedTab.length,tiedDestinations:expectedNotes.filter((n:any)=>n.tie).length,actualTabAndStaffEqualCanonical:true});
      }
      pages.push({number,width:base.width,height:base.height,systems,labels,embeddedBravura:true,minimumRasterLineCoverage:minimumCoverage,musicPlacements:evidence});
    }
    assert.deepEqual(pages.flatMap(p=>p.systems),Array.from({length:32},(_,i)=>i+1),'all complete systems');
    assert.deepEqual(pages.flatMap(p=>p.labels),score.occurrences.map((o:any,i:number)=>({occurrence:i+1,writtenBar:writtenForm[i],pass:o.pass})),'all original-bar/pass labels including last');
    const allText=await Promise.all(Array.from({length:pdf.numPages},async(_,i)=>{const c=await(await pdf.getPage(i+1)).getTextContent();return c.items.filter((x:any)=>'str'in x).map((x:any)=>x.str).join(' ');}));const captions=allText.flatMap(t=>[...t.matchAll(/=\s*(\d+(?:\.\d+)?)/g)].map(m=>Number(m[1])));assert.deepEqual(captions,score.performedTempos.map((t:any)=>t.quarterBpm),'all native PDF effective tempo captions');
    return{pageCount:pages.length,systemCount:32,occurrenceCount:64,notePlacements:pages.flatMap(p=>p.musicPlacements).reduce((s,m)=>s+m.notePlacements,0),minimumRasterLineCoverage:Math.min(...pages.map(p=>p.minimumRasterLineCoverage)),captionCount:captions.length,pages,reviewRasters:[1,Math.ceil(pages.length/2),pages.length].map(page=>`${dir}/page-${String(page).padStart(2,'0')}.png`)};
  }finally{await task.destroy();}
}
const results:any[]=[];let failed:any;
try{
  for(const variant of ['2','0','recommend']){
    const score=JSON.parse(await readFile(`/tmp/opencode/engine-live-${variant}.json`,'utf8'));const entry=generation.candidates.find((c:any)=>c.variant===variant);
    for(const artifact of entry.exports.filter((e:any)=>e.status==='generated')){
      const bytes=new Uint8Array(await readFile(artifact.artifactPath));assert.equal(hash(bytes),artifact.manifest.artifactDigest);assert.equal(bytes.byteLength,artifact.manifest.byteLength);assert.equal(artifact.manifest.scoreRevision.digest,score.revision.digest);assert.equal(artifact.manifest.sourceRevision.digest,source.revision.digest);assert.equal(artifact.manifest.validationVersion,'independent-guitar-validator-1');
      const letter=artifact.pageSize==='LETTER',result=artifact.format==='midi'?inspectMidi(bytes,score):await inspectPdf(bytes,score,`${root}/capo-${variant}/${letter?'letter-rasters':'rasters'}`);
      results.push({variant,format:artifact.format,...(artifact.pageSize?{pageSize:artifact.pageSize}:{}),path:artifact.artifactPath,...result});await writeFile(`${root}/capo-${variant}/${artifact.format}${letter?'-letter':''}-inspection.json`,JSON.stringify(result,null,2));
    }
  }
  const a=expected(JSON.parse(await readFile('/tmp/opencode/engine-live-0.json','utf8'))),b=expected(JSON.parse(await readFile('/tmp/opencode/engine-live-2.json','utf8')));assert.deepEqual(a.keys.filter(k=>k.startsWith('melody/')),b.keys.filter(k=>k.startsWith('melody/')),'capo preserves complete concert melody');
}catch(cause){failed=cause instanceof Error?{message:cause.message,stack:cause.stack}:String(cause);}
const summary={status:failed?'failed':'passed',adapterCommit:generation.adapterCommit,adapterWorkingDiffSha256:generation.adapterWorkingDiffSha256,createdAt:new Date().toISOString(),expectedForm:writtenForm,results,...(failed?{failure:failed}:{}),claim:'Actual immutable draft artifact fidelity only; no human/subjective/full-release approval'};
await writeFile(`${root}/verification.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));if(failed)process.exitCode=1;
