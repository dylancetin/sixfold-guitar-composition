import assert from 'node:assert/strict';
import test from 'node:test';
import { checkNotes, checkPdfSummary, expected, literalOracle } from '../checks.mjs';

test('literal oracle baseline and endpoint', () => checkNotes(literalOracle()));
const corruptions = {
  'missing middle melody': ns => ns.filter(n => !(n.role==='melody' && n.ticks===46080)),
  'missing final melody': ns => ns.filter(n => !(n.role==='melody' && n.ticks===88320)),
  'octave +12': ns => ns.map(n => ({...n,pitch:n.pitch+12})),
  'double capo +2': ns => ns.map(n => ({...n,pitch:n.pitch+2})),
  'omitted triplet': ns => ns.filter(n => n.ticks!==4480),
  'tie retrigger': ns => ns.flatMap(n => n.pitch===67 && n.ticks===14400 ? [{...n,durationTicks:960},{...n,ticks:15360,durationTicks:1920}] : [n]),
  'written form only': ns => ns.filter(n => n.ticks<61440),
  'missing harmony': ns => ns.filter(n => n.role!=='harmony'),
  'truncated sustain': ns => ns.map((n,i) => i===0 ? {...n,durationTicks:1} : n)
};
for (const [name, mutate] of Object.entries(corruptions)) test(`negative: ${name}`, () => {
  const original = literalOracle(), altered = mutate(original);
  assert.notDeepEqual(altered, original, 'control must actually mutate');
  assert.throws(() => checkNotes(altered), /mismatch|missing/);
});
const validSummary = () => ({embeddedBravura:true,pages:[0,1,2,3].map(p => ({
  operators:1000,musicGlyphs:100,fontNames:['ABCDEF+Bravura'],staffLineGroups:3,tabLineGroups:3,
  text:`Capo 2 ${expected.revision} ${p===3 ? 'FINAL O24' : ''}`,inkInBounds:true,
  barLabels:Array.from({length:6},(_,i) => p*6+i+1),systemLabels:[p*3+1,p*3+2,p*3+3]
}))});
test('PDF predicate baseline (synthetic predicate test, not artifact evidence)', () => checkPdfSummary(validSummary(),2));
for (const [name, mutate] of Object.entries({
  'font missing': s => {s.embeddedBravura=false;},
  'glyphs absent': s => {s.pages[1].musicGlyphs=0;},
  'staff only': s => {s.pages[0].tabLineGroups=0;},
  'last page missing': s => {s.pages.pop();},
  'system clipped': s => {s.pages[1].inkInBounds=false;},
  'wrong revision': s => {s.pages[0].text='Capo 2 old-revision';},
  'capo label missing': s => {s.pages[2].text=expected.revision;}
})) test(`PDF negative: ${name}`, () => {
  const s=validSummary(); mutate(s); assert.throws(() => checkPdfSummary(s,2));
});
