const transient=new Set([408,429,500,502,503,504]);
// Retry idempotent reads only. A paid model POST is never retried automatically.
export async function getWithRetry(url,{fetchImpl=fetch,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),timeoutMs=12000}={}){
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetchImpl(url,{method:'GET',signal:AbortSignal.timeout(timeoutMs)});
   if(response.ok||!transient.has(response.status)||attempt===2)return response;
   await response.body?.cancel();
  }catch(error){if(attempt===2)throw error;}
  await sleep(attempt===0?250:750);
 }
}
