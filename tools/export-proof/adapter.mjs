// Disposable U02 adapter, not an application schema or persistence format.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { finished } from 'node:stream/promises';
import * as at from '@coderline/alphatab';
import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';

export const title = 'Copper Steps - U02 original study';
export const revision = 'u02-original-24-v1';
const tuning = [64,59,55,50,45,40];
const roles = ['melody','bass','harmony'];
export function engravingRows() {
  return fs.readFileSync(new URL('fixtures/engraving.tsv',import.meta.url),'utf8').trim().split('\n').slice(1).map(line => {
    const [id,source,pass,bpm,...voices] = line.split('\t');
    return {id,source:Number(source),pass:Number(pass),bpm:Number(bpm),voices};
  });
}
export function project(capo, { doubleCapo = false } = {}) {
  assert([0,2].includes(capo));
  const settings = new at.Settings();
  settings.core.engine = 'svg';
  settings.core.enableLazyLoading = false;
  settings.display.barsPerRow = 2;
  settings.display.barCountPerPartial = 1; // Still verify actual bounds: a partial is not assumed to be a system.
  settings.display.justifyLastSystem = true;
  settings.display.resources.secondaryGlyphColor = settings.display.resources.mainGlyphColor;
  const score = new at.model.Score();
  score.title = title;
  score.subTitle = `${revision} | Capo ${capo} | unfolded performance`;
  score.music = 'Original verification fixture (CC0)';
  const track = new at.model.Track();
  track.name = 'Acoustic Guitar';
  track.shortName = 'Gtr.';
  track.playbackInfo.program = 24;
  track.playbackInfo.primaryChannel = 0;
  track.playbackInfo.secondaryChannel = 1;
  score.addTrack(track);
  const staff = new at.model.Staff();
  staff.stringTuning = new at.model.Tuning('Standard EADGBE', tuning, true);
  staff.showStandardNotation = true;
  staff.showTablature = true;
  staff.capo = capo;
  // alphaTab subtracts transpositionPitch; capo is ALREADY added by stringTuning.
  staff.transpositionPitch = doubleCapo ? -capo : 0;
  staff.displayTranspositionPitch = -12; // octave-transposing guitar: written = sounding + 12.
  track.addStaff(staff);
  const placements = [];
  const rows = engravingRows();
  for (const [i,row] of rows.entries()) {
    const master = new at.model.MasterBar();
    master.timeSignatureNumerator = 4;
    master.timeSignatureDenominator = 4;
    if (i===0 || rows[i-1].bpm!==row.bpm) master.tempoAutomations.push(at.model.Automation.buildTempoAutomation(false,0,row.bpm,2,true));
    score.addMasterBar(master);
    const bar = new at.model.Bar();
    staff.addBar(bar);
    for (const [role,column] of row.voices.entries()) {
      const voice = new at.model.Voice();
      bar.addVoice(voice);
      let durationQ = 0;
      for (const [j,token] of column.split(' ').entries()) {
        const [rhythm, fingering] = token.split(':');
        assert(/^(1|2|4|8)(t|\.)?$/.test(rhythm), `unsupported rhythm ${rhythm}`);
        const beat = new at.model.Beat();
        beat.duration = Number(rhythm.match(/^\d+/)[0]);
        beat.dots = rhythm.endsWith('.') ? 1 : 0;
        if (rhythm.endsWith('t')) {beat.tupletNumerator=3;beat.tupletDenominator=2;}
        voice.addBeat(beat);
        if (role===0 && j===0) beat.text = `${i===23?'FINAL ':''}${row.id}/S${String(row.source).padStart(2,'0')}/P${row.pass}`;
        durationQ += (4/beat.duration) * (beat.dots ? 1.5 : 1) * (beat.hasTuplet ? 2/3 : 1);
        if (fingering === '-') continue;
        for (const member of fingering.split(',')) {
          const [string,baseFret] = member.replace('^','').split('/').map(Number);
          assert(baseFret>=capo, 'same-pitch capo projection would require negative relative fret');
          const note = new at.model.Note();
          note.string = 7-string; // fixture's conventional 1=high E; alphaTab native 1=low E.
          note.fret = baseFret-capo;
          note.isTieDestination = member.endsWith('^');
          beat.addNote(note);
          placements.push({occurrence:row.id, role:roles[role], beat:j,string,capo,relativeFret:note.fret,physicalNeckFret:capo+note.fret,openTuning:tuning[string-1],expectedSound:tuning[string-1]+baseFret,native:note});
        }
      }
      assert(Math.abs(durationQ-4)<1e-9, `${row.id} ${roles[role]} not a complete bar`);
    }
  }
  score.finish(settings);
  assert(score.masterBars.every(b => !b.isRepeatStart && !b.isRepeatEnd), 'unfolded projection must not contain repeat commands');
  return {score,settings,placements,rows};
}
export function placementEvidence(projection) {
  return projection.placements.map(({native,...p}) => ({...p,actualSound:native.realValue,writtenPitch:native.displayValue,tieDestination:native.isTieDestination}));
}
export function midiBytes({score,settings}) {
  const file = new at.midi.MidiFile();
  const handler = new at.midi.AlphaSynthMidiFileHandler(file,true);
  new at.midi.MidiFileGenerator(score,settings,handler).generate();
  return file.toBinary();
}
export async function render(projection, dir) {
  const renderer = new at.rendering.ScoreRenderer(projection.settings);
  renderer.width = 750;
  const chunks = [];
  renderer.partialRenderFinished.on(r => chunks.push(r));
  await new Promise((resolve,reject) => {
    const timeout=setTimeout(() => reject(new Error('render timeout after 10s')),10000);
    renderer.postRenderFinished.on(() => {clearTimeout(timeout);resolve();});
    renderer.error.on(error => {clearTimeout(timeout);reject(error);});
    renderer.renderScore(projection.score,[0]);
  });
  assert(renderer.boundsLookup?.isFinished, 'render completed without finished bounds');
  const systems = renderer.boundsLookup.staffSystems.map(s => ({index:s.index,bars:s.bars.map(b=>b.index),visual:{...s.visualBounds},real:{...s.realBounds}}));
  assert.deepEqual(systems.flatMap(s=>s.bars), Array.from({length:24},(_,i)=>i), 'all rendered bars exactly once');
  const units=chunks.map((c,i) => {
    assert.equal(typeof c.renderResult,'string');
    const contained = systems.filter(s => s.bars[0]>=c.firstMasterBarIndex && s.bars.at(-1)<=c.lastMasterBarIndex);
    if (c.firstMasterBarIndex>=0) {
      assert.equal(contained.length,1, 'required exactly one complete system per partial');
      const s=contained[0];
      assert.equal(c.firstMasterBarIndex,s.bars[0]);
      assert.equal(c.lastMasterBarIndex,s.bars.at(-1));
      assert(s.visual.y>=c.y-1 && s.visual.y+s.visual.h<=c.y+c.height+1,'partial clips system vertically');
      assert(s.visual.x>=c.x-1 && s.visual.x+s.visual.w<=c.x+c.width+1,'partial clips system horizontally');
    }
    const raw=c.renderResult;
    // alphaTab music SVG classes depend on external CSS. Materialize the font explicitly.
    const svg=raw.replaceAll('class="at"','class="at" font-family="alphaTab" font-size="34"');
    fs.writeFileSync(`${dir}/partial-${String(i).padStart(2,'0')}.svg`,svg);
    return {x:c.x,y:c.y,width:c.width,height:c.height,first:c.firstMasterBarIndex,last:c.lastMasterBarIndex,system:contained[0]?.index??null,svg};
  });
  assert.equal(units.filter(u=>u.system!==null).length,systems.length);
  fs.writeFileSync(`${dir}/render-layout.json`,JSON.stringify({systems,units:units.map(({svg,...u})=>u)},null,2));
  renderer.destroy();
  return {systems,units};
}

export async function writePdf(layout, dir, size, capo, {omitMusicFont=false,clipLastSystem=false}={}) {
  const doc = new PDFDocument({size,margin:0,autoFirstPage:false,compress:true,info:{Title:title,Subject:revision,Author:'U02 original fixture'}});
  const dest=fs.createWriteStream(`${dir}/${size}.pdf`);
  doc.pipe(dest);
  const fontPath=new URL('node_modules/@coderline/alphatab/dist/font/Bravura.otf',import.meta.url).pathname;
  doc.registerFont('alphaTab',fontPath);
  const pages=[], warnings=[];
  let y, page;
  const addPage=()=>{
    doc.addPage({size,margin:0});
    page={number:pages.length+1,width:doc.page.width,height:doc.page.height,systems:[],units:[]}; pages.push(page);
    doc.font('Helvetica').fontSize(8).text(`${revision} | Capo ${capo} | Standard EADGBE | written = sounding + 12`,28,16,{lineBreak:false});
    doc.text(`${size} - ${page.number} | Explicit form; S=source bar, P=pass (no repeat commands)`,28,doc.page.height-22,{lineBreak:false});
    y=40;
  };
  addPage();
  const scale=(doc.page.width-56)/750; // Constant global scale: NEVER stretch each partial independently.
  for (const [index,u] of layout.units.entries()) {
    const height=u.height*scale;
    const labelHeight=u.system===null ? 0 : 11;
    assert(height+labelHeight<=doc.page.height-80,'over-height complete system must reject, not clip');
    if(y+height+labelHeight>doc.page.height-34) addPage();
    if(u.system!==null) {
      doc.font('Helvetica').fontSize(7).fillColor('#666666').text(`SYSTEM${String(u.system+1).padStart(2,'0')}`,28,y,{lineBreak:false});
      y+=labelHeight;
      page.systems.push(u.system);
    }
    const placement={unit:index,system:u.system,x:28+u.x*scale,y,width:u.width*scale,height,first:u.first,last:u.last};
    assert(placement.x>=28 && placement.x+placement.width<=doc.page.width-27,'horizontal overflow');
    // SVG-to-PDFKit's width/height are a VIEWPORT, not a scale override for an explicit px root.
    // Own the transform; disable its implicit 72/96 scaling. This keeps measured bounds honest.
    doc.save().translate(placement.x,y).scale(scale);
    if(clipLastSystem && u.system===11) doc.rect(0,0,u.width,u.height*0.55).clip();
    SVGtoPDF(doc,u.svg,0,0,{
      assumePt:true,width:u.width,height:u.height,
      fontCallback:(family,bold,italic)=>family==='alphaTab' && !omitMusicFont ? fontPath : (bold ? (italic?'Helvetica-BoldOblique':'Helvetica-Bold') : (italic?'Helvetica-Oblique':'Helvetica')),
      warningCallback:message=>warnings.push(message)
    });
    doc.restore();
    page.units.push(placement);
    y+=height;
  }
  doc.end();
  await finished(dest);
  assert.deepEqual(warnings,[],'SVG-to-PDFKit warnings');
  fs.writeFileSync(`${dir}/${size}-pagination.json`,JSON.stringify({scale,pages,warnings},null,2));
  return {scale,pages,warnings};
}
