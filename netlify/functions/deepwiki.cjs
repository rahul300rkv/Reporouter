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
const CACHE_MS = 10 * 60 * 1000;
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
  if(!response.ok)throw new Error(`DeepWiki MCP error (${response.status}).`);
  const raw=await readBounded(response);
  const message=parseResponse(raw,response.headers.get('content-type')||'');
  if(message.error)throw new Error('DeepWiki did not complete the request.');
  return {result:message.result,session:response.headers.get('mcp-session-id')||session};
}
async function notifyReady(session,signal){
  const headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream','MCP-Protocol-Version':PROTOCOL};
  if(session)headers['Mcp-Session-Id']=session;
  const response=await fetch(ENDPOINT,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'}),signal,redirect:'error'});
  if(!response.ok&&response.status!==202&&response.status!==204)throw new Error('DeepWiki MCP initialization failed.');
}
async function handle(event) {
  if(event.httpMethod!=='POST')return reply(405,{error:'POST required.'},{Allow:'POST'});
  if((event.body||'').length>1500)return reply(413,{error:'Request too large.'});
  const limited = rateLimit(event);
  if (limited) return limited;
  let input;
  try{input=validate(JSON.parse(event.body||'{}'));}catch(e){return reply(400,{error:e.message});}
  const key=input.action+':'+input.repo;
  if(input.action!=='ask'){
    const saved=cache.get(key);
    if(saved&&saved.expires>Date.now())return reply(200,{...saved.value,cached:true});
  }
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
    if(input.action!=='ask') {if(cache.size>100)cache.clear();cache.set(key,{value,expires:Date.now()+CACHE_MS});}
    return reply(200,value);
  } catch(e) {
    const timedOut=e.name==='AbortError';
    return reply(timedOut?504:502,{error:timedOut?'DeepWiki timed out. Try the direct DeepWiki link.':e.message});
  }finally{clearTimeout(timer);}
}
exports.handler=handle;
exports._test={validate,parseResponse,handle};