/* Phase 2 personal workspace: explicit, browser-local data only. */
(()=>{
"use strict";
const $=id=>document.getElementById(id);
const list=$("rr-workspace-list"),save=$("rr-workspace-save"),notes=$("rr-workspace-notes"),status=$("rr-workspace-status"),exportBtn=$("rr-workspace-export"),importBtn=$("rr-workspace-import"),fileInput=$("rr-workspace-file"),clearBtn=$("rr-workspace-clear");
if(!list||!save||!notes||!status||!exportBtn||!importBtn||!fileInput||!clearBtn)return;
const KEY="rr_workspace_v1",MAX=50,NOTE_LIMIT=2000,IMPORT_LIMIT=100000;
const REPO=/^[a-z0-9](?:[a-z0-9-]{0,38})\/[a-z0-9_.-]{1,100}$/i;
let current="",items=[];
const node=(tag,text)=>{const e=document.createElement(tag);if(text!=null)e.textContent=String(text);return e;};
const valid=s=>typeof s==="string"&&REPO.test(s)&&!s.endsWith("/.")&&!s.endsWith("/..");
function normalize(data){
 if(!Array.isArray(data))throw Error("Workspace must contain a repository array.");
 const normalized=[],seen=new Set();
 for(const raw of data){
  if(!raw||!valid(raw.repo)||typeof raw.note!=="string"||raw.note.length>NOTE_LIMIT)throw Error("Invalid repository or note in workspace file.");
  const slug=raw.repo.toLowerCase();
  if(seen.has(slug))continue;
  seen.add(slug);
  normalized.push({repo:raw.repo,note:raw.note,savedAt:typeof raw.savedAt==="string"?raw.savedAt.slice(0,32):""});
  if(normalized.length>MAX)throw Error("Workspace supports up to "+MAX+" repositories.");
 }
 return normalized;
}
function read(){
 try{const raw=localStorage.getItem(KEY);return raw?normalize(JSON.parse(raw)):[];}
 catch{status.textContent="Workspace data could not be read. Saving may be disabled in this browser.";return [];}
}
function persist(next){
 const normalized=normalize(next);
 try{localStorage.setItem(KEY,JSON.stringify(normalized));items=normalized;render();return true;}
 catch(e){status.textContent="Local browser storage unavailable or full. Export your notes to preserve them.";return false;}
}
function render(){
 list.replaceChildren();
 const existing=items.find(x=>x.repo.toLowerCase()===current.toLowerCase());
 save.disabled=!valid(current);
 if(valid(current))notes.value=existing?.note||"";
 if(!items.length){list.append(node("p","No saved repositories yet. Save a repository to keep a local note."));return;}
 for(const item of items){
  const row=node("div");row.className="rr-workspace-item";
  const a=node("a",item.repo);a.href="https://github.com/"+item.repo;a.target="_blank";a.rel="noopener noreferrer";
  const note=node("p",item.note||"No note");
  const saved=node("small",item.savedAt?"Saved "+item.savedAt.slice(0,10):"Saved locally");
  const actions=node("div");actions.className="rr-workspace-actions";
  const copy=node("button","Copy GitHub URL");copy.type="button";
  copy.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(a.href);status.textContent="Repository URL copied.";}catch{status.textContent="Clipboard unavailable.";}}); 
  const remove=node("button","Remove");remove.type="button";remove.setAttribute("aria-label","Remove "+item.repo);
  remove.addEventListener("click",()=>{
   if(persist(items.filter(x=>x.repo.toLowerCase()!==item.repo.toLowerCase())))status.textContent="Removed "+item.repo+" from this browser.";
  });
  actions.append(copy,remove);row.append(a,note,saved,actions);list.append(row);
 }
}
save.addEventListener("click",()=>{
 if(!valid(current))return;
 const note=notes.value.slice(0,NOTE_LIMIT);
 const present=items.find(x=>x.repo.toLowerCase()===current.toLowerCase());
 if(!present&&items.length>=MAX){status.textContent="Workspace is full. Remove an entry before saving another.";return;}
 const entry={repo:current,note,savedAt:new Date().toISOString()};
 const next=[entry,...items.filter(x=>x.repo.toLowerCase()!==current.toLowerCase())];
 if(persist(next))status.textContent="Saved locally in this browser. No account or server upload.";
});
function download(text){
 const url=URL.createObjectURL(new Blob([text],{type:"application/json;charset=utf-8"})),a=node("a");
 a.href=url;a.download="repo-router-workspace.json";document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
}
exportBtn.addEventListener("click",()=>download(JSON.stringify({format:"repo-router-workspace",version:1,repositories:items},null,2)));
importBtn.addEventListener("click",()=>fileInput.click());
fileInput.addEventListener("change",async()=>{
 const file=fileInput.files?.[0];fileInput.value="";
 if(!file)return;
 if(file.size>IMPORT_LIMIT){status.textContent="Workspace file exceeds 100 KB.";return;}
 try{
  const parsed=JSON.parse(await file.text());
  if(parsed?.format!=="repo-router-workspace"||parsed.version!==1)throw Error("Unsupported workspace export format.");
  const next=normalize(parsed.repositories);
  if(persist(next))status.textContent="Imported "+next.length+" repositories, replacing local workspace entries.";
 }catch(e){status.textContent="Import rejected: "+e.message;}
});
clearBtn.addEventListener("click",()=>{
 if(!window.confirm("Delete all saved Repo Router notes and bookmarks from this browser?"))return;
 if(persist([]))status.textContent="Local workspace cleared.";
});
window.addEventListener("reporouter:opened",e=>{
 current=valid(e.detail?.repo)?e.detail.repo:"";render();
});
window.addEventListener("reporouter:closed",()=>{current="";save.disabled=true;});
items=read();render();status.textContent="Notes are stored only in this browser. Export a backup before clearing browser data.";
window.RepoRouterWorkspace={normalize};
})();