"use strict";
// repo-router — turns a github.com URL into its target tool counterpart.

const TARGET_HOST = {
  mcp: "gitmcp.io",
  structure: "gitingest.com",
  deepwiki: "deepwiki.com",
  uithub: "uithub.com",
};

const TRENDING_REPOS = [
  "vercel/next.js", "facebook/react", "vuejs/vue", "microsoft/vscode",
  "torvalds/linux", "tensorflow/tensorflow", "antirez/redis",
  "golang/go", "rust-lang/rust", "denoland/deno",
];

const LANG_COLORS = {
  JavaScript: "#f1e05a", TypeScript: "#2b7489", Python: "#3572A5",
  Go: "#00ADD8", Rust: "#dea584", Java: "#b07219", Ruby: "#701516",
  PHP: "#4F5D95", CSS: "#563d7c", HTML: "#e34c26", Shell: "#89e051",
  "C": "#555555", "C++": "#f34b7d", "C#": "#178600", Swift: "#ffac45",
};

const BASE_URL = "https://reporouter.netlify.app/";

const GITHUB_URL_RE =
  /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(\/.*)?\/?$/i;

// --- Pure functions ---------------------------------------------------

function parseGithubUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(GITHUB_URL_RE);
  if (!match) return null;
  const [, owner, repo, rest] = match;
  if (!owner || !repo) return null;
  return { owner, repo, rest: rest ?? "" };
}

function buildTargetUrl(parsed, mode) {
  return `https://${TARGET_HOST[mode]}/${parsed.owner}/${parsed.repo}${parsed.rest}`;
}

function buildDeeplink(parsed, mode) {
  return `${BASE_URL}?repo=${parsed.owner}/${parsed.repo}&mode=${mode}`;
}

function normalizedSource(parsed) {
  return `https://github.com/${parsed.owner}/${parsed.repo}${parsed.rest}`;
}

function fmtNum(n) {
  return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n);
}

// --- Recent repos (localStorage) --------------------------------------

const RECENTS_KEY = "rr_recents";

function getRecents() {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]"); }
  catch { return []; }
}

function saveRecent(slug) {
  let recents = getRecents().filter((r) => r !== slug);
  recents.unshift(slug);
  recents = recents.slice(0, 5);
  try { localStorage.setItem(RECENTS_KEY, JSON.stringify(recents)); } catch { /* noop */ }
}

// --- GitHub meta API --------------------------------------------------

const metaCache = new Map();

async function fetchMeta(owner, repo) {
  const key = `${owner}/${repo}`;
  if (metaCache.has(key)) return metaCache.get(key);
  try {
    const res = await fetch(`https://api.github.com/repos/${key}`);
    if (!res.ok) { metaCache.set(key, null); return null; }
    const data = await res.json();
    metaCache.set(key, data);
    return data;
  } catch {
    metaCache.set(key, null);
    return null;
  }
}

// --- DOM element refs -------------------------------------------------

const els = {
  input:          document.getElementById("repo-input"),
  recents:        document.getElementById("recents-wrap"),
  destBtns:       document.querySelectorAll("[data-mode]"),
  submit:         document.getElementById("submit-btn"),
  copyBtn:        document.getElementById("copy-btn"),
  shareBtn:       document.getElementById("share-btn"),
  qrBtn:          document.getElementById("qr-btn"),
  surpriseBtn:    document.getElementById("surprise-btn"),
  diffWrap:       document.getElementById("diff-wrap"),
  diffOldText:    document.querySelector("#diff-old span:last-child"),
  diffNewText:    document.querySelector("#diff-new span:last-child"),
  status:         document.getElementById("status-line"),
  copyText:       document.getElementById("copy-text"),
  copyIcon:       document.querySelector("#copy-btn .material-symbols-outlined"),
  metaWrap:       document.getElementById("meta-wrap"),
  badgeWrap:      document.getElementById("badge-wrap"),
  badgeSnippet:   document.getElementById("badge-snippet"),
  qrSection:      document.getElementById("qr-section"),
  qrCanvas:       document.getElementById("qr-canvas"),
  resultPanel:    document.getElementById("result-panel"),
  resultFrame:    document.getElementById("result-frame"),
  resultUrl:      document.getElementById("result-url"),
  resultOpenLink: document.getElementById("result-open-link"),
};

// --- State ------------------------------------------------------------

let mode = "mcp";
let currentParsed = null;
let lastTransformed = null;
let copyResetTimer;
let qrVisible = false;

// --- Recents rendering ------------------------------------------------

function renderRecents() {
  const recents = getRecents();
  if (!recents.length) { els.recents.innerHTML = ""; return; }
  els.recents.innerHTML =
    recents.map((r) => `<button class="recent-chip" data-repo="${r}">${r}</button>`).join("") +
    `<button class="recent-chip recent-chip--clear" id="clear-recents">✕ clear</button>`;

  els.recents.querySelectorAll("[data-repo]").forEach((btn) => {
    btn.addEventListener("click", () => {
      els.input.value = "https://github.com/" + btn.dataset.repo;
      render();
    });
  });

  document.getElementById("clear-recents")?.addEventListener("click", () => {
    try { localStorage.removeItem(RECENTS_KEY); } catch { /* noop */ }
    renderRecents();
  });
}

// --- Meta card rendering ----------------------------------------------

function renderMeta(data) {
  if (!data) { els.metaWrap.hidden = true; return; }
  const langColor = data.language && LANG_COLORS[data.language]
    ? `<span class="meta-lang-dot" style="background:${LANG_COLORS[data.language]}"></span>` : "";
  const updated = new Date(data.updated_at).toLocaleDateString("en", { month: "short", year: "numeric" });
  els.metaWrap.hidden = false;
  els.metaWrap.innerHTML = `
    <div class="repo-meta">
      <span class="meta-name">${data.full_name}</span>
      <span class="meta-item"><span class="material-symbols-outlined" aria-hidden="true">star</span>${fmtNum(data.stargazers_count)}</span>
      ${data.language ? `<span class="meta-item">${langColor}${data.language}</span>` : ""}
      <span class="meta-item"><span class="material-symbols-outlined" aria-hidden="true">schedule</span>${updated}</span>
      ${data.description ? `<span class="meta-desc" title="${data.description}">${data.description}</span>` : ""}
    </div>`;
}

// --- Badge snippet rendering ------------------------------------------

function renderBadge(parsed) {
  if (!parsed) { els.badgeWrap.hidden = true; return; }
  const deeplink = buildDeeplink(parsed, mode);
  const badgeImg = `https://img.shields.io/badge/Open%20in-RepoRouter-blue?logo=github`;
  const md = `[![Open in RepoRouter](${badgeImg})](${deeplink})`;
  els.badgeWrap.hidden = false;
  els.badgeSnippet.textContent = md;
  els.badgeSnippet.dataset.clipboard = md;
}

// --- QR code ----------------------------------------------------------

function renderQr(url) {
  const canvas = els.qrCanvas;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const QR = window.QRCode;
  if (!QR) return;
  canvas.width = 180;
  canvas.height = 180;
  new QR(canvas, { width: 180, height: 180, colorDark: "#000", colorLight: "#fff", correctLevel: QR.CorrectLevel.M });
}

// --- Status helper ----------------------------------------------------

function setStatus(text, tone) {
  els.status.textContent = text;
  els.status.dataset.tone = tone;
}

// --- Core render ------------------------------------------------------

function render() {
  const raw = els.input.value.trim();
  const parsed = parseGithubUrl(raw);
  currentParsed = parsed;

  if (!raw) {
    setStatus("Waiting for input...", "idle");
    els.submit.disabled = true;
    els.copyBtn.disabled = true;
    els.diffWrap.classList.remove("visible");
    els.metaWrap.hidden = true;
    els.badgeWrap.hidden = true;
    els.shareBtn.hidden = true;
    els.qrBtn.hidden = true;
    lastTransformed = null;
    return;
  }

  if (!parsed) {
    setStatus("Invalid repository URL", "error");
    els.submit.disabled = true;
    els.copyBtn.disabled = true;
    els.diffWrap.classList.remove("visible");
    els.metaWrap.hidden = true;
    els.badgeWrap.hidden = true;
    els.shareBtn.hidden = true;
    els.qrBtn.hidden = true;
    lastTransformed = null;
    return;
  }

  const transformed = buildTargetUrl(parsed, mode);
  lastTransformed = transformed;

  els.diffOldText.textContent = normalizedSource(parsed);
  els.diffNewText.textContent = transformed;
  els.diffWrap.classList.add("visible");
  setStatus("Ready to route!", "ready");
  els.submit.disabled = false;
  els.copyBtn.disabled = false;
  els.shareBtn.hidden = false;
  els.qrBtn.hidden = false;

  fetchMeta(parsed.owner, parsed.repo).then(renderMeta);
  renderBadge(parsed);
}

// --- Mode switching ---------------------------------------------------

function setMode(next) {
  mode = next;
  els.destBtns.forEach((btn) => {
    const active = btn.dataset.mode === mode;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  render();
}

// --- Submit / open ----------------------------------------------------

function submit() {
  if (!lastTransformed || !currentParsed) { render(); return; }
  saveRecent(`${currentParsed.owner}/${currentParsed.repo}`);
  renderRecents();
  els.resultUrl.textContent = lastTransformed.replace("https://", "");
  els.resultOpenLink.href = lastTransformed;
  els.resultFrame.src = lastTransformed;
  els.resultPanel.classList.remove("hidden");
  els.resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

// --- Copy result URL --------------------------------------------------

function copyResult() {
  if (!lastTransformed) return;
  navigator.clipboard.writeText(lastTransformed).then(() => {
    const originalIcon = els.copyIcon.textContent;
    els.copyText.textContent = "Copied!";
    els.copyIcon.textContent = "check_circle";
    if (copyResetTimer) window.clearTimeout(copyResetTimer);
    copyResetTimer = window.setTimeout(() => {
      els.copyText.textContent = "Copy";
      els.copyIcon.textContent = originalIcon ?? "content_copy";
    }, 2000);
  });
}

// --- Share (Web Share API + deep-link fallback) -----------------------

function shareLink() {
  if (!lastTransformed || !currentParsed) return;
  const shareUrl = buildDeeplink(currentParsed, mode);
  if (navigator.share) {
    navigator.share({
      title: "RepoRouter",
      text: `Open ${currentParsed.owner}/${currentParsed.repo} in ${TARGET_HOST[mode]}`,
      url: shareUrl,
    }).catch(() => { /* user cancelled */ });
  } else {
    navigator.clipboard.writeText(shareUrl);
  }
}

// --- QR toggle --------------------------------------------------------

function toggleQr() {
  if (!lastTransformed) return;
  qrVisible = !qrVisible;
  els.qrSection.hidden = !qrVisible;
  if (qrVisible) renderQr(lastTransformed);
}

// --- Badge copy -------------------------------------------------------

function copyBadge() {
  const md = els.badgeSnippet?.dataset.clipboard;
  if (!md) return;
  navigator.clipboard.writeText(md).then(() => {
    const orig = els.badgeSnippet.textContent;
    els.badgeSnippet.textContent = "✓ Copied!";
    setTimeout(() => { els.badgeSnippet.textContent = orig ?? ""; }, 2000);
  });
}

// --- Surprise me ------------------------------------------------------

function surpriseMe() {
  const pick = TRENDING_REPOS[Math.floor(Math.random() * TRENDING_REPOS.length)];
  els.input.value = "https://github.com/" + pick;
  render();
}

// --- URL param deep-linking -------------------------------------------

function readUrlParams() {
  try {
    const params = new URLSearchParams(window.location.search);
    const repo = params.get("repo");
    const modeParam = params.get("mode");
    if (repo) {
      els.input.value = repo.includes("github.com") ? repo : "https://github.com/" + repo;
      if (modeParam && modeParam in TARGET_HOST) setMode(modeParam);
      else render();
    }
  } catch { /* noop */ }
}

// --- Event listeners --------------------------------------------------

els.input.addEventListener("input", render);
els.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !els.submit.disabled) submit();
});

els.destBtns.forEach((btn) => {
  btn.addEventListener("click", () => setMode(btn.dataset.mode));
});

els.submit.addEventListener("click", submit);
els.copyBtn.addEventListener("click", copyResult);
els.shareBtn.addEventListener("click", shareLink);
els.qrBtn.addEventListener("click", toggleQr);
els.surpriseBtn.addEventListener("click", surpriseMe);
document.getElementById("badge-copy-btn")?.addEventListener("click", copyBadge);

// --- Init -------------------------------------------------------------

renderRecents();
readUrlParams();
setMode("mcp");
