/* Public-only GitDiagram Markdown relay. Never proxies arbitrary URLs. */
'use strict';
const REPO=/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9_.-]{1,100}$/;
const MAX=120000;
const memo=new Map();
const headers={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=60, s-maxage=300','access-control-allow-origin':'https://reporouter.netlify.app'};
const reply=(status,body)=>({statusCode:status,headers,body:JSON.stringify(body)});
exports.handler=async(event)=>{
 if(event.httpMethod!=='GET')return reply(405,{error:'GET required.'});
 const repo=String(event.queryStringParameters?.repo||'');
 if(!REPO.test(repo)||repo.includes('..')||repo.endsWith('.git'))return reply(400,{error:'Provide a public GitHub owner/repository identifier.'});
 const existing=memo.get(repo);if(existing&&existing.expires>Date.now())return reply(200,{markdown:existing.text,cached:true});
 const url='https://gitdiagram.com/'+repo+'.md';
 try{
  const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),10000);
  let response;try{response=await fetch(url,{signal:ctl.signal,headers:{accept:'text/markdown'}});}finally{clearTimeout(timer);}
  if(response.status===404)return reply(404,{error:'No stored diagram yet. Open GitDiagram to generate or view it.'});
  if(!response.ok)return reply(502,{error:'GitDiagram is unavailable (HTTP '+response.status+').'});
  const type=response.headers.get('content-type')||'';
  if(!/text\/(markdown|plain)/i.test(type))return reply(502,{error:'Unexpected GitDiagram response format.'});
  const declared=Number(response.headers.get('content-length')||0);
  if(declared>MAX)return reply(413,{error:'Diagram exceeds the supported size.'});
  const raw=await response.text();if(raw.length>MAX)return reply(413,{error:'Diagram exceeds the supported size.'});
  memo.set(repo,{text:raw,expires:Date.now()+300000});if(memo.size>100)memo.delete(memo.keys().next().value);
  return reply(200,{markdown:raw});
 }catch(e){return reply(502,{error:e.name==='AbortError'?'GitDiagram request timed out.':'Could not reach GitDiagram.'});}
};