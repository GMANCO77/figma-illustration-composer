const allowedOrigins=new Set(['https://gmanco77.github.io']);
export function applyCors(req,res,method){
 const origin=req.headers.origin;
 if(origin){
  let allowed=false;
  try{const url=new URL(origin);allowed=url.origin===origin&&(url.host===req.headers.host||allowedOrigins.has(origin));}catch{}
  if(!allowed){res.status(403).json({error:'Запрос с другого сайта запрещён'});return true;}
  res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
 }
 if(req.method==='OPTIONS'){
  res.setHeader('Access-Control-Allow-Methods',method+', OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Max-Age','600');res.status(204).end();return true;
 }
 return false;
}
