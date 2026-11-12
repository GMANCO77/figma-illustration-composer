const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('built panel has compilable script and no build placeholders',()=>{const html=fs.readFileSync('dist/ui.html','utf8');assert.ok(!html.includes('__CORE__'));const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];assert.doesNotThrow(()=>new vm.Script(code));});
