import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {normalizeApiBase} from './config.mjs';
try{await fs.access('assets/manifest.json');}catch{const files=JSON.parse(gunzipSync(await fs.readFile('assets.bundle.gz')).toString('utf8'));await fs.mkdir('assets',{recursive:true});for(const [name,text]of Object.entries(files)){if(!/^[a-z0-9-]+\.(svg|json)$/i.test(name))throw Error('Invalid asset path');await fs.writeFile(path.join('assets',name),text);}}
const target=path.resolve('dist');await fs.mkdir(target,{recursive:true});
for(const file of ['index.html','styles.css','styles-refinements.css','favicon.svg'])await fs.copyFile(file,path.join(target,file));
for(const dir of ['src','assets'])await fs.cp(dir,path.join(target,dir),{recursive:true});
const apiBase=normalizeApiBase(process.env.PUBLIC_API_BASE||'');
await fs.writeFile(path.join(target,'src/site-config.mjs'),'// Public server origin; contains no credentials.\nexport const API_BASE='+JSON.stringify(apiBase)+';\n');
await fs.writeFile(path.join(target,'.nojekyll'),'');
console.log('Built static editor in dist/; Vercel API functions stay outside the public directory.');
