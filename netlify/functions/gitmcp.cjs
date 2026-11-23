'use strict';
const {rateLimit} = require('./_rate-limit.cjs');
/** Fixed-tool, public-repository GitMCP bridge. No arbitrary URL or tool proxy. */
const ENDPOINT='https://gitmcp.io/docs';
const PROTOCOL='2025-03-26';
const ACTIONS=Object.freeze({documentation:'fetch_generic_documentation',search:'search_generic_documentation',code:'search_generic_code'});
const TIMEOUT_MS=18000, MAX_TEXT=120000, MAX_RPC_BYTES=420000, MAX_CACHE_ITEMS=80, TTL_MS=5*60*1000;
const cache=new Map();
function reply(statusCode,data){return {statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(data)};}
function validate(body){
  if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('Invalid request.');
  const {repo,action,query,page}=body;
  if(typeof repo!=='string'||!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9_.-]{1,100}$/.test(repo)||repo.endsWith('/.')||repo.endsWith('/..'))throw new Error('Expected a valid public GitHub owner/repo.');
  if(!Object.hasOwn(ACTIONS,action))throw new Error('Unsupported GitMCP action.');
  if(action!=='documentation'&&(typeof query!=='string'||query.trim().length<2||query.trim().length>180||/[\u0000-\u001f]/.test(query)))throw new Error('Search query must be 2–180 characters.');
  if(action==='code'&&page!==undefined&&(!Number.isInteger(page)||page<1||page>10))throw new Error('Page must be between 1 and 10.');
  const [owner,name]=repo.split('/');
  return {repo,owner,name,action,query:action==='documentation'?'':query.trim(),page:action==='code'?(page??1):undefined};
}
function parseResponse(raw,contentType){
  if(!contentType.toLowerCase().includes('text/event-stream'))return JSON.parse(raw);
  const events=[];let data=[];
  for(const line of (raw+'\n\n').split(/\r?\n/)){
    if(!line.trim()) {if(data.length){try{events.push(JSON.parse(data.join('\n')));}catch{}data=[];}continue;}
    if(line.startsWith('data:'))data.push(line.slice(5).trimStart());
  }
  const result=events.findLast(x=>x?.result!==undefined||x?.error!==undefined);
  if(!result)throw Error('GitMCP returned no MCP result.');
  return result;
}
async function readBounded(res){
  const length=Number(res.headers.get('content-length')||0);
  if(length>MAX_RPC_BYTES)throw Error('GitMCP response exceeded the limit.');
  if(!res.body||typeof res.body.getReader!=='function'){
    const raw=await res.text();if(Buffer.byteLength(raw,'utf8')>MAX_RPC_BYTES)throw Error('GitMCP response exceeded the limit.');return raw;
  }
  const reader=res.body.getReader(), parts=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_RPC_BYTES)throw Error('GitMCP response exceeded the limit.');parts.push(Buffer.from(value));}}
  finally{reader.releaseLock();}
  return Buffer.concat(parts).toString('utf8');
}
async function rpc(method,params,session,signal,id){
  const headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream','MCP-Protocol-Version':PROTOCOL};
  if(session)headers['Mcp-Session-Id']=session;
  const response=await fetch(ENDPOINT,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id,method,params}),signal,redirect:'error'});
  if(!response.ok)throw Error(`GitMCP returned HTTP ${response.status}.`);
  const message=parseResponse(await readBounded(response),response.headers.get('content-type')||'');
  if(message.error)throw Error('GitMCP rejected the MCP operation.');
  return {result:message.result,session:response.headers.get('mcp-session-id')||session};
}
async function notifyReady(session,signal){
  const headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream','MCP-Protocol-Version':PROTOCOL};
  if(session)headers['Mcp-Session-Id']=session;
  const response=await fetch(ENDPOINT,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'}),signal,redirect:'error'});
  if(!response.ok)throw Error('GitMCP initialization failed.');
}
function contentToText(result){
  if(!result||result.isError)throw Error('GitMCP did not return results.');
  const blocks=Array.isArray(result.content)?result.content:[];
  const text=blocks.filter(c=>c?.type==='text'&&typeof c.text==='string').map(c=>c.text).join('\n\n');
  return text||'No matching documentation or source was returned.';
}
async function handler(event){
  if(event.httpMethod!=='POST')return {...reply(405,{error:'POST required.'}),headers:{...reply(405,{}).headers,Allow:'POST'}};
  if((event.body||'').length>1400)return reply(413,{error:'Request too large.'});
  const limited = rateLimit(event);
  if (limited) return limited;
  let input;
  try{input=validate(JSON.parse(event.body||'{}'));}catch(e){return reply(400,{error:e.message});}
  const key=JSON.stringify([input.repo,input.action,input.query,input.page]);
  const saved=cache.get(key);
  if(saved&&saved.expires>Date.now())return reply(200,{...saved.value,cached:true});
  const abort=new AbortController(); const timer=setTimeout(()=>abort.abort(),TIMEOUT_MS);
  try{
    const initialization=await rpc('initialize',{protocolVersion:PROTOCOL,capabilities:{},clientInfo:{name:'repo-router',version:'3.0.0'}},null,abort.signal,1);
    const session=initialization.session;
    await notifyReady(session,abort.signal);
    const args={owner:input.owner,repo:input.name};
    if(input.action!=='documentation')args.query=input.query;
    if(input.action==='code')args.page=input.page;
    const answer=await rpc('tools/call',{name:ACTIONS[input.action],arguments:args},session,abort.signal,2);
    const text=contentToText(answer.result);
    const value={repo:input.repo,action:input.action,query:input.query,page:input.page,text:text.slice(0,MAX_TEXT),truncated:text.length>MAX_TEXT,source:`https://gitmcp.io/${input.repo}`};
    if(cache.size>=MAX_CACHE_ITEMS)cache.clear();
    cache.set(key,{value,expires:Date.now()+TTL_MS});
    return reply(200,value);
  }catch(e){const timedOut=e?.name==='AbortError';return reply(timedOut?504:502,{error:timedOut?'GitMCP request timed out. Use the external GitMCP link.':e.message||'GitMCP is unavailable.'});}
  finally{clearTimeout(timer);}
}
exports.handler=handler;
exports._test={validate,parseResponse,readBounded,contentToText,handler};