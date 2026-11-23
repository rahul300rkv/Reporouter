/* Repo Router Phase 3: documentation and source search through GitMCP. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const ui={panel:$('explorer-panel'),status:$('gitmcp-status'),out:$('gitmcp-output'),query:$('gitmcp-query'),doc:$('gitmcp-documentation'),search:$('gitmcp-search'),code:$('gitmcp-code'),link:$('gitmcp-link'),page:$('gitmcp-page'),tab:document.querySelector('[data-explorer-tab="gitmcp"]')};
 if(Object.values(ui).some(x=>!x))return;
 let repo=null,requestVersion=0,controller=null;
 const cache=new Map();
 const buttons=[ui.doc,ui.search,ui.code];
 function say(message,error=false){ui.status.textContent=message;ui.status.dataset.error=String(error);}
 function setRepo(next){
   if(repo===next)return;
   repo=next;requestVersion++;
   if(controller){controller.abort();controller=null;}
   buttons.forEach(b=>b.disabled=false);
   ui.out.textContent='Fetch documentation or search this repository.';
   ui.query.value='';ui.page.value='1';
   ui.link.href=repo?`https://gitmcp.io/${repo}`:'https://gitmcp.io';
   say(repo?`Ready for documentation search in ${repo}.`:'Open a public repository to use GitMCP.');
 }
 async function run(action){
   if(!repo)return;
   const query=ui.query.value.trim();
   if(action!=='documentation'&&(query.length<2||query.length>180)){say('Enter a search query of 2–180 characters.',true);return;}
   const page=Number(ui.page.value);
   if(action==='code'&&(!Number.isInteger(page)||page<1||page>10)){say('Select a page between 1 and 10.',true);return;}
   const key=JSON.stringify([repo,action,query,action==='code'?page:null]);
   if(cache.has(key)){if(controller)controller.abort();controller=null;requestVersion++;buttons.forEach(b=>b.disabled=false);ui.out.textContent=cache.get(key);say('Loaded cached GitMCP result.');return;}
   if(controller)controller.abort();controller=new AbortController();
   const ownController=controller,version=++requestVersion,currentRepo=repo;
   buttons.forEach(b=>b.disabled=true);
   say('Retrieving public repository documentation from GitMCP…');
   ui.out.textContent='Loading…';
   try{
     const response=await fetch('/.netlify/functions/gitmcp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({repo:currentRepo,action,...(action!=='documentation'?{query}:{}),...(action==='code'?{page}:{})}),signal:ownController.signal});
     const data=await response.json();
     if(version!==requestVersion)return;
     if(!response.ok)throw Error(data.error||`GitMCP request failed (${response.status}).`);
     ui.out.textContent=typeof data.text==='string'?data.text:'No results were returned.';
     if(typeof data.text==='string'){if(cache.size>60)cache.clear();cache.set(key,data.text);}
     say(data.truncated?'Output was truncated; open GitMCP for more.':'Results loaded. Verify important details against the GitHub repository.');
   }catch(err){if(version!==requestVersion)return;if(err.name==='AbortError')return;ui.out.textContent='GitMCP results could not be displayed here. Use “Open in GitMCP” to continue.';say(err.message||'Request failed.',true);}
   finally{if(version===requestVersion){controller=null;buttons.forEach(b=>b.disabled=false);}}
 }
 ui.doc.addEventListener('click',()=>run('documentation'));
 ui.search.addEventListener('click',()=>run('search'));
 ui.code.addEventListener('click',()=>run('code'));
 ui.query.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();run('search');}});
 window.addEventListener('reporouter:opened',e=>setRepo(e.detail?.repo||null));
 window.addEventListener('reporouter:closed',()=>setRepo(null));
 window.RepoRouterGitMCP={setRepo};
})();