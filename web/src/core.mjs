export const CATALOG = [
 {id:'book',name:'Книга',aliases:['книг','книж','учебник','book'],topics:['уч','знан','образован','чит','развит','изуч','мудрост','навык']},
 {id:'phone',name:'Телефон',aliases:['телефон','смартфон','phone','smartphone'],topics:['технолог','связ','общен','приложен','цифр','онлайн','коммуникац','контакт']},
 {id:'puzzle',name:'Пазлы',aliases:['пазл','puzzle'],topics:['команд','сотруднич','решен','задач','систем','вмест','един','собра','собер','разрознен','объедин','связ']},
 {id:'coin',name:'Монета',aliases:['монет','coin'],topics:['деньг','финанс','доход','инвест','бюджет','прибыл','капитал','эконом']},
 {id:'headphones',name:'Наушники',aliases:['наушник','headphone'],topics:['музык','звук','слуш','отдых','фокус','подкаст','слыш','вниман']},
 {id:'lamp',name:'Лампа',aliases:['ламп','lamp'],topics:['иде','свет','вдохнов','работ','фокус','озарен','креатив','ясност','освет']},
 {id:'wallet',name:'Кошелёк',aliases:['кошел','wallet'],topics:['деньг','финанс','бюджет','накоп','оплат','сбереж','покуп','эконом','сохран']},
 {id:'folder',name:'Папка',aliases:['папк','folder'],topics:['документ','поряд','организац','работ','архив','структур','управл','хран','проект']},
 {id:'pen',name:'Ручка',aliases:['ручк','pen'],topics:['пис','творче','уч','замет','план','созда','автор','запис','сочин']},
 {id:'flowers',name:'Цветы',aliases:['цвет','букет','flower'],topics:['рост','раст','выраст','забот','подар','празд','красот','развит','выращ','расцвет','поддерж','благодар']},
];
export const PALETTES = [
 {name:'Лаванда',colors:['#d7cdf5','#aa9bf0','#7864d7','#f9ecb0','#f9a3aa','#ffe3e1','#181817','#ffffff']},
 {name:'Персик',colors:['#fdd7b9','#fac896','#d27532','#f9ecb0','#80dada','#beebeb','#181817','#ffffff']},
 {name:'Мята',colors:['#beebeb','#80dada','#5abebe','#ffd4f2','#6d7bfc','#b6c6fe','#181817','#ffffff']},
];
export const FORMATS={wide:{name:'Горизонтальный',w:1200,h:675,label:'16:9'},square:{name:'Квадрат',w:1080,h:1080,label:'1:1'},poster:{name:'Пост',w:1080,h:1440,label:'3:4'},story:{name:'История',w:1080,h:1920,label:'9:16'}};
export const normalize = s=>String(s??'').toLowerCase().replace(/ё/g,'е').trim();
const words=s=>normalize(s).match(/[\p{L}\p{N}-]+/gu)||[];
const matches=(word,stems)=>stems.some(s=>word.startsWith(s));
const nounPatterns={
 book:/^(?:книг(?:а|и|у|е|ой|ою|ам|ами|ах)?|книжк(?:а|и|у|е|ой|ам|ами|ах)|учебник(?:и|а|у|ом|е|ов|ам|ами|ах)?|books?)$/u,
 phone:/^(?:(?:телефон|смартфон)(?:ы|а|у|ом|е|ов|ам|ами|ах)?|phones?|smartphones?)$/u,
 puzzle:/^(?:пазл(?:ы|а|у|ом|е|ов|ам|ами|ах)?|puzzles?)$/u,
 coin:/^(?:монет(?:а|ы|у|е|ой|ою|ам|ами|ах)?|coins?)$/u,
 headphones:/^(?:наушник(?:и|а|у|ом|е|ов|ам|ами|ах)?|headphones?)$/u,
 lamp:/^(?:ламп(?:а|ы|у|е|ой|ою|ам|ами|ах)?|lamps?)$/u,
 wallet:/^(?:кошел(?:ек|ьк(?:а|у|ом|е|и|ов|ам|ами|ах))|wallets?)$/u,
 folder:/^(?:папк(?:а|и|у|е|ой|ою|ам|ами|ах)?|папок|folders?)$/u,
 pen:/^(?:ручк(?:а|и|у|е|ой|ою|ам|ами|ах)?|ручек|pens?)$/u,
 flowers:/^(?:цвет(?:ы|ок|ка|ку|ком|ке|ков|ов|ам|ами|ах)|букет(?:ы|а|у|ом|е|ов|ам|ами|ах)?|flowers?)$/u,
};
const isObject=(word,a)=>nounPatterns[a.id]?.test(word)??matches(word,a.aliases);
function exclusionClauses(text){
 const q=normalize(text).replace(/не\s+только\s+/gu,''),result=[];
 const rx=/(?:^|[\s,(])(?:без|кроме|исключая|исключить|никаких|никакой|никакого|не(?:\s+(?:добавляй(?:те)?|нужен|нужна|нужны|используй(?:те)?))?)\s+([^.!?;]+)/gu;
 for(const m of q.matchAll(rx)){const clause=m[1].split(/(?:,?\s+)(?:а|но|зато|однако|с|со|добавь(?:те)?|вместо)\s+/u)[0];result.push(clause);}
 return result;
}
export function excludedIds(text,catalog=CATALOG){
 const parts=exclusionClauses(text);return catalog.filter(a=>parts.some(c=>words(c).some(w=>isObject(w,a)))).map(a=>a.id);
}
export function resolveInput(text,mode='idea',catalog=CATALOG){
 const q=normalize(text),excluded=excludedIds(q,catalog),tokens=words(q),ids=[],unknown=[];
 if(mode==='objects'){
  const stop=new Set(['и','с','со','или','and','плюс','добавь','добавьте','нужны','нужна','нужен','объекты','объект','компоненты','без','кроме','исключая','исключить','не','никаких','никакой','никакого','добавляй','добавляйте','используй','используйте','а','но']);
  const chunks=q.split(/[,;\n+]+|\s+(?:и|and|плюс|с|со)\s+/u).map(x=>x.trim()).filter(Boolean);
  for(const chunk of chunks){const ts=words(chunk),found=[];
   for(const w of ts){const a=catalog.find(a=>isObject(w,a));if(a){if(!excluded.includes(a.id)&&!ids.includes(a.id))ids.push(a.id);found.push(w);}}
   const rest=ts.filter(w=>!found.includes(w)&&!stop.has(w)&&!/^\d+$/.test(w));if(rest.length)unknown.push(rest.join(' '));
  }
 }else{
  const ranked=catalog.map((a,index)=>({id:a.id,index,score:tokens.reduce((s,w)=>s+(isObject(w,a)?8:matches(w,a.topics)?2:0),0)}))
   .filter(a=>a.score>0&&!excluded.includes(a.id)).sort((a,b)=>b.score-a.score||a.index-b.index);
  ids.push(...ranked.slice(0,4).map(a=>a.id));
 }
 return {ids,unknown:[...new Set(unknown)],excluded,engine:'local',explanation:ids.length?'Подобрано по названиям и темам библиотеки.':'Подходящих объектов в библиотеке не найдено.'};
}

// Place the original shapes as a group. Every object receives one common scale.
export function planLayout(entries,w,h,variant=0){
 if(!entries.length)return [];
 if(!Number.isFinite(w)||!Number.isFinite(h)||w<100||h<100)throw Error('Некорректный размер холста');
 if(entries.some(e=>!(e.w>0)||!(e.h>0)||!Number.isFinite(e.w+e.h)))throw Error('Некорректный размер объекта');
 const v=((variant%3)+3)%3,fg=entries.filter(e=>e.role!=='background'),bg=entries.filter(e=>e.role==='background');
 const order=fg.length?fg:[bg.shift()],placed=[];
 const hero=order[0];placed.push({...hero,x:0,y:0});
 for(let i=1;i<order.length;i++){
  const e=order[i],prev=placed[i-1];
  const positions=[
   {x:prev.x+prev.w*.78,y:prev.y+prev.h-e.h*.94},
   {x:prev.x+prev.w*.65,y:prev.y-e.h*.56},
   {x:i%2?prev.x+prev.w*.63:prev.x-e.w*.2,y:prev.y+prev.h*.7},
  ]; placed.push({...e,...positions[v]});
 }
 for(let i=0;i<bg.length;i++){
  const e=bg[i],x=v===1?-e.w*.44:hero.w*.52+i*e.w*.36,y=v===0?-e.h*.35:hero.h*.45+i*e.h*.18;placed.push({...e,x,y});
 }
 const x=Math.min(...placed.map(e=>e.x)),y=Math.min(...placed.map(e=>e.y));
 const bw=Math.max(...placed.map(e=>e.x+e.w))-x,bh=Math.max(...placed.map(e=>e.y+e.h))-y;
 const wide=w/h>1.15,box=v===2?(wide?{x:w*.44,y:h*.10,w:w*.50,h:h*.80}:{x:w*.08,y:h*.34,w:w*.84,h:h*.58}):{x:w*.09,y:h*.09,w:w*.82,h:h*.82};
 const scale=Math.min(box.w/bw,box.h/bh),ox=box.x+(box.w-bw*scale)/2,oy=box.y+(box.h-bh*scale)/2;
 return placed.map(e=>({...e,x:ox+(e.x-x)*scale,y:oy+(e.y-y)*scale,scale,rotation:0})).sort((a,b)=>(a.role!=='background')-(b.role!=='background'));
}
export function parsePalette(input){
 let p;try{p=typeof input==='string'?JSON.parse(input):input;}catch{throw Error('Не удалось прочитать JSON палитры');}
 if(!p||typeof p.name!=='string'||!p.name.trim()||!Array.isArray(p.colors)||p.colors.length!==8||p.colors.some(c=>typeof c!=='string'||!/^#[0-9a-f]{6}$/i.test(c)))throw Error('В палитре нужны название name и восемь цветов colors в формате #RRGGBB');
 return {name:p.name.trim().slice(0,50),colors:p.colors.map(c=>c.toLowerCase())};
}
export function validateProject(input){
 let p;try{p=typeof input==='string'?JSON.parse(input):structuredClone(input);}catch{throw Error('Не удалось прочитать файл проекта');}
 if(!p||p.version!==1||typeof p.title!=='string'||p.title.length>120||typeof p.format!=='string'||!Object.hasOwn(FORMATS,p.format)||!['S','L'].includes(p.size)||typeof p.background!=='boolean'||!Array.isArray(p.layers)||p.layers.length>40)throw Error('Это не поддерживаемый проект «Собрано»');
 const palette=parsePalette(p.palette),uids=new Set();
 const layers=p.layers.map(l=>{
  if(!l||typeof l.uid!=='string'||l.uid.length>80||uids.has(l.uid)||!CATALOG.some(a=>a.id===l.assetId)||!['main','background'].includes(l.role)||typeof l.locked!=='boolean')throw Error('Некорректный объект в проекте');
  uids.add(l.uid);
  if(!['x','y','scale','rotation'].every(k=>typeof l[k]==='number'&&Number.isFinite(l[k]))||Math.abs(l.x)>100000||Math.abs(l.y)>100000||l.scale<.001||l.scale>100||Math.abs(l.rotation)>3600)throw Error('Некорректное положение или масштаб объекта');
  return {uid:l.uid,assetId:l.assetId,role:l.role,x:l.x,y:l.y,scale:l.scale,rotation:l.rotation,locked:l.locked};
 });
 return {version:1,title:p.title,format:p.format,size:p.size,palette,background:p.background,layers};
}
export class History{
 constructor(state,limit=80){this.items=[structuredClone(state)];this.index=0;this.limit=limit;}
 get canUndo(){return this.index>0;}
 get canRedo(){return this.index<this.items.length-1;}
 push(state){if(JSON.stringify(state)===JSON.stringify(this.items[this.index]))return;this.items=this.items.slice(0,this.index+1);this.items.push(structuredClone(state));if(this.items.length>this.limit)this.items.shift();this.index=this.items.length-1;}
 undo(){if(this.canUndo)this.index--;return structuredClone(this.items[this.index]);}
 redo(){if(this.canRedo)this.index++;return structuredClone(this.items[this.index]);}
}
