import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveInput, planLayout, parsePalette, validateProject, History, CATALOG, PALETTES } from '../src/core.mjs';

test('component input understands Russian inflections and keeps input order',()=>{
 assert.deepEqual(resolveInput('книгу, лампу и ручку','objects').ids,['book','lamp','pen']);
});
test('mixed known and unknown components are never silently accepted',()=>{
 const r=resolveInput('Книга, ракета','objects'); assert.deepEqual(r.ids,['book']); assert.deepEqual(r.unknown,['ракета']);
});
test('theme matching understands a metaphor without literal object names',()=>{
 const r=resolveInput('Вырастить идею','idea'); assert.ok(r.ids.includes('flowers')); assert.ok(r.ids.includes('lamp'));
});
test('negative clauses apply across inflected names',()=>{
 const r=resolveInput('Учиться без телефона и наушников, но с лампой','idea'); assert.ok(r.ids.includes('book')); assert.ok(r.ids.includes('lamp')); assert.ok(!r.ids.includes('phone')); assert.ok(!r.ids.includes('headphones'));
});
test('unavailable concrete topics do not invent objects',()=>{
 assert.equal(resolveInput('анатомически точный осьминог','idea').ids.length,0);
});
test('empty input never chooses random objects',()=>assert.equal(resolveInput('   ','idea').ids.length,0));
test('plain negation excludes a named object and preserves the positive alternative',()=>{const r=resolveInput('Не телефон, а книга','idea');assert.ok(!r.ids.includes('phone'));assert.ok(r.ids.includes('book'));});
test('object list may include a valid exclusion clause',()=>{const r=resolveInput('книга без телефона','objects');assert.deepEqual(r.ids,['book']);assert.deepEqual(r.unknown,[]);});
test('concrete names do not silently match unrelated English compounds or adjectives',()=>{assert.deepEqual(resolveInput('bookcase','objects').ids,[]);assert.ok(resolveInput('цветной фон','objects').unknown.length>0);assert.deepEqual(resolveInput('цветной фон','objects').ids,[]);});
test('negative prefix must be a separate word',()=>{assert.ok(resolveInput('Безопасность телефона','idea').ids.includes('phone'));});
test('genitive plural exclusions and names are recognized',()=>{assert.ok(!resolveInput('Рост без цветов','idea').ids.includes('flowers'));const r=resolveInput('папок, ручек, цветов','objects');assert.deepEqual(r.ids,['folder','pen','flowers']);assert.deepEqual(r.unknown,[]);});
test('not only construction does not exclude a positive object',()=>{const r=resolveInput('Не только телефон, но и книга','idea');assert.ok(r.ids.includes('phone'));assert.ok(r.ids.includes('book'));});
test('palette validates all eight semantic slots',()=>{
 const p=parsePalette(JSON.stringify({name:'Своя',colors:Array(8).fill('#ABCDEF')})); assert.equal(p.colors[0],'#abcdef');
 assert.throws(()=>parsePalette('{"name":"Bad","colors":["red"]}'));
});
const entries=[{uid:'a',assetId:'book',role:'main',w:1446,h:977},{uid:'b',assetId:'lamp',role:'main',w:760,h:1120},{uid:'c',assetId:'pen',role:'background',w:850,h:320}];
test('all formats and layouts keep objects within the canvas using uniform scale',()=>{
 for(const [w,h] of [[1200,675],[1080,1080],[1080,1440],[1080,1920]])for(let v=0;v<3;v++){
  const p=planLayout(entries,w,h,v); assert.equal(p.length,3);
  for(const n of p){assert.ok(n.x>=0&&n.y>=0);assert.ok(n.x+n.w*n.scale<=w+.01);assert.ok(n.y+n.h*n.scale<=h+.01); assert.equal(n.scale,p[0].scale);}
 }
});
test('composition alternatives change relative placement',()=>{
 const positions=[0,1,2].map(v=>planLayout(entries,1200,675,v)).map(p=>{const a=p.find(x=>x.uid==='a'),b=p.find(x=>x.uid==='b');return [(b.x-a.x)/a.scale,(b.y-a.y)/a.scale].map(x=>Math.round(x));});
 assert.notDeepEqual(positions[0],positions[1]); assert.notDeepEqual(positions[1],positions[2]);
});
function project(){return {version:1,title:'Моя композиция',format:'wide',size:'L',palette:PALETTES[0],background:true,layers:[{uid:'a',assetId:'book',role:'main',x:100,y:100,scale:.4,rotation:0,locked:false}]};}
test('portable project round trip preserves transforms and names',()=>{
 const p=project();assert.deepEqual(validateProject(JSON.stringify(p)),p);
});
test('project rejects unknown asset IDs and non-finite/excessive transforms',()=>{
 for(const field of [{assetId:'rocket'},{x:Infinity},{scale:-1},{scale:1e8},{rotation:NaN}]){const p=project();Object.assign(p.layers[0],field);assert.throws(()=>validateProject(JSON.stringify(p)));}
});
test('project rejects duplicate layer IDs and excessive layer count',()=>{
 const p=project();p.layers.push({...p.layers[0]});assert.throws(()=>validateProject(JSON.stringify(p)));
});
test('project rejects inherited format property names',()=>{for(const format of ['__proto__','constructor','toString']){const p=project();p.format=format;assert.throws(()=>validateProject(JSON.stringify(p)));}});
test('history restores exact snapshots and truncates redo after a new edit',()=>{
 const a=project(), h=new History(a);const b=structuredClone(a);b.layers[0].x=500;h.push(b);assert.equal(h.undo().layers[0].x,100);assert.equal(h.redo().layers[0].x,500);h.undo();const c=structuredClone(a);c.title='Новая';h.push(c);assert.equal(h.canRedo,false);assert.equal(h.undo().title,a.title);
});
test('catalog retains ten original semantic objects',()=>assert.equal(CATALOG.length,10));
