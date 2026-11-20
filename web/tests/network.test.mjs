import test from 'node:test';
import assert from 'node:assert/strict';
import {getWithRetry} from '../src/network.mjs';
test('a temporary GitHub503 asset response is retried and succeeds',async()=>{let count=0;const delays=[];const r=await getWithRetry('/asset.svg',{fetchImpl:async()=>new Response(++count===1?'Unavailable':'<svg/>',{status:count===1?503:200}),sleep:async ms=>delays.push(ms)});assert.equal(r.status,200);assert.equal(await r.text(),'<svg/>');assert.equal(count,2);assert.deepEqual(delays,[250]);});
test('network failure is retried with a fresh request',async()=>{let count=0;const r=await getWithRetry('/manifest.json',{fetchImpl:async()=>{if(++count===1)throw new TypeError('network');return new Response('[]');},sleep:async()=>{}});assert.equal(r.status,200);assert.equal(count,2);});
test('missing files are not repeatedly requested',async()=>{let count=0;const r=await getWithRetry('/missing.svg',{fetchImpl:async()=>{count++;return new Response('',{status:404});},sleep:async()=>{}});assert.equal(r.status,404);assert.equal(count,1);});
test('persistent service failure stops after three attempts',async()=>{let count=0;const r=await getWithRetry('/asset.svg',{fetchImpl:async()=>{count++;return new Response('',{status:503});},sleep:async()=>{}});assert.equal(r.status,503);assert.equal(count,3);});
test('retry helper only performs GET requests',async()=>{let method;await getWithRetry('/asset.svg',{fetchImpl:async(_url,init)=>{method=init.method;return new Response('ok');}});assert.equal(method,'GET');});
