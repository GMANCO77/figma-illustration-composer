const fs=require('node:fs'),path=require('node:path');
const C=require('../src/core.js'),catalog=require('../src/catalog.json');
const template=fs.readFileSync(path.join(__dirname,'master-prompt.txt'),'utf8');
function buildPrompt(){return template.replace('{{CATALOG_JSON}}',JSON.stringify(catalog.map(({id,name,tags})=>({id,name,tags}))));}
async function selectWithDeepSeek(text,config={}){
 const model=config.model||process.env.DEEPSEEK_MODEL||'deepseek-flash';
 const request=config.fetchImpl||fetch;
 const response=await request('https://api.deepseek.com/chat/completions',{
  method:'POST',headers:{Authorization:'Bearer '+config.apiKey,'Content-Type':'application/json'},
  signal:AbortSignal.timeout(40000),
  body:JSON.stringify({model,messages:[{role:'system',content:buildPrompt()},{role:'user',content:text}],thinking:{type:'enabled'},reasoning_effort:'high',response_format:{type:'json_object'},max_tokens:2048})
 });
 if(!response.ok)throw Error('DeepSeek: HTTP '+response.status+'. Проверьте ключ, баланс и модель.');
 const data=await response.json(),choice=data.choices&&data.choices[0];
 if(!choice||!choice.message||typeof choice.message.content!=='string')throw Error('DeepSeek вернул пустой ответ');
 if(choice.finish_reason==='length')throw Error('Ответ DeepSeek оборвался. Повторите запрос.');
 let parsed;try{parsed=JSON.parse(choice.message.content);}catch(e){throw Error('DeepSeek вернул некорректный JSON');}
 if(!parsed||!Array.isArray(parsed.ids))throw Error('DeepSeek вернул неверную структуру JSON');
 const explanation=typeof parsed.explanation==='string'?parsed.explanation.slice(0,500):'Объекты подобраны по смыслу.';
 if(!parsed.ids.length)return {ids:[],explanation,model};
 const ids=C.validateIds(parsed.ids,catalog);
 if(ids.length!==parsed.ids.length)throw Error('DeepSeek повторил объекты. Повторите запрос.');
 const excluded=C.excludedIds(text,catalog);
 if(ids.some(id=>excluded.includes(id)))throw Error('DeepSeek выбрал исключённый объект. Уточните запрос.');
 return {ids,explanation,model};
}
module.exports={buildPrompt,selectWithDeepSeek};
