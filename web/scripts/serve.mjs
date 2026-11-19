import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import resolveHandler from '../api/resolve.js';
import statusHandler from '../api/status.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
 res.status=code=>{res.statusCode=code;return res;};res.json=obj=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(obj));};
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/status')return statusHandler(req,res);
 if(url.pathname==='/api/resolve'){let chunks='',large=false;for await(const chunk of req){chunks+=chunk;if(chunks.length>5000){large=true;break;}}if(large)return res.status(413).json({error:'Слишком большой запрос'});try{req.body=JSON.parse(chunks);}catch{return res.status(400).json({error:'Некорректный JSON'});}return resolveHandler(req,res);}
 if(!['GET','HEAD'].includes(req.method))return res.status(405).end();
 let rel;try{rel=decodeURIComponent(url.pathname);}catch{return res.status(400).end();}
 const file=path.resolve(root,'.'+(rel==='/'?'/index.html':rel));
 if(!file.startsWith(root+path.sep)||rel.split('/').some(p=>p.startsWith('.'))||/\/(server|api|tests|docs|scripts)\//.test(rel))return res.status(403).end();
 try{const content=await fs.readFile(file);res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.statusCode=200;res.end(req.method==='HEAD'?undefined:content);}catch{res.statusCode=404;res.end('Not found');}
});
server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+server.address().port));

