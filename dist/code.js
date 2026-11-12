const ComposerCore = {
 normalize(value) { return String(value || '').toLowerCase().replace(/ё/g, 'е'); },
 excludedIds(text, catalog) {
  const q=this.normalize(text);
  const clauses=[...q.matchAll(/(?:^|[\s,(])(?:без|кроме|исключая|не добавляй(?:те)?)\s+([^.!?;]+)/g)].map(m=>m[1].split(/(?:,\s*|\s+)(?:но|зато|однако|с|со|добавь|добавьте|добавить|нужна?|нужны)\s+/)[0]);
  return catalog.filter(a=>clauses.some(c=>c.includes(this.normalize(a.name).slice(0,-1)))).map(a=>a.id);
 },
 resolveTheme(text, catalog) {
  const q=this.normalize(text), excluded=this.excludedIds(text,catalog);
  return catalog.map(a=>({id:a.id,score:[a.name,...a.tags].reduce((n,t)=>n+(q.includes(this.normalize(t))?1:0),0)}))
   .filter(x=>x.score&&!excluded.includes(x.id)).sort((a,b)=>b.score-a.score).slice(0,6).map(a=>a.id);
 },
 validateIds(ids,catalog) {
  if(!Array.isArray(ids)||!ids.length)throw Error('Выберите объекты из каталога');
  const unique=[...new Set(ids)];
  if(unique.length>6)throw Error('Выберите не более шести объектов');
  if(unique.some(id=>typeof id!=='string'||!catalog.some(a=>a.id===id)))throw Error('Объект отсутствует в каталоге');
  return unique;
 },
 bounds(nodes) {
  const x=Math.min(...nodes.map(n=>n.x)),y=Math.min(...nodes.map(n=>n.y));
  return {x,y,w:Math.max(...nodes.map(n=>n.x+n.w))-x,h:Math.max(...nodes.map(n=>n.y+n.h))-y};
 },
 overlap(a,b) {
  return Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
 },
 planLayout(entries,w,h,variant) {
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<100||h<100)throw Error('Некорректный формат');
  if(!entries.length)return [];
  if(entries.some(n=>!Number.isFinite(n.w)||!Number.isFinite(n.h)||n.w<=0||n.h<=0))throw Error('Некорректный размер объекта');
  const mode=[0,1,2].includes(variant)?variant:0,wide=w>h*1.2;
  const box=mode===2?(wide?{x:w*.42,y:h*.06,w:w*.54,h:h*.88}:{x:w*.04,y:h*.32,w:w*.92,h:h*.64}):
   mode===1?{x:w*.06,y:h*.04,w:w*.90,h:h*.91}:{x:w*.035,y:h*.06,w:w*.93,h:h*.88};
  const foreground=entries.filter(n=>n.role!=='background'),background=entries.filter(n=>n.role==='background');
  const ordered=foreground.length?foreground:[background[0]];
  const hero=ordered[0];
  const placed=[{...hero,x:0,y:0,hero:true}];
  const supports=ordered.slice(1).sort((a,b)=>b.w*b.h-a.w*a.h);
  for(const a of supports) {
   const candidates=[];
   for(const r of placed) candidates.push(
    {x:r.x+r.w-a.w*.13,y:r.y-r.h*.22},
    {x:r.x+r.w-a.w*.13,y:r.y+r.h-a.h*.75},
    {x:r.x+r.w-a.w*.50,y:r.y+r.h-a.h*.12},
    {x:r.x-a.w*.85,y:r.y+r.h*.65},
    {x:r.x+r.w*.18,y:r.y+r.h-a.h*.13},
    {x:r.x-a.w*.72,y:r.y-a.h*.65},
    {x:r.x+r.w*.50,y:r.y-a.h*.80}
   );
   let best=null;
   for(const c of candidates) {
    const candidate={...a,...c},b=this.bounds([...placed,candidate]);
    const overlaps=placed.map(r=>this.overlap(candidate,r)/Math.min(a.w*a.h,r.w*r.h));
    const max=Math.max(...overlaps);
    const compact=b.w*b.h/(placed.reduce((s,n)=>s+n.w*n.h,0)+a.w*a.h);
    const aspect=Math.abs(Math.log((b.w/b.h)/(box.w/box.h)));
    const direction=mode===1?((c.x<0?.28:0)+(c.y<0?0:.08)):0;
    const score=aspect*1.3+compact*.55+Math.max(0,max-.22)*30+direction;
    if(!best||score<best.score)best={candidate,score};
   }
   placed.push(best.candidate);
  }
  for(const [i,a]of background.filter(n=>n!==hero).entries()) {
   const b=this.bounds(placed),slots=[
    {x:b.x+b.w-a.w*.68,y:b.y-a.h*.20},
    {x:b.x-a.w*.25,y:b.y+b.h-a.h*.65},
    {x:b.x+b.w*.35,y:b.y+b.h-a.h*.45}
   ];
   placed.push({...a,...slots[(i+mode)%slots.length],hero:false});
  }
  const bounds=this.bounds(placed);
  const scale=Math.min(box.w/bounds.w,box.h/bounds.h);
  const offsetX=box.x+(box.w-bounds.w*scale)*(mode===1?.68:.5);
  const offsetY=box.y+(box.h-bounds.h*scale)*(mode===1?.38:.5);
  const plans=placed.map((a,i)=>({...a,scale,x:offsetX+(a.x-bounds.x)*scale,y:offsetY+(a.y-bounds.y)*scale,z:a.role==='background'?i:(a.hero?100:10+i)}));
  return entries.map(a=>plans.find(n=>n.id===a.id));
 },
 parsePalette(text) {
  const p=JSON.parse(text);
  if(!p||typeof p.name!=='string'||!Array.isArray(p.colors)||p.colors.length!==8)throw Error('Неверный формат палитры: нужны name и восемь colors');
  if(p.colors.some(c=>!/^#[0-9a-f]{6}$/i.test(c)))throw Error('Цвета должны быть HEX #RRGGBB');
  return {name:p.name.slice(0,50),colors:p.colors.map(c=>c.toLowerCase())};
 },
 rgb(hex) {return {r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255};},
 hex(c) {return '#'+[c.r,c.g,c.b].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');},
 colorSlot(hex,from,role='main') {
  const aliases=role==='background'?{'#171409':2,'#171714':2,'#d9d9d9':0,'#eee2f6':0}:
   {'#171409':6,'#171714':6,'#d9d9d9':7,'#eee2f6':0};
  const slot=Object.prototype.hasOwnProperty.call(aliases,hex)?aliases[hex]:from.indexOf(hex);
  if(role==='background'&&slot>=3)return slot===6?2:0;
  return slot;
 },
 recolorPaint(p,from,to,role='main') {
  if(p.type!=='SOLID')return p;
  const slot=this.colorSlot(this.hex(p.color).toLowerCase(),from,role);
  return slot<0?p:{...p,color:this.rgb(to[slot])};
 }
};
if(typeof module!=='undefined')module.exports=ComposerCore;

/* Native Figma plugin sandbox. Pure algorithms are shared with the UI and tests. */
const C=ComposerCore,ASSETS=[
  {
    "id": "book",
    "name": "Книга",
    "tags": [
      "обучение",
      "знания",
      "образование",
      "чтение",
      "развитие"
    ],
    "variants": {
      "L": {
        "main": "21:29965",
        "background": "24:6273"
      },
      "S": {
        "main": "24:3810",
        "background": "24:6934"
      }
    }
  },
  {
    "id": "phone",
    "name": "Телефон",
    "tags": [
      "технологии",
      "связь",
      "общение",
      "приложение",
      "цифровой"
    ],
    "variants": {
      "L": {
        "main": "21:25472",
        "background": "24:6327"
      },
      "S": {
        "main": "24:4746",
        "background": "24:6990"
      }
    }
  },
  {
    "id": "puzzle",
    "name": "Пазлы",
    "tags": [
      "команда",
      "сотрудничество",
      "решение",
      "задача",
      "система",
      "вместе"
    ],
    "variants": {
      "L": {
        "main": "21:417",
        "background": "24:6214"
      },
      "S": {
        "main": "24:4903",
        "background": "24:7147"
      }
    }
  },
  {
    "id": "coin",
    "name": "Монета",
    "tags": [
      "деньги",
      "финансы",
      "доход",
      "инвестиции",
      "бюджет"
    ],
    "variants": {
      "L": {
        "main": "24:2207",
        "background": "24:6795"
      },
      "S": {
        "main": "24:5345",
        "background": "24:7205"
      }
    }
  },
  {
    "id": "headphones",
    "name": "Наушники",
    "tags": [
      "музыка",
      "звук",
      "слушать",
      "отдых",
      "фокус"
    ],
    "variants": {
      "L": {
        "main": "23:122",
        "background": "24:6484"
      },
      "S": {
        "main": "24:5089",
        "background": "24:7344"
      }
    }
  },
  {
    "id": "lamp",
    "name": "Лампа",
    "tags": [
      "идея",
      "свет",
      "вдохновение",
      "работа",
      "фокус"
    ],
    "variants": {
      "L": {
        "main": "23:121",
        "background": "24:6569"
      },
      "S": {
        "main": "24:5485",
        "background": "24:7429"
      }
    }
  },
  {
    "id": "wallet",
    "name": "Кошелек",
    "tags": [
      "деньги",
      "финансы",
      "бюджет",
      "накопления",
      "оплата"
    ],
    "variants": {
      "L": {
        "main": "23:211",
        "background": "24:6660"
      },
      "S": {
        "main": "24:4594",
        "background": "24:7568"
      }
    }
  },
  {
    "id": "folder",
    "name": "Папка",
    "tags": [
      "документы",
      "порядок",
      "организация",
      "работа",
      "архив"
    ],
    "variants": {
      "L": {
        "main": "24:1899",
        "background": "24:6772"
      },
      "S": {
        "main": "24:4430",
        "background": "24:7520"
      }
    }
  },
  {
    "id": "pen",
    "name": "Ручка",
    "tags": [
      "писать",
      "творчество",
      "обучение",
      "заметки",
      "план"
    ],
    "variants": {
      "L": {
        "main": "24:1734",
        "background": "24:6747"
      },
      "S": {
        "main": "24:4287",
        "background": "24:7543"
      }
    }
  },
  {
    "id": "flowers",
    "name": "Цветы",
    "tags": [
      "рост",
      "забота",
      "подарок",
      "праздник",
      "красота",
      "развитие"
    ],
    "variants": {
      "L": {
        "main": "28:11628",
        "background": "30:11902"
      },
      "S": {
        "main": "28:11629",
        "background": "28:11766"
      }
    }
  }
],PALETTES=[
  {
    "name": "Лаванда",
    "colors": [
      "#d7cdf5",
      "#aa9bf0",
      "#7864d7",
      "#f9ecb0",
      "#f9a3aa",
      "#ffe3e1",
      "#181817",
      "#ffffff"
    ]
  },
  {
    "name": "Персик",
    "colors": [
      "#fdd7b9",
      "#fac896",
      "#d27532",
      "#f9ecb0",
      "#80dada",
      "#beebeb",
      "#181817",
      "#ffffff"
    ]
  },
  {
    "name": "Мята",
    "colors": [
      "#beebeb",
      "#80dada",
      "#5abebe",
      "#ffd4f2",
      "#6d7bfc",
      "#b6c6fe",
      "#181817",
      "#ffffff"
    ]
  }
];
const FORMAT={square:[1080,1080],wide:[1200,675],portrait:[1080,1920]};
const scenePalettes=new Map();
let busy=false;
function recolorTree(node,palette,role='main',sourceColors=PALETTES[0].colors){
 for(const n of [node,...('findAll' in node?node.findAll():[])]){
  let saved={};
  if('getSharedPluginData' in n){try{saved=JSON.parse(n.getSharedPluginData('illustration_composer','paintRoles')||'{}');}catch(e){}}
  const slots={};
  for(const prop of ['fills','strokes'])if(prop in n&&Array.isArray(n[prop])){
   slots[prop]=[];
   n[prop]=n[prop].map((p,i)=>{
    if(p.type!=='SOLID'){slots[prop].push(-1);return p;}
    const stored=saved&&Array.isArray(saved[prop])?saved[prop][i]:undefined;
    const slot=Number.isInteger(stored)&&stored>=-1&&stored<8?stored:C.colorSlot(C.hex(p.color).toLowerCase(),sourceColors,role);
    slots[prop].push(slot);
    return slot<0?p:{...p,color:C.rgb(palette.colors[slot])};
   });
  }
  if('setSharedPluginData' in n)n.setSharedPluginData('illustration_composer','paintRoles',JSON.stringify(slots));
 }
}
function savePalette(frame,palette){
 scenePalettes.set(frame.id,palette.colors);
 if('setSharedPluginData' in frame)frame.setSharedPluginData('illustration_composer','palette',JSON.stringify(palette.colors));
}
function currentColors(frame){
 if('getSharedPluginData' in frame){const stored=frame.getSharedPluginData('illustration_composer','palette');if(stored){try{const value=JSON.parse(stored);if(Array.isArray(value)&&value.length===8)return value;}catch(e){}}}
 return scenePalettes.get(frame.id);
}
function applyPaletteToSelection(input){
 const palette=C.parsePalette(JSON.stringify(input));
 const frames=figma.currentPage.selection.filter(n=>n.type==='FRAME'&&currentColors(n));
 if(!frames.length)throw Error('Выделите рамку, созданную конструктором');
 for(const frame of frames){
  const from=currentColors(frame);
  for(const child of frame.children)recolorTree(child,palette,child.name.endsWith(' · фон')?'background':'main',from);
  frame.fills=[{type:'SOLID',color:C.rgb(palette.colors[0])}];
  savePalette(frame,palette);
  frame.name=frame.name.replace(/ · [^·]+$/, ' · '+palette.name);
 }
 return frames.length;
}
async function generate(opts,stayOnLibrary=false){
 const ids=C.validateIds(opts.ids,ASSETS),size=opts.size==='S'?'S':'L';
 const palette=C.parsePalette(JSON.stringify(opts.palette||PALETTES[0])),dims=FORMAT[opts.format];
 if(!dims)throw Error('Выберите формат');
 const library=figma.root.children.find(p=>p.name==='Библиотека компонентов');
 if(!library)throw Error('Откройте рабочую копию с библиотекой');
 await library.loadAsync();
 const nodes=[];
 for(const id of ids){
  const a=ASSETS.find(x=>x.id===id),role=(opts.backgroundIds||[]).includes(id)?'background':'main';
  const node=await figma.getNodeByIdAsync(a.variants[size][role]);
  if(!node)throw Error('Не найден вариант '+a.name+' '+size+'. Нужна исходная рабочая копия.');
  nodes.push({id,name:a.name,node,w:node.width,h:node.height,role});
 }
 if(opts.heroId){const heroIndex=nodes.findIndex(n=>n.id===opts.heroId&&n.role!=='background');if(heroIndex>0)nodes.unshift(nodes.splice(heroIndex,1)[0]);}
 const page=figma.root.children.find(p=>p.name==='Результаты конструктора')||figma.root.children.find(p=>p.name==='Примеры композиций')||library;
 await page.loadAsync();
 const right=page.children.reduce((v,n)=>Math.max(v,n.x+n.width),-120),frames=[];
 try{
  for(let variant=0;variant<3;variant++){
   const frame=figma.createFrame();page.appendChild(frame);frames.push(frame);
   frame.name=['Собранно','По диагонали','Под заголовок'][variant]+' · '+size+' · '+palette.name;
   frame.resize(dims[0],dims[1]);frame.x=right+120+variant*(dims[0]+100);frame.y=0;
   frame.clipsContent=true;frame.fills=[{type:'SOLID',color:C.rgb(palette.colors[0])}];
   const plans=C.planLayout(nodes,dims[0],dims[1],variant);
   for(const item of [...plans].sort((a,b)=>a.z-b.z)){
    const copy=item.node.clone();frame.appendChild(copy);
    copy.rescale(item.scale);copy.x=item.x;copy.y=item.y;
    copy.name=item.name+' · '+(item.role==='background'?'фон':'главный');
    recolorTree(copy,palette,item.role);
   }
   savePalette(frame,palette);
  frame.name=frame.name.replace(/ · [^·]+$/, ' · '+palette.name);
  }
 }catch(e){for(const f of frames)f.remove();throw e;}
 if(!stayOnLibrary){await figma.setCurrentPageAsync(page);figma.currentPage.selection=[frames[0]];figma.viewport.scrollAndZoomIntoView(frames);}
 return frames;
}
async function exportSelection(){
 const frames=figma.currentPage.selection.filter(n=>n.type==='FRAME');
 if(frames.length!==1)throw Error('Выделите одну рамку композиции для экспорта');
 const bytes=await frames[0].exportAsync({format:'SVG',svgIdAttribute:true,svgOutlineText:false});
 return {name:frames[0].name+'.svg',bytes:Array.from(bytes)};
}
if(typeof figma!=='undefined'&&!globalThis.COMPOSER_HEADLESS){
 figma.showUI(__html__,{width:450,height:800,themeColors:true});
 figma.ui.onmessage=async message=>{
  if(busy)return;busy=true;figma.ui.postMessage({type:'busy',value:true});
  try{
   if(message.type==='init')figma.ui.postMessage({type:'catalog',assets:ASSETS.map(({id,name,tags})=>({id,name,tags})),palettes:PALETTES});
   else if(message.type==='generate'){
    const frames=await generate(message.options);
    figma.ui.postMessage({type:'success',text:'Созданы три варианта. Первый выделен для редактирования и экспорта.',ids:frames.map(f=>f.id)});
   }else if(message.type==='applyPalette'){
    const count=applyPaletteToSelection(message.palette);figma.ui.postMessage({type:'success',text:'Палитра применена к '+count+' композициям. Расположение сохранено.'});
   }else if(message.type==='export')figma.ui.postMessage({type:'download',...await exportSelection()});
   else if(message.type==='resolve'){
    const ids=C.resolveTheme(message.text,ASSETS);
    figma.ui.postMessage({type:'resolved',ids,text:ids.length?'Объекты подобраны по локальному словарю.':'Тема не найдена. Выберите объекты вручную или включите DeepSeek.'});
   }
  }catch(e){figma.ui.postMessage({type:'error',text:e.message||String(e)});}
  finally{busy=false;figma.ui.postMessage({type:'busy',value:false});}
 };
}
