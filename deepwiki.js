/* Repo Router: first-party DeepWiki documentation tab, powered by Netlify MCP bridge. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const ui={panel:$('explorer-panel'),status:$('deepwiki-status'),out:$('deepwiki-output'),question:$('deepwiki-question'),ask:$('deepwiki-ask'),structure:$('deepwiki-structure'),contents:$('deepwiki-contents'),link:$('deepwiki-link'),tab:document.querySelector('[data-explorer-tab="deepwiki"]')};
 if(!ui.panel||!ui.out||!ui.tab)return;
 let repo=null,version=0,busy=false,controller=null;
 const memo=new Map();
 function say(t,error=false){ui.status.textContent=t;ui.status.dataset.error=String(error);}
 function setRepo(newRepo){
   if(repo===newRepo)return;
   repo=newRepo;version++;
   if(controller){controller.abort();controller=null;}
   busy=false;[ui.ask,ui.structure,ui.contents].forEach(x=>x.disabled=false);
   ui.out.textContent='Select Wiki structure, Full wiki, or ask a question.';
   ui.question.value='';
   ui.link.href=repo?`https://deepwiki.com/${repo}`:'https://deepwiki.com';
   say(repo?`DeepWiki documentation for ${repo}. Public repositories only.`:'Open a repository to use DeepWiki.');
 }
 async function query(action){
   if(!repo||busy)return;
   let question=ui.question.value.trim();
   if(action==='ask'&&(question.length<3||question.length>500)){say('Enter a question of 3–500 characters.',true);return;}
   const myVersion=version,currentRepo=repo,cacheKey=`${repo}:${action}`;
   if(action!=='ask'&&memo.has(cacheKey)){ui.out.textContent=memo.get(cacheKey);say('Loaded cached DeepWiki documentation.');return;}
   busy=true;controller=new AbortController();const ownController=controller;[ui.ask,ui.structure,ui.contents].forEach(x=>x.disabled=true);
   ui.out.textContent='Loading DeepWiki documentation…';say('Connecting to DeepWiki MCP…');
   try{
     const r=await fetch('/.netlify/functions/deepwiki',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({repo:currentRepo,action,...(action==='ask'?{question}:{})}),signal:ownController.signal});
     const body=await r.json();
     if(myVersion!==version)return;
     if(!r.ok)throw new Error(body.error||`Documentation request failed (${r.status}).`);
     ui.out.textContent=body.text||'No documentation available.';
     if(action!=='ask'&&body.text)memo.set(cacheKey,body.text);
     say(body.truncated?'Documentation truncated to the configured size limit. Open DeepWiki for the complete content.':'Documentation loaded from DeepWiki. Verify important details against the GitHub source.');
   }catch(e){if(myVersion===version){ui.out.textContent='The integrated documentation could not be loaded. Use “Open in DeepWiki” to continue.';say(e.message,true);}}
   finally{if(myVersion===version){controller=null;busy=false;[ui.ask,ui.structure,ui.contents].forEach(x=>x.disabled=false);}}
 }
 ui.structure.addEventListener('click',()=>query('structure'));
 ui.contents.addEventListener('click',()=>query('contents'));
 ui.ask.addEventListener('click',()=>query('ask'));
 ui.question.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();query('ask');}});
 // Listen for Phase 1's explicit repository-opening event (added by Phase 2 installer).
 window.addEventListener('reporouter:opened',e=>setRepo(e.detail?.repo||null));
 window.addEventListener('reporouter:closed',()=>setRepo(null));
 window.RepoRouterDeepWiki={setRepo};
})();