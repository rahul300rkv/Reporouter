/* Repo Router Explorer — first-party public GitHub repository explorer.
 * No dependency or token. Large/binary files are skipped, never executed.
 */
(() => {
  'use strict';
  const API = 'https://api.github.com/repos/';
  const MAX_FILES = 20, MAX_FILE_BYTES = 60_000, MAX_TOTAL_BYTES = 650_000;
  const $ = (id) => document.getElementById(id);
  const ui = {
    panel: $('explorer-panel'), status: $('explorer-status'), name: $('explorer-name'),
    overview: $('explorer-overview'), tree: $('explorer-tree'), viewer: $('explorer-viewer'),
    fileName: $('explorer-file-name'), tabButtons: [...document.querySelectorAll('[data-explorer-tab]')],
    tabPanels: [...document.querySelectorAll('[data-explorer-pane]')],
    filter: $('explorer-filter'), digest: $('explorer-digest'),
    digestInfo: $('explorer-digest-info'), create: $('explorer-generate'),
    copy: $('explorer-copy'), download: $('explorer-download'),
    include: $('explorer-include'), exclude: $('explorer-exclude'),
    extLink: $('explorer-external'), toolLink: $('explorer-tool-link'), close: $('explorer-close'),
  };
  if (!ui.panel || !ui.tree || !ui.digest) return;
  let state = null;
  let requestVersion = 0;
  let activeController = null;
  let previewVersion = 0;
  const DEFAULT_EXCLUDE = /(^|\/)(\.git|node_modules|vendor|dist|build|coverage|\.next|\.venv|venv|target|__pycache__)(\/|$)|\.(?:png|jpg|jpeg|gif|webp|svg|ico|pdf|zip|gz|tar|7z|exe|dll|so|dylib|woff2?|ttf|mp[34]|mov|lock|map|class|pyc|wasm)$/i;
  const SECRET = /(^|\/)(\.env(?:\..*)?|id_rsa|id_ed25519|[^/]*\.(?:pem|key|p12|pfx)|credentials(?:\.[^/]*)?|secrets?(?:\.[^/]*)?)(\/|$)/i;
  const errText = (code) => code === 403 ? 'GitHub API rate limit or access restriction. Try later or open GitHub directly.' : code === 404 ? 'Public repository or file not found.' : `GitHub request failed (HTTP ${code}).`;
  const msg = (text, error=false) => { ui.status.textContent = text; ui.status.dataset.error = String(error); };
  const safePath = path => typeof path === 'string' && !path.startsWith('/') && !path.includes('\\') && !path.split('/').some(x => x === '..' || x === '.') && path.length < 2048;
  function reset() {
    if (activeController) activeController.abort();
    activeController = new AbortController();
    ++previewVersion;
    const version = ++requestVersion;
    ui.tree.replaceChildren(); ui.viewer.textContent = 'Choose a file to preview.';
    ui.fileName.textContent = 'File preview'; ui.digest.value = '';
    ui.digestInfo.textContent = 'No digest generated.';
    ui.copy.disabled = true; ui.download.disabled = true; ui.create.disabled = false;
    ui.filter.value = '';
    ui.overview.replaceChildren();
    switchTab('overview');
    return {version, signal: activeController.signal};
  }
  async function api(url, signal) {
    const res = await fetch(url, {headers: {Accept: 'application/vnd.github+json'}, signal});
    if (!res.ok) throw new Error(errText(res.status));
    return res.json();
  }
  function switchTab(tab) {
    ui.tabButtons.forEach(b => {const active = b.dataset.explorerTab === tab; b.setAttribute('aria-selected',String(active)); b.tabIndex = active ? 0 : -1;});
    ui.tabPanels.forEach(p => p.hidden = p.dataset.explorerPane !== tab);
  }
  ui.tabButtons.forEach(b => b.addEventListener('click', () => switchTab(b.dataset.explorerTab)));
  ui.close.addEventListener('click', () => {if(activeController)activeController.abort();++requestVersion;ui.panel.hidden=true;state=null;window.dispatchEvent(new Event('reporouter:closed'));});
  const linkFor = (owner,repo,path) => `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/blob/${encodeURIComponent(state?.meta?.default_branch || 'HEAD')}/${path.split('/').map(encodeURIComponent).join('/')}`;
  function setOverview(meta, tree) {
    ui.overview.replaceChildren();
    const lines = [meta.description || 'No repository description.', `Default branch: ${meta.default_branch}`, `Language: ${meta.language || 'Unspecified'}`, `Stars: ${Number(meta.stargazers_count || 0).toLocaleString()}`, `${tree.length.toLocaleString()} paths returned by GitHub`];
    lines.forEach(v=>{const p=document.createElement('p');p.textContent=v;ui.overview.append(p);});
  }
  function listTree(filter='') {
    ui.tree.replaceChildren();
    if(!state) return;
    const lower = filter.trim().toLowerCase();
    const paths = state.tree.filter(x => !lower || x.path.toLowerCase().includes(lower)).slice(0,1000);
    const fragment=document.createDocumentFragment();
    for(const file of paths){
      const btn=document.createElement('button');btn.type='button';btn.className='explorer-file';
      btn.textContent=`${file.type==='tree' ? '📁' : '📄'} ${file.path}`;
      btn.title=file.path;
      if(file.type!=='blob'){btn.disabled=true;}
      else btn.addEventListener('click',()=>viewFile(file));
      fragment.append(btn);
    }
    ui.tree.append(fragment);
    if(state.tree.length>1000 && !lower){const note=document.createElement('p');note.textContent='Showing first 1,000 paths; use the filter to find another file.';ui.tree.append(note);}
  }
  async function loadText(file, signal) {
    if(!safePath(file.path)) throw new Error('Invalid file path.');
    if(file.size > MAX_FILE_BYTES) throw new Error(`File exceeds the ${Math.round(MAX_FILE_BYTES/1000)} KB viewer/digest limit.`);
    if(DEFAULT_EXCLUDE.test(file.path)||SECRET.test(file.path))throw new Error('File skipped by safety/format filter.');
    const key=file.path;
    if(state.cache.has(key)) return state.cache.get(key);
    const owner=encodeURIComponent(state.owner), repo=encodeURIComponent(state.repo);
    // Git blobs are fetched by immutable SHA, avoiding slash/ref ambiguity.
    const data=await api(`${API}${owner}/${repo}/git/blobs/${encodeURIComponent(file.sha)}`, signal);
    if(data.encoding!=='base64' || !data.content)throw new Error('GitHub returned an unsupported file encoding.');
    const raw=atob(data.content.replace(/\s/g,''));
    if(raw.length>MAX_FILE_BYTES)throw new Error('File exceeds size limit.');
    if(raw.includes('\0'))throw new Error('Binary files cannot be displayed.');
    const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    state.cache.set(key,text);
    return text;
  }
  async function viewFile(file){
    if(!state)return;
    const current=state;
    const preview=++previewVersion;
    const {signal}=current.controller;
    ui.fileName.textContent=file.path;
    ui.viewer.textContent='Loading file…';
    switchTab('files');
    try {const content=await loadText(file,signal);if(state!==current||preview!==previewVersion)return;ui.viewer.textContent=content;}
    catch(e){if(state!==current||preview!==previewVersion||e.name==='AbortError')return;ui.viewer.textContent=e.message;}
  }
  const globToRegex = (glob) => {
    const escaped=glob.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*\*/g,'\u0000').replace(/\*/g,'[^/]*').replace(/\u0000/g,'.*').replace(/\?/g,'.');
    return new RegExp('^'+escaped+'$','i');
  };
  function patterns(str){return str.split(/[\n,]+/).map(x=>x.trim()).filter(Boolean).slice(0,30).map(globToRegex);}
  function matches(rules,path){return !rules.length||rules.some(rx=>rx.test(path)||rx.test(path.split('/').pop()));}
  function excludes(rules,path){return rules.some(rx=>rx.test(path)||rx.test(path.split('/').pop()));}
  async function generate(){
    if(!state)return;
    const current=state;
    const {signal}=current.controller;
    let allowed,exclude;
    try {allowed=patterns(ui.include.value);exclude=patterns(ui.exclude.value);}catch(e){msg(`Invalid filter pattern: ${e.message}`,true);return;}
    let selected=current.tree.filter(f=>f.type==='blob' && safePath(f.path) && f.size<=MAX_FILE_BYTES && !DEFAULT_EXCLUDE.test(f.path) && !SECRET.test(f.path) && matches(allowed,f.path) && !excludes(exclude,f.path));
    const totalEligible=selected.length;
    if(current.truncated)msg('Warning: GitHub supplied a partial file tree; this digest is incomplete.');
    selected=selected.slice(0,MAX_FILES);
    if(!selected.length){msg('No eligible text files match these filters.',true);return;}
    ui.create.disabled=true;ui.copy.disabled=true;ui.download.disabled=true;
    ui.digest.value=''; ui.digestInfo.textContent='Generating digest…';
    const sections=[`Repository: ${current.owner}/${current.repo}`,`Branch: ${current.meta.default_branch}`,`Files selected: ${selected.length} (eligible: ${totalEligible})`,'','Directory / file list:',...selected.map(f=>f.path),''];
    let bytes=0, included=0, skipped=0;
    try {
      for(const file of selected){
        if(state!==current) return;
        msg(`Generating digest: ${included+skipped+1}/${selected.length} files…`);
        if(bytes+file.size>MAX_TOTAL_BYTES){skipped++;continue;}
        try {const content=await loadText(file,signal);const length=new TextEncoder().encode(content).length;if(bytes+length>MAX_TOTAL_BYTES){skipped++;continue;}bytes+=length;sections.push(`\n===== FILE: ${file.path} =====\n`,content);included++;}
        catch(e){if(e.name==='AbortError')throw e;skipped++;}
      }
      if(state!==current)return;
      if(!included)throw new Error('No readable text files were available within the size limits.');
      ui.digest.value=sections.join('\n');
      ui.digestInfo.textContent=`${included} files · ${Math.round(bytes/1024)} KiB text · ${skipped} skipped${totalEligible>MAX_FILES ? ` · ${totalEligible-MAX_FILES} eligible files omitted by request cap` : ''}${current.truncated ? ' · partial GitHub tree' : ''}. Capped at ${MAX_FILES} files / ${Math.round(MAX_TOTAL_BYTES/1024)} KiB. Public repositories only.`;
      ui.copy.disabled=false;ui.download.disabled=false;
      msg('Digest ready. Review content for sensitive information before sharing.');
      switchTab('digest');
    }catch(e){if(e.name!=='AbortError'){ui.digestInfo.textContent='Digest could not be generated.';msg(e.message,true);}}
    finally {if(state===current)ui.create.disabled=false;}
  }
  ui.filter.addEventListener('input',()=>listTree(ui.filter.value));
  ui.create.addEventListener('click',generate);
  ui.copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(ui.digest.value);msg('Digest copied.');}catch{msg('Clipboard unavailable. Select and copy the text manually.',true);}});
  ui.download.addEventListener('click',()=>{if(!state||!ui.digest.value)return;const blob=new Blob([ui.digest.value],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${state.owner}-${state.repo}-digest.txt`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);});
  async function open(parsed, selectedToolUrl){
    if(!parsed || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(parsed.owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(parsed.repo) || parsed.repo==='.' || parsed.repo==='..'){msg('Enter a valid GitHub owner/repository URL.',true);return;}
    const {version,signal}=reset();
    ui.panel.hidden=false;ui.panel.scrollIntoView({behavior:'smooth',block:'start'});
    ui.name.textContent=`${parsed.owner}/${parsed.repo}`;
    window.dispatchEvent(new CustomEvent('reporouter:opened',{detail:{repo:`${parsed.owner}/${parsed.repo}`}}));
    // Users selecting DeepWiki should see their wiki in Repo Router, not a generic overview.
    if(typeof selectedToolUrl==='string' && /^https:\/\/deepwiki\.com\//i.test(selectedToolUrl)) {
      switchTab('deepwiki');
      window.dispatchEvent(new Event('reporouter:deepwiki-selected'));
    }
    ui.extLink.href=`https://github.com/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`;
    // Accept only known destination hosts, never a user-supplied arbitrary URL.
    try {const u=new URL(selectedToolUrl);ui.toolLink.href=['gitmcp.io','gitingest.com','deepwiki.com','uithub.com'].includes(u.hostname)&&u.protocol==='https:'?u.href:ui.extLink.href;} catch {ui.toolLink.href=ui.extLink.href;}
    msg('Fetching repository information from GitHub…');
    try {
      const base=API+encodeURIComponent(parsed.owner)+'/'+encodeURIComponent(parsed.repo);
      const meta=await api(base,signal);
      if(version!==requestVersion)return;
      const rootSha=meta.default_branch; // GitHub trees API accepts a branch name; follow default branch.
      const treeData=await api(`${base}/git/trees/${encodeURIComponent(rootSha)}?recursive=1`,signal);
      if(version!==requestVersion)return;
      const tree=(Array.isArray(treeData.tree)?treeData.tree:[]).filter(f=>safePath(f.path) && (f.type==='tree'||f.type==='blob')).sort((a,b)=>a.path.localeCompare(b.path));
      state={owner:parsed.owner,repo:parsed.repo,meta,tree,cache:new Map(),controller:activeController,truncated:Boolean(treeData.truncated)};
      setOverview(meta,tree);listTree();
      msg(treeData.truncated?'Loaded a partial tree (GitHub truncated this large repository). Digest may omit files.':'Repository loaded. Browse files or generate a text digest.');
    }catch(e){if(e.name==='AbortError'||version!==requestVersion)return;msg(e.message,true);ui.overview.textContent='Unable to load this repository. Use the GitHub link above or try again later.';}
  }
  window.RepoRouterExplorer={open};
})();