import {PALETTES,FORMATS} from './core.mjs';
const NS='http://www.w3.org/2000/svg';
export const svgEl=(tag,attrs={})=>{const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
export const templates=new Map();
function hex(v){v=v.toLowerCase().trim();if(v==='white')return '#ffffff';if(v==='black')return '#000000';if(/^#[\da-f]{3}$/.test(v))return '#'+[...v.slice(1)].map(c=>c+c).join('');return v;}
function slot(color,role){
 const aliases={'#171409':6,'#171714':6,'#000000':6,'#d9d9d9':7,'#eee2f6':0};
 let s=PALETTES[0].colors.indexOf(color);if(s<0&&color in aliases)s=aliases[color];
 if(role==='background'&&s>=3)s=s===6?2:0;
 return s;
}
export function prepareSvg(text,role){
 const doc=new DOMParser().parseFromString(text,'image/svg+xml');
 if(doc.querySelector('parsererror')||doc.documentElement.localName!=='svg')throw Error('Не удалось прочитать исходный SVG');
 if(doc.querySelector('script,foreignObject,image'))throw Error('В библиотеке обнаружен неподдерживаемый объект');
 for(const e of [doc.documentElement,...doc.querySelectorAll('*')]){
  for(const attr of [...e.attributes])if(/^on/i.test(attr.name)||((attr.localName==='href'||attr.name==='src')&&!attr.value.startsWith('#')))e.removeAttribute(attr.name);
  for(const prop of ['fill','stroke','stop-color']){const value=e.getAttribute(prop);if(value){const s=slot(hex(value),role);if(s>=0)e.setAttribute('data-'+prop+'-slot',s);}}
 }
 return doc.documentElement;
}
export async function loadAssets(manifest){
 const jobs=[];for(const item of manifest)for(const size of ['S','L'])for(const role of ['main','background'])jobs.push({id:item.id,size,role,...item.variants[size][role]});
 let cursor=0;
 await Promise.all(Array.from({length:6},async()=>{while(cursor<jobs.length){const a=jobs[cursor++],r=await fetch('./assets/'+a.file);if(!r.ok)throw Error('Не удалось загрузить '+a.file);templates.set(`${a.id}-${a.size}-${a.role}`,prepareSvg(await r.text(),a.role));}}));
}
export function dimensions(layer,state,manifest){const a=manifest.find(a=>a.id===layer.assetId);return a.variants[state.size][layer.role];}
export function recolor(root,palette){
 for(const e of [root,...root.querySelectorAll('*')])for(const p of ['fill','stroke','stop-color']){const s=e.getAttribute('data-'+p+'-slot');if(s!==null)e.setAttribute(p,palette.colors[Number(s)]);}
}
export function objectNode(layer,state,manifest,prefix='scene'){
 const {width:w,height:h}=dimensions(layer,state,manifest),key=`${layer.assetId}-${state.size}-${layer.role}`;
 const original=templates.get(key);if(!original)throw Error('Исходный объект недоступен: '+key);
 const root=original.cloneNode(true),uid=`${prefix}-${layer.uid}-`;
 const idMap=new Map([...root.querySelectorAll('[id]')].map(e=>[e.id,uid+e.id]));
 for(const e of [root,...root.querySelectorAll('*')])for(const a of [...e.attributes]){
  if(a.name==='id'&&idMap.has(a.value))e.setAttribute('id',idMap.get(a.value));
  else if(a.value.includes('url(#'))e.setAttribute(a.name,a.value.replace(/url\(#([^)]+)\)/g,(m,id)=>`url(#${idMap.get(id)||id})`));
  else if((a.name==='href'||a.name==='xlink:href')&&a.value.startsWith('#'))e.setAttribute(a.name,'#'+(idMap.get(a.value.slice(1))||a.value.slice(1)));
 }
 root.setAttribute('width',w);root.setAttribute('height',h);root.setAttribute('x',-w/2);root.setAttribute('y',-h/2);root.setAttribute('overflow','visible');
 recolor(root,state.palette);
 const g=svgEl('g',{'data-uid':layer.uid,'data-asset':layer.assetId,'data-role':layer.role,transform:transform(layer,w,h)});g.append(root);return g;
}
export function transform(l,w,h){return `translate(${l.x+w*l.scale/2} ${l.y+h*l.scale/2}) rotate(${l.rotation}) scale(${l.scale})`;}
export function makeScene(state,manifest,{prefix='scene'}={}){
 const {w,h}=FORMATS[state.format],root=svgEl('svg',{xmlns:NS,viewBox:`0 0 ${w} ${h}`,width:w,height:h});
 if(state.background)root.append(svgEl('rect',{x:0,y:0,width:w,height:h,fill:state.palette.colors[0],'data-canvas-background':'true'}));
 for(const layer of state.layers)root.append(objectNode(layer,state,manifest,prefix));
 return root;
}
export function exportSvg(state,manifest){
 const root=makeScene(state,manifest,{prefix:'export'}),title=svgEl('title');title.textContent=state.title;root.prepend(title);
 for(const e of [root,...root.querySelectorAll('*')])for(const a of [...e.attributes])if(a.name.startsWith('data-'))e.removeAttribute(a.name);
 return '<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(root);
}
export function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}

