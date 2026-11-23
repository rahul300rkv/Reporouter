/* Phase 2: code-evidenced architecture relationships. Never executes repository code. */
(()=>{
"use strict";
const $=id=>document.getElementById(id);
const button=$("rr-architecture-analyze"),status=$("rr-architecture-status"),out=$("rr-architecture-output");
if(!button||!status||!out)return;
const make=(tag,text)=>{const el=document.createElement(tag);if(text!=null)el.textContent=String(text);return el;};
const SAFE=/\.(?:[cm]?[jt]sx?|py)$/i;
const EXCLUDE=/(^|\/)(\.env(?:\..*)?|node_modules|dist|build|vendor|\.next|coverage|secrets?|credentials)(\/|$)/i;
let current=null,version=0,busy=false;
function reset(){version++;current=null;busy=false;button.disabled=true;out.replaceChildren();status.textContent="Open a repository to inspect source relationships.";}
function href(s,path){
 return "https://github.com/"+[s.owner,s.repo].map(encodeURIComponent).join("/")+"/blob/"+
 encodeURIComponent(s.meta.default_branch||"HEAD")+"/"+path.split("/").map(encodeURIComponent).join("/");
}
function pathResolve(from,raw,known){
 if(!raw.startsWith("."))return null; // do not invent edges to external packages
 const parts=from.split("/");parts.pop();
 for(const item of raw.split("/")){
  if(item==="."||!item)continue;
  if(item===".."){if(!parts.length)return null;parts.pop();}
  else parts.push(item);
 }
 const p=parts.join("/");
 const candidates=[p,p+".js",p+".jsx",p+".ts",p+".tsx",p+".mjs",p+".cjs",p+".py",
  p+"/index.js",p+"/index.ts",p+"/index.tsx",p+"/__init__.py"];
 return candidates.find(x=>known.has(x))||null;
}
function references(text,path,known){
 const refs=new Set();
 if(/\.py$/i.test(path)){
  for(const m of text.matchAll(/^\s*from\s+(\.+[\w.]+)\s+import\b/gm)){
   const pieces=m[1].match(/^(\.+)(.*)$/);
   const dots=pieces?.[1].length||0;
   const base="../".repeat(Math.max(0,dots-1))+(pieces?.[2]||"").replace(/\./g,"/");
   const target=pathResolve(path,"./"+base,known);if(target)refs.add(target);
  }
 }else{
  const rx=/(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*|\bimport\s*)["'](\.[^"']+)["']/g;
  for(const m of text.matchAll(rx)){const target=pathResolve(path,m[1],known);if(target)refs.add(target);}
 }
 return [...refs];
}
async function analyze(){
 if(!current||busy)return;
 const s=current,own=version;busy=true;button.disabled=true;out.replaceChildren();
 const all=s.tree.filter(f=>f.type==="blob"&&SAFE.test(f.path)&&!EXCLUDE.test(f.path)&&f.size<=60000&&f.size>=0);
 const selected=all.sort((a,b)=>{
  const score=p=>(/(^|\/)(src|app|lib|server|backend|frontend)\//.test(p)?10:0)+(/(index|main|app|server|routes|api)\.[jtspyc]+$/.test(p)?15:0);
  return score(b.path)-score(a.path)||a.path.localeCompare(b.path);
 }).slice(0,24);
 const known=new Set(s.tree.filter(f=>f.type==="blob").map(f=>f.path));
 const edges=[],errors=[];let readCount=0;
 try{
  for(const file of selected){
   if(own!==version)return;
   status.textContent="Inspecting "+(readCount+1)+"/"+selected.length+" candidate files…";
   try{
    const text=await s.readFile(file);
    if(own!==version)return;
    for(const target of references(text,file.path,known))edges.push({from:file.path,to:target});
   }catch(e){if(e.name==="AbortError")return;errors.push(file.path);}
   readCount++;
  }
  if(own!==version)return;
  out.append(make("h3","Observed local import relationships"));
  out.append(make("p","These edges are potential relationships found by matching relative-import syntax in JavaScript/TypeScript and Python text and resolving target filenames. They are not AI-inferred edges, but comments, conditional imports and build aliases can cause false matches or missing connections. Verify against the code."));
  const rows=make("div");rows.className="rr-phase2-edges";
  edges.slice(0,80).forEach(edge=>{
   const row=make("div");row.className="rr-phase2-edge";
   const a=make("a",edge.from),b=make("a",edge.to);
   a.href=href(s,edge.from);b.href=href(s,edge.to);
   for(const el of [a,b]){el.rel="noopener noreferrer";el.target="_blank";}
   row.append(a,make("span","→"),b,make("small","Matched relative import syntax; target filename exists"));
   rows.append(row);
  });
  if(!edges.length)rows.append(make("p","No resolvable relative imports found in the sampled files. This does not mean the repository has no dependencies."));
  out.append(rows);
  status.textContent="Inspected "+readCount+" of "+all.length+" eligible source files; "+
   edges.length+" potential source edges"+(edges.length>80?" (first 80 shown)":"")+
   "; "+errors.length+" files unavailable"+(s.truncated?"; GitHub returned a partial tree":"")+".";
 }finally{if(own===version){busy=false;button.disabled=false;}}
}
button.addEventListener("click",()=>analyze().catch(e=>{status.textContent="Architecture inspection failed: "+e.message;busy=false;button.disabled=false;}));
window.addEventListener("reporouter:opened",reset);
window.addEventListener("reporouter:repository-loaded",e=>{
 const s=e.detail;
 if(!s||$("explorer-name")?.textContent!==s.owner+"/"+s.repo)return;
 current=s;version++;busy=false;button.disabled=false;out.replaceChildren();
 status.textContent="Ready to inspect up to 24 source files (60 KB each), without executing code.";
});
window.addEventListener("reporouter:closed",reset);
reset();
window.RepoRouterArchitectureEvidence={pathResolve,references};
})();