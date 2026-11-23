/* Repo Router GitDiagram tab. Public, pre-generated diagrams only. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const ui={panel:$('explorer-panel'),status:$('gitdiagram-status'),summary:$('gitdiagram-summary'),graphic:$('gitdiagram-graphic'),source:$('gitdiagram-source'),load:$('gitdiagram-load'),external:$('gitdiagram-external'),copy:$('gitdiagram-copy'),tab:document.querySelector('[data-explorer-tab="gitdiagram"]')};
 if(!ui.panel||!ui.load||!ui.tab)return;
 let repo='',generation=0,abort=null,mermaidSource='';
 function say(text,error=false){ui.status.textContent=text;ui.status.dataset.error=String(error);}
 function reset(nextRepo){generation++;if(abort)abort.abort();abort=null;repo=nextRepo||'';mermaidSource='';ui.source.textContent='';ui.graphic.replaceChildren();ui.summary.textContent='Select Load diagram to see an existing GitDiagram architecture.';ui.copy.disabled=true;ui.load.disabled=!repo;ui.external.href=repo?'https://gitdiagram.com/'+repo:'https://gitdiagram.com';say(repo?'Ready to check GitDiagram for '+repo+'.':'Open a public repository to use GitDiagram.');}
 function parseMarkdown(md){const block=md.match(/```mermaid\s*\n([\s\S]*?)\n```/i);const overview=md.match(/## Overview\s*\n([\s\S]*?)(?=\n## |$)/i);return {mermaid:block?.[1]||'',overview:overview?.[1]?.trim()||'Architecture overview is unavailable.'};}
 let mermaidPromise;
 async function engine(){
   if(window.mermaid)return window.mermaid;
   if(!mermaidPromise){mermaidPromise=import('https://cdn.jsdelivr.net/npm/mermaid@11.12.2/dist/mermaid.esm.min.mjs').then(m=>m.default).catch(e=>{mermaidPromise=null;throw e;});}
   return mermaidPromise;
 }
 async function renderDiagram(source,token){
   // Do not allow directives and clickable external links in untrusted provider text.
   const safe=source.split('\n').filter(line=>!/^\s*(?:click\s|%%\{|href\s)/i.test(line)).join('\n');
   if(!/^\s*(?:flowchart|graph)\s+(?:TD|TB|LR|RL|BT)\b/i.test(safe))throw new Error('Unsupported diagram syntax; use the Mermaid source or GitDiagram link.');
   const mermaid=await engine();if(token!==generation)return;
   mermaid.initialize({startOnLoad:false,securityLevel:'strict',maxTextSize:30000,htmlLabels:false,theme:'neutral'});
   const {svg}=await mermaid.render('rr-diagram-'+token+'-'+Date.now(),safe);
   if(token!==generation)return;
   // Mermaid returns sanitized SVG under strict mode, but never treat provider text as HTML.
   // Rendering requires an SVG DOM insertion; no scripts are permitted in this page's CSP.
   const tpl=document.createElement('template');tpl.innerHTML=svg;
   tpl.content.querySelectorAll('script,foreignObject,iframe,object,embed').forEach(x=>x.remove());
   tpl.content.querySelectorAll('*').forEach(node=>{for(const attr of [...node.attributes]){if(/^on/i.test(attr.name)||(/^(href|xlink:href)$/i.test(attr.name)&&!attr.value.startsWith('#')))node.removeAttribute(attr.name);}});
   ui.graphic.replaceChildren(tpl.content.cloneNode(true));
 }
 async function load(){if(!repo||abort)return;const token=generation,current=repo;abort=new AbortController();ui.load.disabled=true;ui.graphic.replaceChildren();ui.summary.textContent='Loading architecture…';say('Checking GitDiagram for a stored diagram…');
 try{
  const response=await fetch('/.netlify/functions/gitdiagram?repo='+encodeURIComponent(current),{signal:abort.signal});
  const data=await response.json();if(token!==generation)return;
  if(!response.ok)throw new Error(data.error||'Could not load diagram.');
  const parsed=parseMarkdown(data.markdown||'');
  ui.summary.textContent=parsed.overview;
  ui.source.textContent=parsed.mermaid||data.markdown||'';
  mermaidSource=parsed.mermaid;
  ui.copy.disabled=!mermaidSource;
  if(!mermaidSource){say('No stored Mermaid diagram is available. Open GitDiagram to create or view it.');return;}
  try{await renderDiagram(mermaidSource,token);if(token===generation)say('Architecture loaded from GitDiagram. AI-generated; verify against source.');}
  catch(e){if(token===generation)say('Diagram source loaded; visualization unavailable ('+e.message+').',true);}
 }catch(e){if(token===generation){ui.summary.textContent='Unable to load an existing architecture diagram. Open GitDiagram for availability or generation.';say(e.message,true);}}
 finally{if(token===generation){abort=null;ui.load.disabled=false;}}
 }
 ui.load.addEventListener('click',load);
 ui.copy.addEventListener('click',async()=>{if(!mermaidSource)return;try{await navigator.clipboard.writeText(mermaidSource);say('Mermaid source copied.');}catch{say('Copy is unavailable in this browser. Select the source text below.',true);}});
 window.addEventListener('reporouter:opened',e=>reset(e.detail?.repo||''));
 window.addEventListener('reporouter:closed',()=>reset(''));
 reset('');
 window.RepoRouterGitDiagram={setRepo:reset,parseMarkdown};
})();