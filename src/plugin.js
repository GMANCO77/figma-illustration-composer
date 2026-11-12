/* Native Figma plugin sandbox. Pure algorithms are shared with the UI and tests. */
const C=ComposerCore,ASSETS=__CATALOG__,PALETTES=__PALETTES__;
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
