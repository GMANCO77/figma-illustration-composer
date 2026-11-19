export function normalizeApiBase(input=''){
 if(!input)return '';
 const url=new URL(input);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('PUBLIC_API_BASE must be a plain HTTPS origin without credentials, path or query');
 return url.origin;
}
