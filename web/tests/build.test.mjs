import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
test('clean hosted build unpacks all original vectors and publishes only the editor',async()=>{
 await fs.mkdir('test-artifacts',{recursive:true});const dir=await fs.mkdtemp(path.resolve('test-artifacts/clean-build-'));
 for(const f of ['index.html','styles.css','styles-refinements.css','favicon.svg','assets.bundle.gz'])await fs.copyFile(f,path.join(dir,f));
 await fs.cp('src',path.join(dir,'src'),{recursive:true});await fs.cp('scripts',path.join(dir,'scripts'),{recursive:true});
 const result=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:dir,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const published=await fs.readdir(path.join(dir,'dist/assets'));assert.equal(published.filter(x=>x.endsWith('.svg')).length,40);
 for(const name of published.filter(x=>x.endsWith('.svg'))){const original=await fs.readFile(path.join('assets',name)),built=await fs.readFile(path.join(dir,'dist/assets',name));assert.equal(createHash('sha256').update(built).digest('hex'),createHash('sha256').update(original).digest('hex'));}
 await assert.rejects(fs.access(path.join(dir,'dist/.env')));await assert.rejects(fs.access(path.join(dir,'dist/server')));
});

