# Repo Router — two-phase product roadmap

## Phase 1: independent value on first visit (merged into main)

1. **Repository Intelligence Dashboard:** public GitHub metadata, common manifest detection, README detection, top-level paths, and explicit partial-tree evidence. No fabricated "health score".
2. **Goal-based AI Context Builder:** goal-specific filename/path ranking, explicit file selection (maximum 12), public GitHub blob fetching, approximate 4k/8k/16k/32k token budgets, copy/download, file source links, and safety/size filters. Uses Explorer's existing API and cache; does not invoke an AI model.
3. **GitHub URL Tricks Hub:** official GitHub source/editor/actions/commits/releases plus GitHub1s, GitIngest, DeepWiki, GitDiagram, GitMCP, StackBlitz; clearly label third parties and compatibility caveats.

## Phase 2: deeper insight and retention (merged into main via PR #5)

1. **Repository Health & Maintenance Signals:** inspect returned README/LICENSE/SECURITY.md, CI/test/dependency filenames and GitHub push/issue/archived metadata. Present observed evidence, not speculative safety or quality scores. Does not inspect release histories or run tests.
2. **Evidence-Linked Architecture:** inspect at most 24 public JavaScript/TypeScript/Python text files; match relative import syntax to existing filenames and link each candidate edge to GitHub source. Parsing is heuristic and may produce false positives; not a complete architecture graph.
3. **Compare & Change Explorer:** compare two public repositories' GitHub metadata and common manifest paths, or compare two branch/tag revisions of one repository using GitHub's compare API. GitHub rate and result-size limits apply; no full dependency analysis.
4. **Local Personal Workspace:** browser-local saved public repositories and notes, JSON export/import, and deletion. Does not save cross-repo comparison results. No account or cloud sync.

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

## Phase 2 acceptance criteria

- Four new tabs operate inside the existing Explorer without replacing Phase 1 or external integrations.
- Public GitHub requests go only to api.github.com using validated repo and ref identifiers.
- Architecture inspects a bounded subset of source and labels edges as heuristic observations, never definitive execution relationships.
- Health reports explicit evidence, not a security, dependency-vulnerability or quality score.
- Workspace data never leaves localStorage except on explicit user-triggered JSON export; import validates type, count, length and repository syntax.
- Switching or closing a repository invalidates ongoing architecture and compare results.
- Run syntax, mocked user workflows, security review and Netlify preview checks before requesting merge.

## Deployment boundaries

- Previous DeepWiki and GitDiagram improvements are now part of the main branch.
- Phase 2 was merged through PR #5 on November 24, 2026. Future improvements should use separate review branches.
- Real GitHub rate limits, mobile browsers, source-graph accuracy, and live Netlify interactions remain ongoing end-to-end verification considerations.
