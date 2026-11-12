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
