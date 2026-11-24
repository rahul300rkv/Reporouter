/* Phase 2 repository health: observable evidence, not a vulnerability score. */
(()=>{
"use strict";
const $=id=>document.getElementById(id);
const output=$("rr-health-output"),status=$("rr-health-status");
if(!output||!status)return;
let snapshot=null,token=0;
const make=(tag,text)=>{const el=document.createElement(tag);if(text!=null)el.textContent=String(text);return el;};
const exists=(tree,match)=>tree.some(f=>f.type==="blob"&&match(f.path.toLowerCase()));
function render(data){
 output.replaceChildren();
 const tree=data.tree||[],files=tree.filter(f=>f.type==="blob");
 const has=(...names)=>exists(files,p=>names.some(n=>p===n||p.endsWith("/"+n)));
 const prefix=p=>exists(files,name=>name.startsWith(p));
 const indicators=[
 ["Readme",has("readme.md","readme.rst","readme.txt"),"Root or nested README detected"],
 ["License file",has("license","license.md","license.txt","copying"),"License text file present; content not legally reviewed"],
 ["Security policy",has("security.md"),"SECURITY.md detected"],
 ["Contribution guide",has("contributing.md"),"CONTRIBUTING.md detected"],
 ["Automated tests",exists(files,p=>/(^|\/)(__tests__|tests?|specs?)\//.test(p)||/\.(test|spec)\.[jt]sx?$/.test(p)),"Test files or folders detected; execution/coverage not checked"],
 ["CI workflows",prefix(".github/workflows/"),"GitHub Actions workflow files detected; run success not verified"],
 ["Dependency manifest",has("package.json","pyproject.toml","requirements.txt","go.mod","cargo.toml","pom.xml","build.gradle","gemfile","composer.json"),"Common dependency manifest detected"],
 ["Lockfile",has("package-lock.json","pnpm-lock.yaml","yarn.lock","poetry.lock","uv.lock","cargo.lock","go.sum","gemfile.lock"),"Dependency lockfile detected"],
 ["Docker instructions",has("dockerfile","compose.yaml","docker-compose.yml"),"Container instructions detected"]
 ];
 const heading=make("h3","Evidence-based repository health");
 const intro=make("p","Checks use GitHub metadata and returned file names. They do not assess whether dependencies are secure, tests pass, or maintenance is adequate.");
 const list=make("div");list.className="rr-phase2-signal-grid";
 for(const [name,found,explanation] of indicators){
  const row=make("div");row.className="rr-phase2-signal";
  const title=make("strong",(found?"Detected: ":"Not found: ")+name);
  const desc=make("p",explanation+(found?"":" (absence is not proof the capability is missing)"));
  row.append(title,desc);list.append(row);
 }
 const facts=make("ul");
 const pushed=data.meta?.pushed_at,updated=data.meta?.updated_at;
 for(const line of [
  "Latest code push: "+(pushed?new Date(pushed).toLocaleDateString():"Unknown"),
  "Repository metadata update: "+(updated?new Date(updated).toLocaleDateString():"Unknown"),
  "Open issue count (includes PRs in GitHub REST metadata): "+Number(data.meta?.open_issues_count||0),
  "Archived: "+(data.meta?.archived===true?"Yes":"No or not reported"),
  "Visibility: "+(data.meta?.private===false?"Public confirmed":"Not verified"),
  "Returned tree: "+files.length+" files"+(data.truncated?" (partial; missing checks are inconclusive)":"")
 ])facts.append(make("li",line));
 const caution=make("p","No weighted health/security score is assigned. A recently pushed repository is not necessarily maintained or safe.");
 caution.className="rr-phase2-disclaimer";
 output.append(heading,intro,list,make("h4","Maintenance indicators"),facts,caution);
 status.textContent="Health signals generated from observable GitHub data"+(data.truncated?" (partial tree).":".");
}
window.addEventListener("reporouter:opened",()=>{token++;snapshot=null;output.replaceChildren();status.textContent="Loading GitHub repository details…";});
window.addEventListener("reporouter:repository-loaded",e=>{const data=e.detail;const repo=document.getElementById("explorer-name")?.textContent;
 if(!data||repo!==data.owner+"/"+data.repo)return;snapshot=data;token++;render(data);
});
window.addEventListener("reporouter:closed",()=>{token++;snapshot=null;output.replaceChildren();status.textContent="Open a repository to inspect its health signals.";});
})();