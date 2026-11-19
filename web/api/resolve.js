import {selectWithDeepSeek,validateTopic} from '../server/semantic.mjs';
import {applyCors} from '../server/cors.mjs';
const cache=new Map(),clients=new Map();let instanceWindow=Date.now(),instanceCount=0;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(applyCors(req,res,'POST'))return;
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Метод не поддерживается'});}
 if(!String(req.headers['content-type']||'').includes('application/json'))return res.status(415).json({error:'Нужен запрос JSON'});
 if(Number(req.headers['content-length']||0)>5000)return res.status(413).json({error:'Слишком большой запрос'});
 let text;try{const body=typeof req.body==='string'?JSON.parse(req.body):req.body;text=validateTopic(body?.text);}catch(error){return res.status(400).json({error:error.message});}
 if(!process.env.DEEPSEEK_API_KEY)return res.status(503).json({error:'Умный подбор не настроен. Используйте подбор по темам'});
 const now=Date.now(),ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
 for(const [key,value]of clients)if(now-value.time>600000)clients.delete(key);
 const client=clients.get(ip)||{time:now,count:0};client.count++;clients.set(ip,client);
 if(now-instanceWindow>3600000){instanceWindow=now;instanceCount=0;}
 if(client.count>12||instanceCount>=120){res.setHeader('Retry-After','60');return res.status(429).json({error:'Достигнут лимит подбора. Попробуйте позже или выключите умный подбор'});}
 const key=text.toLowerCase(),saved=cache.get(key);if(saved&&now-saved.time<3600000)return res.json(saved.data);
 instanceCount++;
 try{const data=await selectWithDeepSeek(text,{apiKey:process.env.DEEPSEEK_API_KEY,model:process.env.DEEPSEEK_MODEL||'deepseek-flash'});if(cache.size>150)cache.delete(cache.keys().next().value);cache.set(key,{time:now,data});return res.json(data);}
 catch(error){return res.status(502).json({error:error.message});}
}
