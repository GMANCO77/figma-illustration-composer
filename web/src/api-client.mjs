export function apiEndpoint(endpoint,baseUrl='',documentUrl=globalThis.location?.href){
 if(!['status','resolve'].includes(endpoint))throw Error('Неизвестный API-запрос');
 return baseUrl?new URL('/api/'+endpoint,baseUrl).href:new URL('./api/'+endpoint,documentUrl).href;
}
