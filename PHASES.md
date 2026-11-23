# Repo Router — two-phase product roadmap

## Phase 1: independent value on first visit (implemented on this branch)

1. **Repository Intelligence Dashboard:** public GitHub metadata, common manifest detection, README detection, top-level paths, and explicit partial-tree evidence. No fabricated "health score".
2. **Goal-based AI Context Builder:** goal-specific filename/path ranking, explicit file selection (maximum 12), public GitHub blob fetching, approximate 4k/8k/16k/32k token budgets, copy/download, file source links, and safety/size filters. Uses Explorer's existing API and cache; does not invoke an AI model.
3. **GitHub URL Tricks Hub:** official GitHub source/editor/actions/commits/releases plus GitHub1s, GitIngest, DeepWiki, GitDiagram, GitMCP, StackBlitz; clearly label third parties and compatibility caveats.

## Phase 2: deeper insight and retention (not implemented)

1. **Repository Health & Maintenance Signals:** inspect manifest presence, release/commit/issue recency, LICENSE/SECURITY.md and workflows; present evidence, not speculative safety or quality scores.
2. **Evidence-Linked Architecture:** map components to observed files and links, distinguish parsed dependencies from inferred AI diagram edges.
3. **Compare & Change Explorer:** repository-vs-repository metadata and dependencies; version/branch change summaries using GitHub comparison APIs with clear rate/size limits.
4. **Local Personal Workspace:** saved public repositories, browser-local notes and comparisons, export/import, with explicit privacy and storage controls.

No authentication, remote storage, proprietary LLM hosting, or third-party code-upload integration is included in these phases. External services remain optional tabs.

## Phase 1 acceptance criteria

- Existing Explorer, Digest, DeepWiki, GitMCP, and GitDiagram stay operational.
- No repository code is sent to Repo Router's backend by these new features.
- The Intelligence dashboard makes no unsupported AI/security claims.
- Switching repositories invalidates stale context requests and views.
- Unsafe / large files are skipped and are not evaluated or executed.
- Output carries GitHub source links and marks token counts as approximate.
- URL shortcuts are marked as external, with no claim of live availability.
- Release must pass JavaScript syntax, mocked event-flow tests, and Netlify preview deployment. Real-browser/network verification is required before main merge.

This branch intentionally does not include fixes awaiting review in separate PRs #2 and #3.
