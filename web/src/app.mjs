import {CATALOG,PALETTES,FORMATS,History,resolveInput,planLayout,parsePalette,validateProject,normalize} from './core.mjs';
import {loadAssets,templates,svgEl,dimensions,makeScene,objectNode,transform,exportSvg,download} from './svg.mjs';
import {icon,hydrateIcons} from './icons.mjs';
import {apiEndpoint} from './api-client.mjs';
import {API_BASE} from './site-config.mjs';
import {getWithRetry} from './network.mjs';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
hydrateIcons();
const STORAGE='sobrano.project.v1';
const fresh=()=>({version:1,title:'Новая композиция',format:'wide',size:'L',palette:structuredClone(PALETTES[0]),background:true,layers:[]});
let state=fresh(),history,manifest=[],selected=null,mode='idea',activeVariant=0,zoom=1,ready=false,aiAvailable=false,toastTimer,requestController,requestVersion=0;
const assetName=id=>CATALOG.find(a=>a.id===id)?.name||id;
const uid=()=>globalThis.crypto?.randomUUID?.()||'o'+Date.now().toString(36)+Math.random().toString(36).slice(2);
function toast(message,error=false){const t=$('#toast');clearTimeout(toastTimer);t.textContent=message;t.classList.toggle('error',error);t.hidden=false;toastTimer=setTimeout(()=>t.hidden=true,error?6500:3500);}
function message(text,error=false){const e=$('#resolve-message');e.textContent=text;e.className='resolve-message '+(error?'error':'success');}
function persistence(){try{localStorage.setItem(STORAGE,JSON.stringify(state));$('#save-status').textContent='Сохранено в браузере';}catch{$('#save-status').textContent='Хранилище недоступно — сохраните проект';}}
function invalidatePending(){requestVersion++;requestController?.abort();requestController=null;$('#build').disabled=!ready;$('#build-label').textContent='Собрать композицию';}
function commit({render=true,fromBuild=false}={}){if(!fromBuild)invalidatePending();history.push(state);persistence();if(render)renderAll();else renderHistory();}
function renderHistory(){$('#undo').disabled=!history?.canUndo;$('#redo').disabled=!history?.canRedo;}
function selectedLayer(){return state.layers.find(l=>l.uid===selected);}
function composition(variant){const {w,h}=FORMATS[state.format];const entries=state.layers.map(l=>({...l,w:dimensions(l,state,manifest).width,h:dimensions(l,state,manifest).height}));return planLayout(entries,w,h,variant).map(({uid,assetId,role,x,y,scale,rotation,locked})=>({uid,assetId,role,x,y,scale,rotation,locked:!!locked}));}
function buildFromIds(ids,variant=0){
 state.layers=ids.map((id,i)=>({uid:uid(),assetId:id,role:'main',x:0,y:0,scale:1,rotation:0,locked:false}));
 state.layers=composition(variant);selected=null;activeVariant=variant;
}
function renderScene(){
 const art=$('#artboard'),{w,h}=FORMATS[state.format];art.setAttribute('viewBox',`0 0 ${w} ${h}`);art.setAttribute('aria-label',`${state.title}, ${state.layers.length} объектов`);
 const rendered=makeScene(state,manifest),scene=$('#scene');scene.replaceChildren(...rendered.childNodes);
 for(const l of state.layers){const g=[...scene.children].find(e=>e.getAttribute('data-uid')===l.uid);g?.setAttribute('data-locked',l.locked);}
 $('#canvas-size').textContent=`${w} × ${h}`;
 fitArtboard();
 $('#zoom-reset').textContent=zoom===1?'По размеру':`${Math.round(zoom*100)}%`;
 renderSelection();
}
function fitArtboard(){
 const area=$('#canvas-area'),css=getComputedStyle(area),{w,h}=FORMATS[state.format];
 const width=area.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight),height=area.clientHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom);
 const fit=Math.max(80,Math.min(width,height*w/h,1000));$('#artboard-wrap').style.maxWidth='none';$('#artboard-wrap').style.width=`${fit*zoom}px`;
}
function renderSelection(){
 const overlay=$('#selection-overlay');overlay.replaceChildren();const l=selectedLayer();
 if(!l){$('#canvas-hint').textContent=state.layers.length?'Выберите объект на холсте, чтобы его изменить':'Добавьте объекты из библиотеки или соберите по идее';return;}
 const d=dimensions(l,state,manifest),w=d.width,h=d.height;
 const {w:canvasW}=FORMATS[state.format],screenW=$('#artboard').getBoundingClientRect().width||700;
 const unit=canvasW/screenW/l.scale,stroke=1.25*unit,handle=7*unit;
 const g=svgEl('g',{transform:transform(l,w,h),'pointer-events':'none'});
 g.append(svgEl('rect',{x:-w/2,y:-h/2,width:w,height:h,fill:'none',stroke:l.locked?'#a29baa':'#7860d2','stroke-width':stroke,'stroke-dasharray':l.locked?`${4*unit} ${4*unit}`:'none'}));
 if(!l.locked){
  g.append(svgEl('path',{d:`M0 ${-h/2} V${-h/2-24*unit}`,fill:'none',stroke:'#7860d2','stroke-width':stroke}));
  const rotate=svgEl('circle',{cx:0,cy:-h/2-28*unit,r:5*unit,fill:'white',stroke:'#7860d2','stroke-width':stroke,'data-handle':'rotate','pointer-events':'all',cursor:'grab'});g.append(rotate);
  for(const [x,y,handleType] of [[-w/2,-h/2,'scale'],[w/2,-h/2,'scale'],[-w/2,h/2,'scale'],[w/2,h/2,'scale']])g.append(svgEl('rect',{x:x-handle/2,y:y-handle/2,width:handle,height:handle,rx:unit,fill:'white',stroke:'#7860d2','stroke-width':stroke,'data-handle':handleType,'pointer-events':'all',cursor:'nwse-resize'}));
 }
 overlay.append(g);$('#canvas-hint').textContent=l.locked?'Объект заблокирован. Снимите блокировку в свойствах.':'Перетаскивайте объект. Угловой маркер — размер, верхний — поворот.';
}
function thumbnail(layer,context='thumb'){
 const d=dimensions(layer,state,manifest),g=objectNode({...layer,x:0,y:0,scale:1,rotation:0},state,manifest,context+Math.random().toString(36).slice(2));
 g.setAttribute('transform','translate(0 0)');const root=svgEl('svg',{viewBox:`${-d.width/2} ${-d.height/2} ${d.width} ${d.height}`,width:d.width,height:d.height,'aria-hidden':'true'});root.append(g);return root;
}
function renderLibrary(){
 const filter=normalize($('#library-search').value),library=$('#library');library.replaceChildren();
 for(const item of CATALOG.filter(a=>!filter||normalize(a.name).includes(filter)||a.topics.some(t=>filter.startsWith(t)))){
  const button=document.createElement('button');button.className='asset-card';button.title=`Добавить: ${item.name}`;button.setAttribute('aria-label',`Добавить объект ${item.name}`);button.dataset.asset=item.id;
  const thumb=document.createElement('span');thumb.className='asset-thumb';thumb.append(thumbnail({uid:item.id,assetId:item.id,role:'main'},'library'));
  const name=document.createElement('span');name.className='asset-name';name.append(document.createTextNode(item.name));name.insertAdjacentHTML('beforeend',icon('plus'));button.append(thumb,name);button.addEventListener('click',()=>addAsset(item.id));library.append(button);
 }
 if(!library.childElementCount){const p=document.createElement('p');p.className='library-note';p.textContent='Такого объекта нет. Попробуйте другое название.';p.style.gridColumn='1/-1';library.append(p);}
}
function renderLayers(){
 const root=$('#layers');root.replaceChildren();$('#object-count').textContent=state.layers.length?`${state.layers.length} на холсте`:'';
 for(const l of [...state.layers].reverse()){
  const button=document.createElement('button');button.className='layer-row'+(l.uid===selected?' active':'');button.setAttribute('role','listitem');button.setAttribute('aria-label',`Выбрать ${assetName(l.assetId)}, ${l.role==='main'?'главный':'фоновый'}`);button.setAttribute('aria-pressed',String(l.uid===selected));
  const preview=document.createElement('span');preview.className='layer-preview';preview.append(thumbnail(l,'layer'));const title=document.createElement('span');title.className='layer-title';title.textContent=assetName(l.assetId);const small=document.createElement('small');small.textContent=l.role==='main'?'Главный объект':'Фоновый объект';title.append(small);button.append(preview,title);button.insertAdjacentHTML('beforeend',icon(l.locked?'lock':'layers'));button.addEventListener('click',()=>select(l.uid));root.append(button);
 }
 if(!state.layers.length){const p=document.createElement('p');p.className='library-note';p.textContent='Здесь появятся объекты композиции.';root.append(p);}
}
function renderInspector(){
 const l=selectedLayer();$('#object-empty').hidden=!!l;$('#object-controls').hidden=!l;
 if(!l)return;
 $('#selected-name').textContent=assetName(l.assetId);$('#object-x').value=Math.round(l.x);$('#object-y').value=Math.round(l.y);$('#object-scale').value=Math.min(300,l.scale*100);$('#scale-value').value=`${Math.round(l.scale*100)}%`;$('#object-rotation').value=((l.rotation+180)%360+360)%360-180;$('#rotation-value').value=`${Math.round(l.rotation)}°`;$('#object-role').value=l.role;$('#lock').innerHTML=icon(l.locked?'lock':'unlock');$('#lock').setAttribute('aria-label',l.locked?'Разблокировать объект':'Заблокировать объект');$('#lock').title=l.locked?'Разблокировать':'Заблокировать';
 for(const el of $$('#object-controls input,#object-role,#layer-up,#layer-down'))el.disabled=l.locked;
 $('#delete').disabled=l.locked;
}
function renderPalettes(){
 const root=$('#palettes');root.replaceChildren();const options=[...PALETTES];if(!options.some(p=>JSON.stringify(p.colors)===JSON.stringify(state.palette.colors)))options.push(state.palette);
 for(const p of options){const active=JSON.stringify(p.colors)===JSON.stringify(state.palette.colors),b=document.createElement('button');b.className='palette-button';b.setAttribute('aria-pressed',String(active));b.setAttribute('aria-label',`Палитра ${p.name}`);const colors=document.createElement('span');colors.className='palette-colors';for(const c of p.colors.slice(0,6)){const swatch=document.createElement('span');swatch.style.backgroundColor=c;colors.append(swatch);}const name=document.createElement('span');name.className='palette-name';name.textContent=p.name;b.append(colors,name);if(active)b.insertAdjacentHTML('beforeend',icon('check'));b.addEventListener('click',()=>{state.palette=structuredClone(p);commit();});root.append(b);}
 const slots=$('#color-slots');slots.replaceChildren();const labels=['Фон 1','Фон 2','Фон 3','Акцент 1','Акцент 2','Акцент 3','Контур','Светлый'];
 state.palette.colors.forEach((color,i)=>{const label=document.createElement('label');label.className='color-slot';const input=document.createElement('input');input.type='color';input.value=color;input.setAttribute('aria-label',labels[i]);input.addEventListener('input',()=>{invalidatePending();state.palette.colors[i]=input.value;state.palette.name='Своя палитра';renderScene();renderVariants();});input.addEventListener('change',()=>{commit();});label.append(input,document.createTextNode(labels[i]));slots.append(label);});
}
function renderVariants(){
 const root=$('#variants');root.replaceChildren();const names=['Собранно','По диагонали','Под заголовок'];
 for(let i=0;i<3;i++){const b=document.createElement('button');b.className='variant-card'+(activeVariant===i?' active':'');b.setAttribute('aria-label',`Композиция ${names[i]}`);b.setAttribute('aria-pressed',String(activeVariant===i));const thumb=document.createElement('span');thumb.className='variant-thumb';const preview=makeScene({...state,layers:composition(i)},manifest,{prefix:'variant'+i});thumb.append(preview);const label=document.createElement('span');label.className='variant-label';label.append(document.createTextNode(names[i]));label.insertAdjacentHTML('beforeend',`<span class="variant-check">${icon('check')}</span>`);b.append(thumb,label);b.addEventListener('click',()=>{state.layers=composition(i);activeVariant=i;commit();});root.append(b);}
}
function renderAll(){
 if(!ready)return;$('#project-title').value=state.title;$('#format').value=state.format;$('#canvas-background').checked=state.background;$$('[data-size]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.size===state.size)));if(!state.layers.some(l=>l.uid===selected))selected=null;
 renderScene();renderLibrary();renderPalettes();renderLayers();renderInspector();renderVariants();renderHistory();$('#export').disabled=!state.layers.length;
}
function select(id){selected=id;renderSelection();renderLayers();renderInspector();}
function addAsset(id){
 if(!ready)return;if(state.layers.length>=40)return toast('На холсте может быть не более 40 объектов.',true);
 const {w,h}=FORMATS[state.format],d=manifest.find(a=>a.id===id).variants[state.size].main,s=Math.min(w*.35/d.width,h*.55/d.height),layer={uid:uid(),assetId:id,role:'main',x:(w-d.width*s)/2,y:(h-d.height*s)/2,scale:s,rotation:0,locked:false};state.layers.push(layer);selected=layer.uid;activeVariant=-1;commit();toast(`${assetName(id)}: добавлено на холст`);
}
function deleteSelected(){const l=selectedLayer();if(!l||l.locked)return;state.layers=state.layers.filter(a=>a.uid!==selected);selected=null;activeVariant=-1;commit();}
function duplicateSelected(){const l=selectedLayer();if(!l)return;if(state.layers.length>=40)return toast('На холсте может быть не более 40 объектов.',true);const copy={...l,uid:uid(),x:l.x+35,y:l.y+35,locked:false};state.layers.push(copy);selected=copy.uid;activeVariant=-1;commit();}
function moveLayer(direction){const l=selectedLayer();if(!l||l.locked)return;const i=state.layers.indexOf(l),next=i+direction;if(next<0||next>=state.layers.length)return;[state.layers[i],state.layers[next]]=[state.layers[next],state.layers[i]];activeVariant=-1;commit();}
function restore(which){if(!history)return;invalidatePending();state=history[which]();selected=null;activeVariant=-1;persistence();renderAll();}

// One pointer gesture is one undo step. SVG coordinates remain stable at every zoom.
let gesture=null;
function point(event){return new DOMPoint(event.clientX,event.clientY).matrixTransform($('#artboard').getScreenCTM().inverse());}
$('#artboard').addEventListener('pointerdown',event=>{
 if(!ready||event.button!==0)return;const handle=event.target.closest('[data-handle]')?.dataset.handle,target=event.target.closest('[data-uid]');
 if(!handle&&!target){select(null);return;}const l=handle?selectedLayer():state.layers.find(l=>l.uid===target.dataset.uid);if(!l)return;
 select(l.uid);if(l.locked)return;invalidatePending();event.preventDefault();$('#artboard').setPointerCapture(event.pointerId);
 const p=point(event),d=dimensions(l,state,manifest),cx=l.x+d.width*l.scale/2,cy=l.y+d.height*l.scale/2;
 gesture={id:l.uid,type:handle||'move',start:structuredClone(l),p,cx,cy,d,distance:Math.hypot(p.x-cx,p.y-cy),angle:Math.atan2(p.y-cy,p.x-cx)};
});
$('#artboard').addEventListener('pointermove',event=>{
 if(!gesture)return;const l=selectedLayer();if(!l)return;const p=point(event),g=gesture;
 if(g.type==='move'){l.x=g.start.x+p.x-g.p.x;l.y=g.start.y+p.y-g.p.y;}
 else if(g.type==='scale'){l.scale=Math.min(10,Math.max(.02,g.start.scale*Math.hypot(p.x-g.cx,p.y-g.cy)/Math.max(1,g.distance)));l.x=g.cx-g.d.width*l.scale/2;l.y=g.cy-g.d.height*l.scale/2;}
 else{let rotation=g.start.rotation+(Math.atan2(p.y-g.cy,p.x-g.cx)-g.angle)*180/Math.PI;if(event.shiftKey)rotation=Math.round(rotation/15)*15;l.rotation=Math.round(rotation*10)/10;}
 const item=$$('#scene > [data-uid]').find(e=>e.dataset.uid===l.uid);item?.setAttribute('transform',transform(l,g.d.width,g.d.height));renderSelection();renderInspector();
});
function endGesture(event){if(!gesture)return;gesture=null;activeVariant=-1;if($('#artboard').hasPointerCapture(event.pointerId))$('#artboard').releasePointerCapture(event.pointerId);commit();}
$('#artboard').addEventListener('pointerup',endGesture);$('#artboard').addEventListener('pointercancel',endGesture);

$$('[data-mode]').forEach(button=>button.addEventListener('click',()=>{
 invalidatePending();mode=button.dataset.mode;$$('[data-mode]').forEach(b=>b.setAttribute('aria-selected',String(b===button)));$('#prompt-label').textContent=mode==='idea'?'Метафора или заголовок':'Названия компонентов';$('#prompt').placeholder=mode==='idea'?'Например, вырастить идею':'Например, книга, лампа и ручка';$('#prompt').value=mode==='idea'?'Знания, которые вдохновляют':'Книга, лампа и ручка';$('#prompt-examples').hidden=mode==='objects';$('#use-ai').disabled=mode==='objects'||!aiAvailable;message(mode==='objects'?'Назовите предметы через запятую. Неизвестные названия покажем отдельно.':'Объекты из исходной библиотеки. Без генерации новых форм.');
}));
$$('[data-prompt]').forEach(b=>b.addEventListener('click',()=>{invalidatePending();$('#prompt').value=b.dataset.prompt;$('#prompt').focus();}));
$('#prompt').addEventListener('input',invalidatePending);
$('#prompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#compose-form').requestSubmit();}});
$('#compose-form').addEventListener('submit',async event=>{
 event.preventDefault();if(!ready)return;const text=$('#prompt').value.trim();if(!text)return message('Введите идею или названия объектов.',true);
 const button=$('#build'),label=$('#build-label'),version=++requestVersion;button.disabled=true;label.textContent='Подбираем объекты…';requestController?.abort();const controller=new AbortController();requestController=controller;
 let result;
 try{
  if(mode==='idea'&&$('#use-ai').checked&&aiAvailable){
   const timeout=setTimeout(()=>controller.abort(),35000);
   try{const response=await fetch(apiEndpoint('resolve',API_BASE),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text}),signal:controller.signal});const data=await response.json();if(!response.ok)throw Error(data.error||'Сервис подбора временно недоступен');result=data;}finally{clearTimeout(timeout);}
  }else result=resolveInput(text,mode);
  if(version!==requestVersion)return;
  if(result.unknown?.length)return message(`Нет в библиотеке: ${result.unknown.join(', ')}. Уточните список — композицию пока не изменили.`,true);
  if(!result.ids?.length)return message(result.explanation||'Подходящих объектов нет. Уточните идею или выберите предметы вручную.',true);
  if(!result.ids.every(id=>CATALOG.some(a=>a.id===id))||result.ids.length>(mode==='objects'?CATALOG.length:6))throw Error('Получен некорректный подбор. Попробуйте ещё раз.');
  buildFromIds(result.ids);commit({fromBuild:true});message(`${result.engine==='deepseek'?'DeepSeek: ':''}${result.explanation||'Объекты подобраны.'} ${result.ids.map(assetName).join(', ')}.`);
 }catch(error){if(version!==requestVersion)return;message(error.name==='AbortError'?'Подбор занял слишком много времени. Повторите или выключите умный подбор.':`${error.message}. Можно выключить умный подбор и выбрать тему или объекты.`,true);}
 finally{if(version===requestVersion){requestController=null;button.disabled=false;label.textContent='Собрать композицию';}}
});

$('#project-title').addEventListener('change',()=>{state.title=$('#project-title').value.trim()||'Новая композиция';commit();});
$('#library-search').addEventListener('input',()=>ready&&renderLibrary());
$('#format').addEventListener('change',()=>{const old=FORMATS[state.format];state.format=$('#format').value;const next=FORMATS[state.format],s=Math.min(next.w/old.w,next.h/old.h);for(const l of state.layers){l.x=l.x*s+(next.w-old.w*s)/2;l.y=l.y*s+(next.h-old.h*s)/2;l.scale*=s;}activeVariant=-1;zoom=1;commit();});
$$('[data-size]').forEach(b=>b.addEventListener('click',()=>{if(!ready||state.size===b.dataset.size)return;const old=state.size;state.size=b.dataset.size;for(const l of state.layers){const a=manifest.find(a=>a.id===l.assetId),from=a.variants[old][l.role],to=a.variants[state.size][l.role],cx=l.x+from.width*l.scale/2,cy=l.y+from.height*l.scale/2;l.scale*=Math.min(from.width/to.width,from.height/to.height);l.x=cx-to.width*l.scale/2;l.y=cy-to.height*l.scale/2;}commit();}));
$('#canvas-background').addEventListener('change',()=>{state.background=$('#canvas-background').checked;commit();});
$('#undo').addEventListener('click',()=>restore('undo'));$('#redo').addEventListener('click',()=>restore('redo'));
$('#recompose').addEventListener('click',()=>{if(!ready||!state.layers.length)return;activeVariant=(activeVariant+1)%3;state.layers=composition(activeVariant);commit();});
$('#toggle-grid').addEventListener('click',()=>{const b=$('#toggle-grid'),visible=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',visible);b.setAttribute('aria-label',visible?'Скрыть сетку':'Показать сетку');$('#canvas-area').classList.toggle('no-grid',!visible);});
$('#zoom-in').addEventListener('click',()=>{zoom=Math.min(1.5,zoom+.1);renderScene();});$('#zoom-out').addEventListener('click',()=>{zoom=Math.max(.5,zoom-.1);renderScene();});$('#zoom-reset').addEventListener('click',()=>{zoom=1;renderScene();});
for(const axis of ['x','y'])$('#object-'+axis).addEventListener('change',()=>{const l=selectedLayer(),v=Number($('#object-'+axis).value);if(!l||l.locked)return;if(!Number.isFinite(v)||Math.abs(v)>100000){toast('Введите координату от −100000 до 100000.',true);renderInspector();return;}l[axis]=v;activeVariant=-1;commit();});
for(const prop of ['scale','rotation']){
 $('#object-'+prop).addEventListener('input',()=>{const l=selectedLayer();if(!l||l.locked)return;invalidatePending();const value=Number($('#object-'+prop).value);if(prop==='scale'){const d=dimensions(l,state,manifest),cx=l.x+d.width*l.scale/2,cy=l.y+d.height*l.scale/2;l.scale=value/100;l.x=cx-d.width*l.scale/2;l.y=cy-d.height*l.scale/2;}else l.rotation=value;activeVariant=-1;renderScene();if(prop==='scale')$('#scale-value').value=`${value}%`;else $('#rotation-value').value=`${value}°`;});
 $('#object-'+prop).addEventListener('change',()=>commit());
}
$('#object-role').addEventListener('change',()=>{const l=selectedLayer();if(!l||l.locked)return;const old=dimensions(l,state,manifest);l.role=$('#object-role').value;const next=dimensions(l,state,manifest),cx=l.x+old.width*l.scale/2,cy=l.y+old.height*l.scale/2;l.scale*=Math.min(old.width/next.width,old.height/next.height);l.x=cx-next.width*l.scale/2;l.y=cy-next.height*l.scale/2;if(l.role==='background'){state.layers=state.layers.filter(a=>a.uid!==l.uid);state.layers.unshift(l);}commit();});
$('#duplicate').addEventListener('click',duplicateSelected);$('#delete').addEventListener('click',deleteSelected);$('#layer-up').addEventListener('click',()=>moveLayer(1));$('#layer-down').addEventListener('click',()=>moveLayer(-1));$('#lock').addEventListener('click',()=>{const l=selectedLayer();if(l){l.locked=!l.locked;commit();}});
document.addEventListener('keydown',e=>{
 if(!ready||$('#help-dialog').open||e.target.closest('input,textarea,select,[contenteditable]'))return;
 const ctrl=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();
 if(ctrl&&key==='z'){e.preventDefault();restore(e.shiftKey?'redo':'undo');return;}
 if(ctrl&&key==='y'){e.preventDefault();restore('redo');return;}
 if(ctrl&&key==='d'){e.preventDefault();duplicateSelected();return;}
 if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSelected();return;}
 if(e.key==='Escape'){select(null);return;}
 const l=selectedLayer();if(l&&!l.locked&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const d=e.shiftKey?10:1;if(e.key==='ArrowLeft')l.x-=d;if(e.key==='ArrowRight')l.x+=d;if(e.key==='ArrowUp')l.y-=d;if(e.key==='ArrowDown')l.y+=d;activeVariant=-1;commit();}
});
$('#export').addEventListener('click',()=>{if(!ready||!state.layers.length)return;download(exportSvg(state,manifest),(state.title||'Иллюстрация').replace(/[<>:"/\\|?*]/g,'-')+'.svg','image/svg+xml');toast('SVG скачан. Все объекты остались векторными.');});
$('#project-menu').addEventListener('click',()=>{const open=$('#project-popover').hidden;$('#project-popover').hidden=!open;$('#project-menu').setAttribute('aria-expanded',String(open));});
function closeMenu(){$('#project-popover').hidden=true;$('#project-menu').setAttribute('aria-expanded','false');}
document.addEventListener('click',e=>{if(!e.target.closest('#project-menu,#project-popover'))closeMenu();});
$('#save-project').addEventListener('click',()=>{download(JSON.stringify(state,null,2),'Собрано — '+state.title+'.json','application/json');closeMenu();});
$('#load-project').addEventListener('click',()=>{$('#project-file').click();closeMenu();});
$('#new-project').addEventListener('click',()=>{state=fresh();selected=null;activeVariant=-1;commit();closeMenu();toast('Новая композиция. Предыдущую можно вернуть через «Отменить».');});
$('#project-file').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>200000)throw Error('Файл проекта слишком большой');state=validateProject(await f.text());selected=null;activeVariant=-1;commit();toast('Проект открыт');}catch(error){toast(error.message,true);}finally{e.target.value='';}});
$('#import-palette').addEventListener('click',()=>$('#palette-file').click());
$('#palette-file').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>10000)throw Error('Файл палитры слишком большой');state.palette=parsePalette(await f.text());commit();toast('Палитра применена к композиции');}catch(error){toast(error.message,true);}finally{e.target.value='';}});
$('#save-palette').addEventListener('click',()=>download(JSON.stringify(state.palette,null,2),'Палитра — '+state.palette.name+'.json','application/json'));
for(const id of ['help','help-done','close-help'])$('#'+id).addEventListener('click',()=>id==='help'?$('#help-dialog').showModal():$('#help-dialog').close());
$('#help-dialog').addEventListener('click',e=>{if(e.target===$('#help-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
new ResizeObserver(()=>{if(ready){fitArtboard();renderSelection();}}).observe($('#canvas-area'));
async function checkAi(){
 try{const r=await getWithRetry(apiEndpoint('status',API_BASE),{timeoutMs:8000});const data=await r.json();aiAvailable=!!data.available;if(aiAvailable){$('#use-ai').checked=true;$('#ai-status').textContent='DeepSeek';}else $('#ai-status').textContent='По темам';}
 catch{$('#ai-status').textContent='По темам';}
 $('#use-ai').disabled=!aiAvailable||mode==='objects';$('#use-ai').closest('label').title=aiAvailable?'Смысловой подбор через DeepSeek':'Умный подбор сейчас недоступен. Работает локальный подбор по темам библиотеки.';
}
async function init(){
 try{
  const response=await getWithRetry('./assets/manifest.json');if(!response.ok)throw Error('Не найдена библиотека векторов');const data=await response.json();manifest=Array.isArray(data)?data:data.assets;
  if(!Array.isArray(manifest)||manifest.length!==10)throw Error('Библиотека загружена не полностью');
  await loadAssets(manifest);let restored=false;try{const saved=localStorage.getItem(STORAGE);if(saved){state=validateProject(saved);restored=true;}}catch{toast('Сохранённый проект не удалось открыть. Создана новая композиция.',true);}
  if(!restored)buildFromIds(['book','lamp','pen']);history=new History(state);ready=true;$('#loading').hidden=true;renderAll();persistence();checkAi();
 }catch(error){const loading=$('#loading');loading.replaceChildren();const p=document.createElement('span');p.textContent=error.message+'. ';const b=document.createElement('button');b.className='error-retry';b.textContent='Повторить загрузку';b.addEventListener('click',()=>location.reload());loading.append(p,b);$('#build').disabled=true;$('#export').disabled=true;console.error('Library load failed:',error.message);}
}
init();
