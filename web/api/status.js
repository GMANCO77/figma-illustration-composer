import {applyCors} from '../server/cors.mjs';
export default function handler(req,res){res.setHeader('Cache-Control','no-store');if(applyCors(req,res,'GET'))return;if(req.method!=='GET')return res.status(405).json({error:'Метод не поддерживается'});res.json({available:!!process.env.DEEPSEEK_API_KEY,provider:process.env.DEEPSEEK_API_KEY?'DeepSeek':null});}
