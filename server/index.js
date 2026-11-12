const crypto=require('node:crypto'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {selectWithDeepSeek}=require('./provider.js');
function createApp(config={}){
 const apiKey=config.apiKey===undefined?process.env.DEEPSEEK_API_KEY:config.apiKey;
 const token=config.token||crypto.randomBytes(24).toString('hex');
 let lastCall=0,active=false;
 return http.createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(origin&&origin!=='null'&&!/^https:\/\/([a-z0-9-]+\.)?figma\.com$/.test(origin)){res.writeHead(403);res.end();return;}
  if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Composer-Token');
  res.setHeader('Access-Control-Allow-Private-Network','true');
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  if(req.url==='/health'&&req.method==='GET')return send(200,{configured:!!apiKey,provider:'DeepSeek',model:process.env.DEEPSEEK_MODEL||'deepseek-flash'});
  if(req.url!=='/resolve'||req.method!=='POST')return send(404,{error:'Не найдено'});
  if(req.headers['x-composer-token']!==token)return send(403,{error:'Введите локальный код доступа из файла .local-token'});
  let raw='';
  try{
   for await(const chunk of req){raw+=chunk;if(raw.length>12000)return send(413,{error:'Слишком большой запрос'});}
   const data=JSON.parse(raw);
   if(typeof data.text!=='string'||!data.text.trim()||data.text.length>2000)return send(400,{error:'Тема должна содержать от 1 до 2000 символов'});
   if(!apiKey)return send(503,{error:'Добавьте ключ DEEPSEEK_API_KEY в файл .env и перезапустите сервер'});
   if(active||Date.now()-lastCall<2000)return send(429,{error:'Подождите завершения предыдущего запроса'});
   active=true;lastCall=Date.now();
   try{const answer=await selectWithDeepSeek(data.text,{apiKey,model:config.model,fetchImpl:config.fetchImpl});return send(200,answer);}
   finally{active=false;}
  }catch(e){send(e instanceof SyntaxError?400:502,{error:e instanceof SyntaxError?'Некорректный JSON запроса':e.name==='TimeoutError'?'DeepSeek не ответил вовремя. Повторите запрос.':e.message});}
 });
}
function startServer(config={}){
 const token=crypto.randomBytes(24).toString('hex'),app=createApp({...config,token});
 return new Promise((resolve,reject)=>{app.once('error',reject);app.listen(config.port===undefined?3210:config.port,'127.0.0.1',()=>{
  try{fs.writeFileSync(config.tokenFile||path.join(__dirname,'..','.local-token'),token,{mode:0o600});resolve(app);}
  catch(e){app.close(()=>reject(e));}
 });});
}
if(require.main===module){
 const env=path.join(__dirname,'..','.env');if(fs.existsSync(env))process.loadEnvFile(env);
 startServer().then(()=>console.log('Сервер: http://localhost:3210. Ключ: '+(process.env.DEEPSEEK_API_KEY?'настроен':'не добавлен')))
 .catch(e=>{console.error(e.code==='EADDRINUSE'?'Сервер уже запущен. Используйте код из существующего .local-token.':e.message);process.exitCode=1;});
}
module.exports={createApp,startServer};
