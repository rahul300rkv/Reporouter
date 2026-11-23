/* Repo Router: first-party DeepWiki documentation tab, powered by Netlify MCP bridge. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const ui={panel:$('explorer-panel'),status:$('deepwiki-status'),out:$('deepwiki-output'),question:$('deepwiki-question'),ask:$('deepwiki-ask'),structure:$('deepwiki-structure'),contents:$('deepwiki-contents'),link:$('deepwiki-link'),tab:document.querySelector('[data-explorer-tab="deepwiki"]')};
 if(!ui.panel||!ui.out||!ui.tab)return;
 let repo=null,version=0,busy=false,controller=null,cooldownUntil=0,cooldownTimer=null;
 const recovery=document.createElement('div');
 recovery.className='deepwiki-recovery';
 recovery.hidden=true;
 const recoveryIntro=document.createElement('p');
 recoveryIntro.textContent='You can still explore this repository inside Repo Router:';
 const filesBtn=document.createElement('button');filesBtn.type='button';filesBtn.textContent='Browse repository files';
 const gitmcpBtn=document.createElement('button');gitmcpBtn.type='button';gitmcpBtn.textContent='Search with GitMCP';
 recovery.append(recoveryIntro,filesBtn,gitmcpBtn);
 ui.out.insertAdjacentElement('afterend',recovery);
 const activate=kind=>document.querySelector('[data-explorer-tab="'+kind+'"]')?.click();
 filesBtn.addEventListener('click',()=>activate('files'));
 gitmcpBtn.addEventListener('click',()=>activate('gitmcp'));
 const usable=()=>Boolean(repo)&&!busy&&Date.now()>=cooldownUntil;
 function syncButtons(){const enabled=usable();[ui.ask,ui.structure,ui.contents].forEach(b=>b.disabled=!enabled);}
 function cooldown(seconds){
   clearTimeout(cooldownTimer);
   const duration=Math.min(600,Math.max(1,Number(seconds)||60));
   cooldownUntil=Date.now()+duration*1000;
   syncButtons();
   const tick=()=>{
     if(!repo)return;
     const left=Math.ceil((cooldownUntil-Date.now())/1000);
     if(left<=0){cooldownUntil=0;syncButtons();say('DeepWiki can be tried again. Repository Explorer and GitMCP remain available.');return;}
     say('DeepWiki temporarily limited. Retry in '+left+'s. Use Repository Explorer or GitMCP meanwhile.',true);
     cooldownTimer=setTimeout(tick,1000);
   };
   tick();
 }
 const memo=new Map();
 function say(t,error=false){ui.status.textContent=t;ui.status.dataset.error=String(error);}
 function setRepo(newRepo){
   if(repo===newRepo)return;
   repo=newRepo;version++;
   if(controller){controller.abort();controller=null;}
   busy=false;cooldownUntil=0;clearTimeout(cooldownTimer);syncButtons();recovery.hidden=true;
   ui.out.textContent='Select Wiki structure, Full wiki, or ask a question.';
   ui.question.value='';
   ui.link.href=repo?`https://deepwiki.com/${repo}`:'https://deepwiki.com';
   say(repo?`DeepWiki documentation for ${repo}. Public repositories only.`:'Open a repository to use DeepWiki.');
 }
 async function query(action){
   if(!usable())return;
   let question=ui.question.value.trim();
   if(action==='ask'&&(question.length<3||question.length>500)){say('Enter a question of 3–500 characters.',true);return;}
   const myVersion=version,currentRepo=repo,cacheKey=`${repo}:${action}`;
   if(action!=='ask'&&memo.has(cacheKey)){ui.out.textContent=memo.get(cacheKey);recovery.hidden=false;say('Loaded cached DeepWiki documentation.');return;}
   busy=true;controller=new AbortController();const ownController=controller;syncButtons();recovery.hidden=true;
   ui.out.textContent='Loading DeepWiki documentation…';say('Connecting to DeepWiki MCP…');
   try{
     const r=await fetch('/.netlify/functions/deepwiki',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({repo:currentRepo,action,...(action==='ask'?{question}:{})}),signal:ownController.signal});
     const body=await r.json();
     if(myVersion!==version)return;
     if(!r.ok){
       if(r.status===429){
         ui.out.textContent='DeepWiki is temporarily limiting requests. You can still browse repository files or search with GitMCP below. Your repository remains open.';
         recovery.hidden=false;
         cooldown(body.retryAfter||Number(r.headers.get('Retry-After'))||60);
         return;
       }
       throw new Error(body.error||`Documentation request failed (${r.status}).`);
     }
     ui.out.textContent=body.text||'No documentation available.';
     recovery.hidden=false;
     if(body.stale) say(body.warning||'Showing cached documentation while DeepWiki is unavailable.');
     if(action!=='ask'&&body.text)memo.set(cacheKey,body.text);
     if(!body.stale)say(body.truncated?'Documentation truncated to the configured size limit. Open DeepWiki for the complete content.':'Documentation loaded from DeepWiki. Verify important details against the GitHub source.');
   }catch(e){if(myVersion===version){ui.out.textContent='DeepWiki is unavailable right now. You can continue browsing files, reviewing the digest, or searching with GitMCP here.';recovery.hidden=false;say(e.message,true);}}
   finally{if(myVersion===version){controller=null;busy=false;syncButtons();}}
 }
 window.addEventListener('reporouter:deepwiki-selected',()=>{
   if(repo&&!busy)query('structure');
 });
 ui.structure.addEventListener('click',()=>query('structure'));
 ui.contents.addEventListener('click',()=>query('contents'));
 ui.ask.addEventListener('click',()=>query('ask'));
 ui.question.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();query('ask');}});
 // Listen for Phase 1's explicit repository-opening event (added by Phase 2 installer).
 window.addEventListener('reporouter:opened',e=>setRepo(e.detail?.repo||null));
 window.addEventListener('reporouter:closed',()=>setRepo(null));
 window.RepoRouterDeepWiki={setRepo};
})();