/* Repo Router architecture diagram: locally rendered from public GitHub metadata.
 * No stored GitDiagram document, external AI, or Mermaid CDN is required.
 * Solid edges: observed containment. Dashed edges: candidate relative imports.
 */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const NS = "http://www.w3.org/2000/svg";
  const ui = {
    status: $("gitdiagram-status"), summary: $("gitdiagram-summary"),
    graphic: $("gitdiagram-graphic"), source: $("gitdiagram-source"),
    build: $("gitdiagram-load"), scan: $("gitdiagram-scan"),
    external: $("gitdiagram-external"), copy: $("gitdiagram-copy")
  };
  if (Object.values(ui).some(x => !x)) return;
  let current = null, latestEdges = [], sourceText = "", generation = 0;
  const make = (tag, attrs={}, label=null) => {
    const e = document.createElementNS(NS, tag);
    for (const [name,value] of Object.entries(attrs)) e.setAttribute(name, String(value));
    if (label !== null) e.textContent = String(label);
    return e;
  };
  const status = (message, error=false) => {
    ui.status.textContent = message;
    ui.status.dataset.error = String(error);
  };
  const safeName = name => String(name || "").replace(/[\r\n"\\[\]{}<>]/g, " ").slice(0,80);
  const readmeName = name => safeName(name).replace(/\s+/g," ").trim();
  function fileGroup(path) {
    const i = path.indexOf("/");
    return i === -1 ? "@root" : path.slice(0,i);
  }
  function eligibleTree(tree) {
    return tree.filter(entry => entry && typeof entry.path === "string" &&
      !entry.path.startsWith("/") && !entry.path.includes("\\") &&
      !entry.path.split("/").some(part => part === "." || part === ".."));
  }
  function buckets(snapshot) {
    const list = eligibleTree(snapshot.tree);
    const files = list.filter(x => x.type === "blob");
    const groups = new Map();
    for (const f of files) {
      const key=fileGroup(f.path);
      if (!groups.has(key)) groups.set(key,{key,files:0,examples:[]});
      const item=groups.get(key);item.files++;
      if (item.examples.length<3)item.examples.push(f.path);
    }
    // Tree entries are meaningful even when they contain no returned blobs.
    for (const dir of list.filter(x=>x.type==="tree" && !x.path.includes("/"))) {
      if (!groups.has(dir.path)) groups.set(dir.path,{key:dir.path,files:0,examples:[]});
    }
    const score = entry => {
      const important = /^(?:src|app|lib|packages|backend|frontend|server|client|api|docs|test|tests|public|components|internal)$/i.test(entry.key) ? 500 : 0;
      return important + Math.min(entry.files,400);
    };
    const ordered = [...groups.values()].sort((a,b)=>score(b)-score(a)||a.key.localeCompare(b.key));
    const shown = ordered.slice(0,12);
    const omitted = Math.max(0,ordered.length-shown.length);
    return {shown, omitted, fileCount:files.length, groupCount:ordered.length};
  }
  const githubUrl = (s,key) => {
    const root="https://github.com/"+[s.owner,s.repo].map(encodeURIComponent).join("/");
    if (key==="@root") return root;
    return root+"/tree/"+encodeURIComponent(s.meta.default_branch||"HEAD")+"/"+encodeURIComponent(key);
  };
  function buildMermaid(s,selected,links) {
    const title = readmeName(s.owner+"/"+s.repo);
    const lines = ["flowchart TD",'  root["'+title+'"]'];
    const names = new Map(selected.map((g,i)=>[g.key,"n"+i]));
    selected.forEach((g,i)=>lines.push('  n'+i+'["'+readmeName(g.key==="@root"?"Root files":g.key)+
      " ("+g.files+" files)"+'"]'));
    selected.forEach((g,i)=>lines.push("  root --> n"+i));
    for (const edge of links) {
      const from=names.get(fileGroup(edge.from)),to=names.get(fileGroup(edge.to));
      if (from && to && from!==to) {
        const str="  "+from+" -.-> "+to;
        if (!lines.includes(str)) lines.push(str);
      }
    }
    return lines.join("\n");
  }
  function render(snapshot,edges=[]) {
    const version=++generation;
    const {shown,omitted,fileCount,groupCount}=buckets(snapshot);
    const cols=shown.length===1?1:Math.min(3,shown.length);
    const rows=Math.ceil(shown.length/cols);
    const width=1060, topY=185, gapX=340, gapY=155;
    const height=Math.max(350,topY+rows*gapY+62);
    const svg=make("svg",{xmlns:NS,viewBox:"0 0 "+width+" "+height,width,height,
      role:"img","aria-label":"Repository structure diagram with "+shown.length+" observable groups"});
    const defs=make("defs");
    const arrow=make("marker",{id:"rr-native-arrow",viewBox:"0 0 10 10",refX:9,refY:5,
      markerWidth:6,markerHeight:6,orient:"auto-start-reverse"});
    arrow.append(make("path",{d:"M 0 0 L 10 5 L 0 10 z",fill:"#64748b"}));
    const evidenceArrow=make("marker",{id:"rr-native-evidence-arrow",viewBox:"0 0 10 10",refX:9,refY:5,
      markerWidth:6,markerHeight:6,orient:"auto-start-reverse"});
    evidenceArrow.append(make("path",{d:"M 0 0 L 10 5 L 0 10 z",fill:"#C17822"}));
    defs.append(arrow,evidenceArrow);svg.append(defs);
    svg.append(make("rect",{x:0,y:0,width,height,fill:"#fffdf8",rx:14}));
    const rootX=width/2,rootY=65,nodeW=270,nodeH=76;
    const positions=new Map();
    shown.forEach((g,i)=>{
      const row=Math.floor(i/cols), col=i%cols;
      const rowCount=Math.min(cols,shown.length-row*cols);
      const x=width/2+(col-(rowCount-1)/2)*gapX, y=topY+row*gapY;
      positions.set(g.key,{x,y});
      svg.append(make("path",{d:"M "+rootX+" "+(rootY+39)+" C "+rootX+" "+(rootY+75)+", "+x+" "+(y-87)+", "+x+" "+(y-nodeH/2),
        stroke:"#94a3b8","stroke-width":2,fill:"none","marker-end":"url(#rr-native-arrow)"}));
    });
    // Cross-module import evidence is rendered behind nodes, using dashed amber curves.
    const grouped=new Map();
    for (const e of edges) {
      const a=fileGroup(e.from),b=fileGroup(e.to);
      if (a===b||!positions.has(a)||!positions.has(b))continue;
      const key=a+"→"+b;
      grouped.set(key,{a,b,count:(grouped.get(key)?.count||0)+1});
    }
    for (const edge of [...grouped.values()].slice(0,24)) {
      const p=positions.get(edge.a),q=positions.get(edge.b);
      const midX=(p.x+q.x)/2,midY=(p.y+q.y)/2;
      const offset=p.y===q.y?-65:50;
      const path=make("path",{d:"M "+p.x+" "+p.y+" Q "+midX+" "+(midY+offset)+" "+q.x+" "+q.y,
        stroke:"#C17822","stroke-width":Math.min(4,1.5+edge.count*.4),
        "stroke-dasharray":"8 5",fill:"none",opacity:.85,"marker-end":"url(#rr-native-evidence-arrow)"});
      path.append(make("title",{},edge.count+" sampled relative-import references: "+edge.a+" → "+edge.b));
      svg.append(path);
    }
    const rootLink=make("a",{href:githubUrl(snapshot,"@root"),target:"_blank",rel:"noopener noreferrer"});
    rootLink.append(make("rect",{x:rootX-205,y:rootY-39,width:410,height:78,rx:13,
      fill:"#233B75",stroke:"#15254C","stroke-width":2}));
    rootLink.append(make("text",{x:rootX,y:rootY-7,fill:"#fff","text-anchor":"middle",
      "font-family":"system-ui,sans-serif","font-size":18,"font-weight":750},safeName(snapshot.owner+"/"+snapshot.repo).slice(0,42)));
    rootLink.append(make("text",{x:rootX,y:rootY+20,fill:"#D8E5FF","text-anchor":"middle",
      "font-family":"system-ui,sans-serif","font-size":13},fileCount+" file paths returned by GitHub"));
    rootLink.append(make("title",{},"Open repository on GitHub"));
    svg.append(rootLink);
    for (const g of shown) {
      const {x,y}=positions.get(g.key);
      const link=make("a",{href:githubUrl(snapshot,g.key),target:"_blank",rel:"noopener noreferrer"});
      link.append(make("rect",{x:x-nodeW/2,y:y-nodeH/2,width:nodeW,height:nodeH,rx:11,
        fill:g.key==="@root"?"#FFF1DB":"#EDF3FF",stroke:g.key==="@root"?"#B8772C":"#4D72B8","stroke-width":2}));
      const display=g.key==="@root"?"Root-level files":g.key;
      link.append(make("text",{x,y:y-5,fill:"#17243B","text-anchor":"middle",
        "font-family":"system-ui,sans-serif","font-size":16,"font-weight":700},
        display.length>28?display.slice(0,25)+"…":display));
      link.append(make("text",{x,y:y+19,fill:"#43536B","text-anchor":"middle",
        "font-family":"system-ui,sans-serif","font-size":13},g.files+" observed files"));
      link.append(make("title",{},display+"\n"+g.examples.join("\n")+"\nOpen on GitHub"));
      svg.append(link);
    }
    svg.append(make("text",{x:24,y:height-20,fill:"#596579","font-family":"system-ui,sans-serif",
      "font-size":12},"Solid = GitHub tree grouping · Dashed amber = matched imports in sampled source · Click nodes to inspect"));
    if (version!==generation) return;
    ui.graphic.replaceChildren(svg);
    sourceText=buildMermaid(snapshot,shown,edges);
    ui.source.textContent=sourceText;ui.copy.disabled=false;
    ui.summary.textContent="First-party diagram from "+fileCount+" returned files across "+groupCount+
      " top-level groups"+(omitted?" ("+omitted+" smaller groups omitted for readability)":"")+
      ". "+grouped.size+" cross-group import relationships shown from sampled source"+
      (snapshot.truncated?". GitHub reported a partial tree.":"")+
      ". The diagram shows file organization, not verified runtime architecture.";
    status("Diagram ready. Click a node to inspect its GitHub path; use Inspect imports to add possible source relationships.");
  }
  function reset() {
    ++generation;current=null;latestEdges=[];sourceText="";
    ui.graphic.replaceChildren();ui.source.textContent="";
    ui.summary.textContent="Open a public repository to generate a diagram from its file structure.";
    ui.copy.disabled=true;ui.build.disabled=true;ui.scan.disabled=true;
    ui.external.href="https://gitdiagram.com";
    status("Waiting for a public GitHub repository.");
  }
  ui.build.addEventListener("click",()=>{
    if(current) render(current,latestEdges);
  });
  ui.scan.addEventListener("click",()=>{
    const feature=window.RepoRouterArchitectureEvidence;
    if (!current || !feature?.analyze) {
      status("Source inspection is unavailable. The directory diagram remains usable.",true);
      return;
    }
    ui.scan.disabled=true;
    status("Inspecting sampled source files for relative imports…");
    Promise.resolve(feature.analyze()).catch(e=>{
      status("Source inspection failed: "+(e.message||"unknown error"),true);
    }).finally(()=>{if(current)ui.scan.disabled=false;});
  });
  ui.copy.addEventListener("click",async()=>{
    if(!sourceText)return;
    try{await navigator.clipboard.writeText(sourceText);status("Mermaid source copied.");}
    catch{status("Clipboard unavailable; select Mermaid source below to copy.",true);}
  });
  window.addEventListener("reporouter:opened",e=>{
    reset();
    const repo=String(e.detail?.repo||"");
    if (/^[a-z0-9-]{1,39}\/[a-z0-9_.-]{1,100}$/i.test(repo)) {
      ui.external.href="https://gitdiagram.com/"+repo.split("/").map(encodeURIComponent).join("/");
    }
  });
  window.addEventListener("reporouter:repository-loaded",e=>{
    const s=e.detail;
    if(!s||!Array.isArray(s.tree)||!s.meta||typeof s.owner!=="string"||typeof s.repo!=="string")return;
    current=s;latestEdges=[];ui.build.disabled=false;ui.scan.disabled=false;
    render(s);
  });
  window.addEventListener("reporouter:architecture-evidence",e=>{
    const detail=e.detail;
    if(!current||!detail||detail.owner!==current.owner||detail.repo!==current.repo)return;
    latestEdges=Array.isArray(detail.edges)?detail.edges.filter(x=>x&&typeof x.from==="string"&&typeof x.to==="string"):[];
    render(current,latestEdges);
    status("Updated diagram with "+latestEdges.length+" candidate source references from "+
      (detail.filesInspected||0)+" sampled files. Dashed edges require verification.");
  });
  window.addEventListener("reporouter:closed",reset);
  reset();
  window.RepoRouterNativeDiagram={buckets,buildMermaid};
})();
