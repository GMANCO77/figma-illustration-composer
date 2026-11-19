import fs from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
const files={};for(const name of(await fs.readdir('assets')).sort())if(/\.(svg|json)$/.test(name))files[name]=await fs.readFile('assets/'+name,'utf8');
await fs.writeFile('assets.bundle.gz',gzipSync(JSON.stringify(files),{level:9}));console.log('Packed',Object.keys(files).length,'original asset files');

