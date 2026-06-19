// repo-router — turns a github.com URL into its gitmcp.io or gitingest.com counterpart.

type Mode = "mcp" | "structure";

interface RepoMatch {
  owner: string;
  repo: string;
  rest: string; // trailing path (branch, subfolder, etc.), preserved as-is
}

const TARGET_HOST: Record<Mode, string> = {
  mcp: "gitmcp.io",
  structure: "gitingest.com",
};

// Accepts github.com/owner/repo, with or without protocol/www, trailing slash,
// .git suffix, or extra path segments (preserved on the output URL).
const GITHUB_URL_RE =
  /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(\/.*)?\/?$/i;

function parseGithubUrl(raw: string): RepoMatch | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(GITHUB_URL_RE);
  if (!match) return null;
  const [, owner, repo, rest] = match;
  if (!owner || !repo) return null;
  return { owner, repo, rest: rest ?? "" };
}

function buildTargetUrl(parsed: RepoMatch, mode: Mode): string {
  const host = TARGET_HOST[mode];
  return `https://${host}/${parsed.owner}/${parsed.repo}${parsed.rest}`;
}

function normalizedSource(parsed: RepoMatch): string {
  return `https://github.com/${parsed.owner}/${parsed.repo}${parsed.rest}`;
}

// --- DOM wiring -------------------------------------------------------

const els = {
  input: document.getElementById("repo-input") as HTMLInputElement,
  toggleMcp: document.getElementById("toggle-mcp") as HTMLButtonElement,
  toggleStructure: document.getElementById("toggle-structure") as HTMLButtonElement,
  submit: document.getElementById("submit-btn") as HTMLButtonElement,
  diffWrap: document.getElementById("diff-wrap") as HTMLElement,
  diffOldText: document.querySelector("#diff-old span:last-child") as HTMLElement,
  diffNewText: document.querySelector("#diff-new span:last-child") as HTMLElement,
  status: document.getElementById("status-line") as HTMLElement,
  copyBtn: document.getElementById("copy-btn") as HTMLButtonElement,
  copyText: document.getElementById("copy-text") as HTMLElement,
  copyIcon: document.querySelector("#copy-btn .material-symbols-outlined") as HTMLElement,
};

let mode: Mode = "mcp";
let lastTransformed: string | null = null;
let copyResetTimer: number | undefined;

function setMode(next: Mode): void {
  mode = next;
  els.toggleMcp.classList.toggle("active", mode === "mcp");
  els.toggleMcp.setAttribute("aria-pressed", String(mode === "mcp"));
  els.toggleStructure.classList.toggle("active", mode === "structure");
  els.toggleStructure.setAttribute("aria-pressed", String(mode === "structure"));
  render();
}

function setStatus(text: string, tone: "idle" | "ready" | "error"): void {
  els.status.textContent = text;
  const base = "text-sm font-bold";
  const toneClass =
    tone === "ready" ? "text-green-600" : tone === "error" ? "text-red-500" : "text-gray-400 italic";
  els.status.className = `${base} ${toneClass}`;
}

function render(): void {
  const raw = els.input.value.trim();
  const parsed = parseGithubUrl(raw);

  if (!raw) {
    setStatus("Waiting for input...", "idle");
    els.submit.disabled = true;
    els.diffWrap.classList.remove("visible");
    lastTransformed = null;
    return;
  }

  if (!parsed) {
    setStatus("Invalid repository URL", "error");
    els.submit.disabled = true;
    els.diffWrap.classList.remove("visible");
    lastTransformed = null;
    return;
  }

  const transformed = buildTargetUrl(parsed, mode);
  els.diffOldText.textContent = normalizedSource(parsed);
  els.diffNewText.textContent = transformed;
  els.diffWrap.classList.add("visible");
  setStatus("Ready to route!", "ready");
  els.submit.disabled = false;
  lastTransformed = transformed;
}

function submit(): void {
  if (!lastTransformed) {
    render();
    return;
  }
  window.open(lastTransformed, "_blank", "noopener,noreferrer");
}

function copyResult(): void {
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

els.input.addEventListener("input", render);
els.toggleMcp.addEventListener("click", () => setMode("mcp"));
els.toggleStructure.addEventListener("click", () => setMode("structure"));
els.submit.addEventListener("click", submit);
els.copyBtn.addEventListener("click", copyResult);
els.input.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Enter" && !els.submit.disabled) submit();
});

setMode("mcp");
