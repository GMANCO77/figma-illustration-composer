const fs=require('node:fs'),path=require('node:path');fs.mkdirSync('dist',{recursive:true});
const core=fs.readFileSync('src/core.js','utf8'),catalog=fs.readFileSync('src/catalog.json','utf8'),palettes=fs.readFileSync('src/palettes.json','utf8');
fs.writeFileSync('dist/code.js',core+'\n'+fs.readFileSync('src/plugin.js','utf8').replace('__CATALOG__',catalog).replace('__PALETTES__',palettes));
fs.writeFileSync('dist/ui.html',fs.readFileSync('src/ui.html','utf8').replace('__CORE__',core));
fs.copyFileSync('manifest.json','dist/manifest.json');console.log('Built dist/manifest.json, code.js, ui.html');
