'use strict';
const {rateLimit} = require('./_rate-limit.cjs');
/** Repo Router Phase 2 — server-side, read-only DeepWiki MCP bridge.
 * No unrestricted URL proxy; endpoint and exposed tools are fixed.
 */
const ENDPOINT = 'https://mcp.deepwiki.com/mcp';
const ACTIONS = Object.freeze({structure:'read_wiki_structure',contents:'read_wiki_contents',ask:'ask_wiki_question'});
const PROTOCOL = '2025-06-18';
const MAX_RESPONSE = 250000;
const TIMEOUT_MS = 19000;
const cache = new Map();
const CACHE_MS = 30 * 60 * 1000;
const STALE_MS = 24 * 60 * 60 * 1000;
const inflight = new Map();
let upstreamCooldown = 0;
function reply(code, data, extra={}) {return {statusCode:code,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra},body:JSON.stringify(data)};}
function parseResponse(text, contentType) {
  if (contentType.includes('text/event-stream')) {
    const messages=[];
    let data=[];
    for(const line of (text+'\n\n').split(/\r?\n/)) {
      if(!line.trim()) {if(data.length){const raw=data.join('\n');try{messages.push(JSON.parse(raw));}catch{}data=[];}continue;}
      if(line.startsWith('data:'))data.push(line.slice(5).trimStart());
    }
    const last=messages.findLast(m=>m?.result||m?.error);
    if(!last)throw new Error('DeepWiki returned no MCP result.');
    return last;
  }
  return JSON.parse(text);
}
function validate(body) {
  if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('Invalid JSON body.');
  const {repo,action,question}=body;
  if(typeof repo!=='string'||!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9_.-]{1,100}$/.test(repo)||repo.endsWith('/.')||repo.endsWith('/..'))throw new Error('Invalid public repository name; expected owner/repo.');
  if(!Object.hasOwn(ACTIONS,action))throw new Error('Unsupported documentation action.');
  if(action==='ask'&&(typeof question!=='string'||question.trim().length<3||question.length>500))throw new Error('Question must be 3–500 characters.');
  return {repo,action,question:action==='ask'?question.trim():null};
}
async function readBounded(res) {
  const cap=MAX_RESPONSE*2;
  const declared=Number(res.headers.get('content-length')||0);
  if(declared>cap)throw new Error('DeepWiki response exceeds the allowed size.');
  if(!res.body||typeof res.body.getReader!=='function') {
    const text=await res.text();
    if(Buffer.byteLength(text,'utf8')>cap)throw new Error('DeepWiki response exceeds the allowed size.');
    return text;
  }
  const reader=res.body.getReader(),parts=[];let n=0;
  try {for(;;) {const {done,value}=await reader.read();if(done)break;n+=value.byteLength;
    if(n>cap){await reader.cancel();throw new Error('DeepWiki response exceeds the allowed size.');}
    parts.push(Buffer.from(value));}}
  finally{reader.releaseLock();}
  return Buffer.concat(parts).toString('utf8');
}
async function rpc(method, params, session, signal, requestId=1) {
  const headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream','MCP-Protocol-Version':PROTOCOL};
  if(session)headers['Mcp-Session-Id']=session;
  const response=await fetch(ENDPOINT,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:requestId,method,params}),signal,redirect:'error'});
  if(!response.ok) {
    const error=new Error(response.status===429?'DeepWiki is handling too many requests.':`DeepWiki MCP error (${response.status}).`);
    error.status=response.status;
    const retry=Number(response.headers.get('retry-after'));
    error.retryAfter=Number.isFinite(retry)&&retry>0?Math.min(600,Math.ceil(retry)):60;
    throw error;
  }
  const raw=await readBounded(response);
  const message=parseResponse(raw,response.headers.get('content-type')||'');
  if(message.error)throw new Error('DeepWiki did not complete the request.');
  return {result:message.result,session:response.headers.get('mcp-session-id')||session};
}
async function notifyReady(session,signal){
  const headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream','MCP-Protocol-Version':PROTOCOL};
  if(session)headers['Mcp-Session-Id']=session;
  const response=await fetch(ENDPOINT,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'}),signal,redirect:'error'});
  if(!response.ok&&response.status!==202&&response.status!==204){
    const err = new Error(response.status===429?'DeepWiki initialization is rate-limited.':'DeepWiki MCP initialization failed.');
    err.status=response.status;
    const retry=Number(response.headers.get('retry-after'));
    err.retryAfter=Number.isFinite(retry)&&retry>0?Math.min(600,Math.ceil(retry)):60;
    throw err;
  }
}
async function handle(event) {
  if(event.httpMethod!=='POST')return reply(405,{error:'POST required.'},{Allow:'POST'});
  if((event.body||'').length>1500)return reply(413,{error:'Request too large.'});
  let input;
  try{input=validate(JSON.parse(event.body||'{}'));}catch(e){return reply(400,{error:e.message});}
  const key=input.action+':'+input.repo;
  const existing=input.action==='ask'?null:cache.get(key);
  // A cached public wiki does not consume either an upstream call or local quota.
  if(existing&&existing.expires>Date.now())return reply(200,{...existing.value,cached:true});
  if(input.action!=='ask'&&inflight.has(key))return inflight.get(key);
  const limited=rateLimit(event);
  if(limited)return limited;
  const now=Date.now();
  if(now<upstreamCooldown) {
    const retryAfter=Math.max(1,Math.ceil((upstreamCooldown-now)/1000));
    if(existing&&existing.staleUntil>now)return reply(200,{...existing.value,cached:true,stale:true,warning:'DeepWiki is temporarily busy; showing previously retrieved documentation.'});
    return reply(429,{error:'DeepWiki is temporarily busy. Try again shortly or use the repository explorer.',source:'deepwiki',retryAfter},{'Retry-After':String(retryAfter)});
  }
  const work=perform(input,key,existing);
  if(input.action!=='ask')inflight.set(key,work);
  try{return await work;}finally{if(input.action!=='ask'&&inflight.get(key)===work)inflight.delete(key);}
}
async function perform(input,key,existing) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try {
    const init=await rpc('initialize',{protocolVersion:PROTOCOL,capabilities:{},clientInfo:{name:'repo-router',version:'2.0.0'}},null,controller.signal,1);
    const session=init.session;
    await notifyReady(session,controller.signal);
    // Fixed read-only allowlist, no user-selected MCP tools or target domains.
    const tool=await rpc('tools/call',{name:ACTIONS[input.action],arguments:{repoName:input.repo,...(input.action==='ask'?{question:input.question}:{})}},session,controller.signal,2);
    if(!tool.result||tool.result.isError)throw new Error('DeepWiki could not retrieve documentation for this repository.');
    const content=Array.isArray(tool.result.content)?tool.result.content:[];
    const text=content.filter(x=>x.type==='text'&&typeof x.text==='string').map(x=>x.text).join('\n\n');
    if(!text.trim())throw new Error('No documentation was returned. The repository may not be indexed yet.');
    const value={repo:input.repo,action:input.action,text:text.slice(0,MAX_RESPONSE),truncated:text.length>MAX_RESPONSE,source:`https://deepwiki.com/${input.repo}`};
    if(input.action!=='ask') {if(cache.size>100)cache.clear();cache.set(key,{value,expires:Date.now()+CACHE_MS,staleUntil:Date.now()+STALE_MS});}
    return reply(200,value);
  } catch(e) {
    const timedOut=e.name==='AbortError';
    const throttled=e.status===429;
    if(throttled)upstreamCooldown=Date.now()+(e.retryAfter||60)*1000;
    if(existing&&existing.staleUntil>Date.now())
      return reply(200,{...existing.value,cached:true,stale:true,warning:'DeepWiki could not be reached; showing previously loaded documentation.'});
    if(throttled)return reply(429,{error:'DeepWiki is temporarily limiting requests. Try again later or use the repository explorer.',source:'deepwiki',retryAfter:e.retryAfter||60},{'Retry-After':String(e.retryAfter||60)});
    return reply(timedOut?504:502,{error:timedOut?'DeepWiki timed out. Use the repository explorer while it recovers.':e.message,source:'deepwiki'});
  }finally{clearTimeout(timer);}
}
exports.handler=handle;
exports._test={validate,parseResponse,handle,clear:()=>{cache.clear();inflight.clear();upstreamCooldown=0;}};