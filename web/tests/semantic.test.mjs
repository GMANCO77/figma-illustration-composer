import test from 'node:test';
import assert from 'node:assert/strict';
import {selectWithDeepSeek,validateTopic,validateSelection} from '../server/semantic.mjs';
test('AI input validates empty, type and maximum topic size',()=>{for(const x of ['',null,[], 'a'.repeat(601)])assert.throws(()=>validateTopic(x));assert.equal(validateTopic('  Вырастить идею  '),'Вырастить идею');});
test('AI cannot introduce unavailable objects or duplicate ids',()=>{for(const ids of [['rocket'],['book','book'],Array(7).fill('book')])assert.throws(()=>validateSelection({ids,explanation:'test'},'Тема'));});
test('AI cannot select explicitly excluded objects',()=>assert.throws(()=>validateSelection({ids:['phone'],explanation:'test'},'Учёба без телефона')));
test('AI can explicitly report an unsupported theme',()=>assert.deepEqual(validateSelection({ids:[],explanation:'Нет подходящих объектов.'},'Осьминог').ids,[]));
test('provider sends only topic and textual catalog and returns valid selection',async()=>{
 let request;const result=await selectWithDeepSeek('Вырастить идею',{apiKey:'test-key',fetchImpl:async(url,init)=>{request=JSON.parse(init.body);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({ids:['flowers','lamp'],explanation:'Рост и вдохновение.'})}}]}));}});
 assert.deepEqual(result.ids,['flowers','lamp']);assert.equal(result.engine,'deepseek');assert.equal(request.messages[1].content,'Вырастить идею');assert.ok(!request.messages[0].content.includes('<svg'));assert.equal(request.thinking.type,'disabled');
});
test('provider failure does not expose provider credentials or body',async()=>{
 await assert.rejects(selectWithDeepSeek('Идея',{apiKey:'SECRET',fetchImpl:async()=>new Response('SECRET',{status:401})}),e=>!e.message.includes('SECRET')&&e.message.includes('недоступен'));
});
test('truncated response and invalid JSON fail clearly',async()=>{
 for(const choice of [{finish_reason:'length',message:{content:'{}'}},{finish_reason:'stop',message:{content:'not-json'}}])await assert.rejects(selectWithDeepSeek('Идея',{apiKey:'test',fetchImpl:async()=>new Response(JSON.stringify({choices:[choice]}))}));
});

