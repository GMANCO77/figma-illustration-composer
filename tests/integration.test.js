const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('render reuses existing page on Starter and preserves source tree',async()=>{
let next=1;const all=new Map();
class Node{constructor(type,name,w=100,h=100){this.id='test:'+next++;this.type=type;this.name=name;this.width=w;this.height=h;this.x=0;this.y=0;this.children=[];this.fills=[];all.set(this.id,this);}appendChild(n){if(n.parent)n.parent.children=n.parent.children.filter(x=>x!==n);this.children.push(n);n.parent=this;}async loadAsync(){}setSharedPluginData(ns,key,value){if(!/^[A-Za-z0-9_.]+$/.test(ns))throw Error('Invalid Figma namespace');this.data=this.data||{};this.data[ns+key]=value;}getSharedPluginData(ns,key){return this.data&&this.data[ns+key]||'';}clone(){const n=new Node(this.type,this.name,this.width,this.height);n.fills=this.fills.map(p=>({...p}));for(const c of this.children)n.appendChild(c.clone());this.parent.appendChild(n);return n;}resize(w,h){this.width=w;this.height=h;}rescale(s){this.width*=s;this.height*=s;}findAll(){return this.children.flatMap(n=>[n,...n.findAll()]);}remove(){this.parent.children=this.parent.children.filter(n=>n!==this);} }
const lib=new Node('PAGE','Библиотека компонентов'),examples=new Node('PAGE','Примеры композиций');const catalog=JSON.parse(fs.readFileSync('src/catalog.json'));for(const a of catalog){for(const v of Object.values(a.variants))for(const id of Object.values(v)){const n=new Node('GROUP',a.name,300,200);n.id=id;all.set(id,n);lib.appendChild(n);}}
const before=lib.children.length;let creates=0;const figma={root:{children:[lib,examples]},getNodeByIdAsync:async id=>all.get(id),createPage:()=>{throw Error('Starter page limit')},createFrame:()=>{creates++;return new Node('FRAME','frame')}};
const context=vm.createContext({figma,COMPOSER_HEADLESS:true,console});vm.runInContext(fs.readFileSync('dist/code.js','utf8'),context);const result=await vm.runInContext("generate({ids:['book','lamp'],size:'S',format:'wide',palette:PALETTES[0]},true)",context);assert.equal(result.length,3);assert.equal(creates,3);assert.equal(examples.children.length,3);assert.equal(lib.children.length,before);assert.equal(result[0].children.length,2);
});test('recolor selected composition preserves geometry and applies new palette to all layers',async()=>{
 // This integration test uses the same sandbox fixture as generation below.
 const fs=require('node:fs'),vm=require('node:vm');const source=fs.readFileSync('dist/code.js','utf8');const frame={type:'FRAME',name:'Собранно · L · Лаванда',fills:[],children:[],getSharedPluginData:()=>JSON.stringify(['#d7cdf5','#aa9bf0','#7864d7','#f9ecb0','#f9a3aa','#ffe3e1','#181817','#ffffff']),setSharedPluginData(){},width:1200,height:675,x:100,y:100};
 const child={name:'Книга · главный',fills:[{type:'SOLID',color:{r:1,g:1,b:1}}],strokes:[],findAll:()=>[],x:90,y:80,width:300,height:200};frame.children.push(child);
 const figma={currentPage:{selection:[frame]}};const ctx=vm.createContext({figma,COMPOSER_HEADLESS:true});vm.runInContext(source,ctx);const result=await vm.runInContext('applyPaletteToSelection(PALETTES[2])',ctx);assert.equal(result,1);assert.equal(frame.width,1200);assert.equal(child.x,90);assert.equal(child.width,300);assert.equal(frame.fills[0].type,'SOLID');
});

test('palette round trip preserves accent role through duplicate custom colors',()=>{
 const source=fs.readFileSync('dist/code.js','utf8');const values=new Map();
 const child={name:'Книга · главный',fills:[{type:'SOLID',color:{r:249/255,g:236/255,b:176/255}}],strokes:[],findAll:()=>[],setSharedPluginData:(ns,key,value)=>values.set(ns+key,value),getSharedPluginData:(ns,key)=>values.get(ns+key)||''};
 const frameData=new Map([['illustration_composerpalette',JSON.stringify(['#d7cdf5','#aa9bf0','#7864d7','#f9ecb0','#f9a3aa','#ffe3e1','#181817','#ffffff'])]]);
 const frame={id:'frame',type:'FRAME',name:'Собранно · L · Лаванда',fills:[],children:[child],getSharedPluginData:(ns,key)=>frameData.get(ns+key)||'',setSharedPluginData:(ns,key,value)=>frameData.set(ns+key,value)};
 const ctx=vm.createContext({figma:{currentPage:{selection:[frame]}},COMPOSER_HEADLESS:true});vm.runInContext(source,ctx);
 vm.runInContext("applyPaletteToSelection({name:'Одинаковые',colors:PALETTES[0].colors.map((c,i)=>i===3?PALETTES[0].colors[0]:c)});applyPaletteToSelection(PALETTES[0])",ctx);
 assert.equal(vm.runInContext('C.hex(figma.currentPage.selection[0].children[0].fills[0].color)',ctx),'#f9ecb0');
});
