/* Phase 2 Compare & Changes: public GitHub REST only, no arbitrary network URL. */
(()=>{
"use strict";
const $=id=>document.getElementById(id);
const input=$("rr-compare-repo"),button=$("rr-compare-run"),out=$("rr-compare-output"),status=$("rr-compare-status"),base=$("rr-change-base"),head=$("rr-change-head"),changeButton=$("rr-change-run"),changeOut=$("rr-change-output");
if(!input||!button||!out||!status||!base||!head||!changeButton||!changeOut)return;
const VALID=/^[a-z0-9](?:[a-z0-9-]{0,38})\/[a-z0-9_.-]{1,100}$/i;
const REF=/^[a-z0-9_][a-z0-9_.\/-]{0,100}$/i;
let selected=null,seq=0,abort=null;
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;};
const goodRepo=x=>VALID.test(x)&&!x.endsWith("/.")&&!x.endsWith("/..");
const goodRef=x=>REF.test(x)&&!x.split("/").some(t=>!t||t==="."||t==="..")&&!x.includes("...")&&!x.endsWith(".lock");
const fail=res=>res.status===403||res.status===429?"GitHub API rate limit reached. Try later.":res.status===404?"Repository, branch or tag not found.":"GitHub API returned HTTP "+res.status+".";
async function api(url,signal){
 const res=await fetch(url,{headers:{Accept:"application/vnd.github+json"},signal});
 if(!res.ok)throw Error(fail(res));
 return res.json();
}
function cancel(){seq++;abort?.abort();abort=null;button.disabled=!selected;changeButton.disabled=!selected;}
function link(text,href){
 const a=el("a",text);a.href=href;a.target="_blank";a.rel="noopener noreferrer";return a;
}
const row=(title,value)=>{const d=el("div");d.className="rr-phase2-compare-row";d.append(el("strong",title),el("span",value));return d;};
function norm(raw){
 let x=raw.trim().replace(/^https:\/\/(?:www\.)?github\.com\//i,"").replace(/\/$/,"");
 return goodRepo(x)?x:null;
}
async function compare(){
 if(!selected)return;
 const target=norm(input.value);
 if(!target){status.textContent="Enter an owner/repository slug or a GitHub repository URL.";return;}
 if(target.toLowerCase()===(selected.owner+"/"+selected.repo).toLowerCase()){status.textContent="Choose a different repository for side-by-side comparison.";return;}
 cancel();const n=seq,s=selected;abort=new AbortController();button.disabled=true;out.replaceChildren();status.textContent="Fetching comparison from public GitHub…";
 try{
  const repoUrl="https://api.github.com/repos/"+target.split("/").map(encodeURIComponent).join("/");
  const [other,tree]=await Promise.all([
   api(repoUrl,abort.signal),
   api(repoUrl+"/git/trees/HEAD?recursive=1",abort.signal).catch(()=>null)
  ]);
  if(seq!==n||selected!==s)return;
  const own=s.meta;out.append(el("h3","Repository comparison"));
  const grid=el("div");grid.className="rr-phase2-compare-grid";
  const info=[
   ["Repository",own.full_name||s.owner+"/"+s.repo,other.full_name||target],
   ["Description",own.description||"Not provided",other.description||"Not provided"],
   ["Primary language",own.language||"Unknown",other.language||"Unknown"],
   ["Stars",Number(own.stargazers_count||0).toLocaleString(),Number(other.stargazers_count||0).toLocaleString()],
   ["Forks",Number(own.forks_count||0).toLocaleString(),Number(other.forks_count||0).toLocaleString()],
   ["License",own.license?.spdx_id||"Unknown",other.license?.spdx_id||"Unknown"],
   ["Last push",own.pushed_at?.slice(0,10)||"Unknown",other.pushed_at?.slice(0,10)||"Unknown"]
  ];
  for(const [name,l,r] of info){grid.append(row(name,l),row("",r));}
  out.append(grid);
  const manifest=p=>/(^|\/)(package\.json|pyproject\.toml|go\.mod|cargo\.toml|pom\.xml|requirements\.txt)$/i.test(p);
  const left=s.tree.filter(f=>f.type==="blob"&&manifest(f.path)).map(f=>f.path);
  const right=(tree?.tree||[]).filter(f=>f.type==="blob"&&manifest(f.path)).map(f=>f.path);
  out.append(el("h4","Manifest filenames observed"));
  out.append(el("p",(own.full_name||s.owner+"/"+s.repo)+": "+(left.slice(0,12).join(", ")||"None found")));
  out.append(el("p",target+": "+(right.slice(0,12).join(", ")||"Unavailable or none found")));
  out.append(link("Open both repositories on GitHub ↗","https://github.com/"+target));
  status.textContent="Comparison ready. Metadata is live GitHub data; file trees may be incomplete."+
   (s.truncated||tree?.truncated?" At least one tree was truncated.":"");
 }catch(e){if(seq===n)status.textContent="Comparison unavailable: "+e.message;}
 finally{if(seq===n){abort=null;button.disabled=false;}}
}
async function changes(){
 if(!selected)return;
 const left=base.value.trim(),right=head.value.trim();
 if(!goodRef(left)||!goodRef(right)||left===right){status.textContent="Enter two distinct valid branch names or tags (e.g. main and v1.0.0).";return;}
 cancel();const n=seq,s=selected;abort=new AbortController();changeButton.disabled=true;changeOut.replaceChildren();
 status.textContent="Requesting GitHub comparison…";
 try{
  const path=[s.owner,s.repo].map(encodeURIComponent).join("/");
  const data=await api("https://api.github.com/repos/"+path+"/compare/"+encodeURIComponent(left)+"..."+encodeURIComponent(right),abort.signal);
  if(seq!==n||selected!==s)return;
  const files=Array.isArray(data.files)?data.files:[];
  const max=100;
  changeOut.append(el("h3","Changes between "+left+" and "+right));
  changeOut.append(el("p",String(data.ahead_by||0)+" commits ahead; "+String(data.behind_by||0)+" behind; "+String(data.total_commits||0)+" total reported. Files shown: "+Math.min(max,files.length)+"."));
  const ul=el("ul");
  for(const f of files.slice(0,max)){
   if(typeof f.filename!=="string")continue;
   const li=el("li");
   const a=link(f.filename,"https://github.com/"+path+"/blob/"+encodeURIComponent(right)+"/"+f.filename.split("/").map(encodeURIComponent).join("/"));
   li.append(a,el("span"," · "+(f.status||"changed")+" (+"+Number(f.additions||0)+"/-"+Number(f.deletions||0)+")"));
   ul.append(li);
  }
  if(!files.length)ul.append(el("li","No changed files returned."));
  changeOut.append(ul,link("View full GitHub comparison ↗","https://github.com/"+path+"/compare/"+encodeURIComponent(left)+"..."+encodeURIComponent(right)));
  status.textContent="GitHub comparison loaded. GitHub may cap the number of returned files and commits; this view is not exhaustive.";
 }catch(e){if(seq===n)status.textContent="Changes unavailable: "+e.message;}
 finally{if(seq===n){abort=null;changeButton.disabled=false;}}
}
button.addEventListener("click",compare);
changeButton.addEventListener("click",changes);
window.addEventListener("reporouter:opened",()=>{cancel();selected=null;out.replaceChildren();changeOut.replaceChildren();status.textContent="Loading repository…";});
window.addEventListener("reporouter:repository-loaded",e=>{const s=e.detail;if(!s||$("explorer-name")?.textContent!==s.owner+"/"+s.repo)return;selected=s;cancel();base.value=s.meta.default_branch||"main";head.value="";out.replaceChildren();changeOut.replaceChildren();status.textContent="Compare public repositories or two branches/tags of this repository.";});
window.addEventListener("reporouter:closed",()=>{cancel();selected=null;out.replaceChildren();changeOut.replaceChildren();status.textContent="Open a repository to compare.";});
window.RepoRouterCompare={goodRepo,goodRef,norm};
})();