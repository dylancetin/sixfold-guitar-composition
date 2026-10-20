// Independent PDF.js inspection. No renderer/model imports and no generated pagination trusted.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { checkPdfSummary, expected } from './checks.mjs';

const multiply=(a,b)=>[
  a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],
  a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],
  a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]
];
const point=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
function horizontalLines(ops) {
  let m=[1,0,0,1,0,0];const stack=[],lines=[];
  for(const [i,fn] of ops.fnArray.entries()) {
    const args=ops.argsArray[i];
    if(fn===OPS.save) stack.push(m);
    else if(fn===OPS.restore) {m=stack.pop(); assert(m);}
    else if(fn===OPS.transform) m=multiply(m,args);
    else if(fn===OPS.constructPath && args[0]===OPS.fill && args[2]) {
      // PDF.js 6's draw-op and independent min/max path box, after the PDF CTM.
      const [x1,y1,x2,y2]=args[2];
      const corners=[point(m,x1,y1),point(m,x1,y2),point(m,x2,y1),point(m,x2,y2)];
      const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);
      const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
      // TAB lines are deliberately split around fret digits; even a correct line may have
      // no long segment. Twenty points retains these fragments while excluding ledger lines.
      if(w>20 && h>0.1 && h<2) lines.push({x,y:y+h/2,w,h});
    }
  }
  return lines;
}
function lineGroups(lines,count,gap) {
  const ys=lines.map(l=>l.y).sort((a,b)=>a-b).filter((y,i,all)=>i===0 || y-all[i-1]>0.15);
  const has=y=>ys.some(actual=>Math.abs(actual-y)<0.15);
  return ys.filter(y=>!has(y-gap) && Array.from({length:count},(_,i)=>has(y+i*gap)).every(Boolean)).map(bottom=>({bottom,top:bottom+(count-1)*gap,gap}));
}
function inkBounds(ctx,width,height) {
  const {data}=ctx.getImageData(0,0,width,height);
  let left=width,top=height,right=-1,bottom=-1,inkPixels=0;
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const i=(y*width+x)*4;
    if(data[i]<220 || data[i+1]<220 || data[i+2]<220) {
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);inkPixels++;
    }
  }
  return {left,top,right,bottom,inkPixels};
}

export async function inspectPdf(file,capo,{rasterDir}={}) {
  const bytes=fs.readFileSync(file);
  assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true,fontExtraProperties:true,standardFontDataUrl:new URL('node_modules/pdfjs-dist/standard_fonts/',import.meta.url).pathname});
  const summary={file,bytes:bytes.length,pages:[],embeddedBravura:false};
  try {
    const pdf=await task.promise;
    for(let number=1;number<=pdf.numPages;number++) {
      const page=await pdf.getPage(number), textContent=await page.getTextContent(),ops=await page.getOperatorList();
      const items=textContent.items.filter(i=>typeof i.str==='string'),text=items.map(i=>i.str).join(' ');
      const fontIds=[...new Set(ops.fnArray.flatMap((f,i)=>f===OPS.setFont ? [ops.argsArray[i][0]] : []))];
      const fonts=fontIds.map(id=>({id,name:page.commonObjs.get(id).name??'',embeddedBytes:page.commonObjs.get(id).data?.length??0}));
      if(fonts.some(f=>f.name.includes('Bravura') && f.embeddedBytes>1000)) summary.embeddedBravura=true;
      const music=items.filter(i=>/[\ue000-\uf8ff]/u.test(i.str));
      const musicGlyphs=music.reduce((sum,i)=>sum+[...i.str].filter(c=>/[\ue000-\uf8ff]/u.test(c)).length,0);
      const viewport=page.getViewport({scale:1.5}),base=page.getViewport({scale:1});
      const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height)),ctx=canvas.getContext('2d');
      await page.render({canvasContext:ctx,viewport,background:'white'}).promise;
      const ink=inkBounds(ctx,canvas.width,canvas.height);
      let raster;
      if(rasterDir) {
        fs.mkdirSync(rasterDir,{recursive:true});
        raster=`${rasterDir}/page-${String(number).padStart(2,'0')}.png`;
        fs.writeFileSync(raster,canvas.toBuffer('image/png'));
      }
      const scale=(base.width-56)/750;
      const lines=horizontalLines(ops),staffGroups=lineGroups(lines,5,9*scale),tabGroups=lineGroups(lines,6,13*scale);
      const barLabels=[...text.matchAll(/\bO(\d{2})\/S\d{2}\/P[12]\b/g)].map(m=>Number(m[1]));
      const systemLabels=[...text.matchAll(/\bSYSTEM(\d{2})\b/g)].map(m=>Number(m[1]));
      assert.equal([...text].filter(c=>c==='\ue050').length,systemLabels.length,'each system needs a treble clef');
      assert.equal([...text].filter(c=>c==='\ue06d').length,systemLabels.length,'each system needs a TAB glyph');
      const record={number,width:base.width,height:base.height,operators:ops.fnArray.length,musicGlyphs,fontNames:fonts.map(f=>f.name),fonts,text,barLabels,systemLabels,staffLineGroups:staffGroups.length,tabLineGroups:tabGroups.length,staffGroups,tabGroups,ink,raster,
        inkInBounds:ink.left>10 && ink.top>10 && ink.right<canvas.width-10 && ink.bottom<canvas.height-10};
      summary.pages.push(record);
      // Text extraction/operators alone still see content hidden by a PDF clip path.
      // Independently sample the RASTER along each vector-detected staff/TAB line.
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      record.rasterLineCoverage=[];
      for(const [groups,count] of [[staffGroups,5],[tabGroups,6]]) for(const g of groups) for(let k=0;k<count;k++) {
        const y=g.bottom+k*g.gap;
        const segment=lines.filter(l=>Math.abs(l.y-y)<0.15).sort((a,b)=>b.w-a.w)[0];
        assert(segment);
        let hits=0;
        for(let j=1;j<=30;j++) {
          const px=Math.round((segment.x+segment.w*j/31)*1.5),py=Math.round((base.height-y)*1.5);
          let dark=false;
          for(let dy=-2;dy<=2;dy++) {
            const i=((py+dy)*canvas.width+px)*4;
            if(pixels[i]<220 || pixels[i+1]<220 || pixels[i+2]<220)dark=true;
          }
          if(dark)hits++;
        }
        record.rasterLineCoverage.push(hits/30);
        assert(hits>=20,`clipped/invisible raster staff or TAB line on page ${number}`);
      }
      // Test actual glyph geometry, not just a native model getter. The first attack is F#4 sounding,
      // F#5 written. In treble clef its notehead must be ON the top (F5) staff line.
      if(number===1 && staffGroups.length>0) {
        const melody=items.find(i=>i.str.includes('\ue0a4'));
        assert(melody,'first melody notehead missing');
        const topStaffLine=Math.max(...staffGroups.map(g=>g.top));
        record.octaveProbe={sounding:66,written:78,headBaseline:melody.transform[5],topStaffLine,errorPt:Math.abs(melody.transform[5]-topStaffLine),fontSize:melody.height,expectedFontSize:34*scale};
        assert(record.octaveProbe.errorPt<0.2,'written F#5 not on top staff line (octave error)');
        assert(Math.abs(melody.height-34*scale)<0.01,'SVG viewport/px scale mismatch');
      }
      // A complete combined system contributes exactly one staff AND one six-line TAB group.
      assert.equal(staffGroups.length,systemLabels.length,'missing/split staff lines');
      assert.equal(tabGroups.length,systemLabels.length,'missing/split TAB lines');
      // Every engraved occurrence must identify its source bar and pass, checked independently.
      for(const match of text.matchAll(/\bO(\d{2})\/S(\d{2})\/P([12])\b/g)) {
        const i=Number(match[1])-1;
        assert.equal(Number(match[2]),expected.form[i]);
        assert.equal(Number(match[3]),expected.passes[i]);
      }
    }
    fs.writeFileSync(`${file}.inspection.json`,JSON.stringify(summary,null,2));
    checkPdfSummary(summary,capo);
    return summary;
  } finally {await task.destroy();}
}
