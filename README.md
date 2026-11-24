# Repo Router

**Explore, visualize, compare, and evaluate public GitHub repositories — from one workspace.**

[Open Repo Router](https://reporouter.netlify.app/) · [Browse all guides](https://reporouter.netlify.app/guides/) · [How to use it](https://reporouter.netlify.app/guides/how-to-use-repo-router/) · [Site map](https://reporouter.netlify.app/sitemap/)

Repo Router combines a public GitHub repository explorer with focused context generation, repository intelligence, and convenient links to specialist tools such as GitMCP, DeepWiki, GitIngest, GitDiagram, and UIthub. The site is built with HTML, CSS, JavaScript, and read-only Netlify functions.

> **Release status:** Phase 1 and Phase 2 repository exploration features were merged into `main` in November 2026 (PRs [#4](https://github.com/rahul300rkv/Reporouter/pull/4) and [#5](https://github.com/rahul300rkv/Reporouter/pull/5)). The live site’s availability can depend on deployment and provider status. See the [editorial policy](https://reporouter.netlify.app/editorial-policy/) and [About](https://reporouter.netlify.app/about/) pages for sourcing and limitations.

## Start here

| Page | What you'll find |
| --- | --- |
| [Repo Router — main tool](https://reporouter.netlify.app/) | Paste a GitHub URL and open the integrated Explorer or specialist destinations. |
| [Repository Explorer](https://reporouter.netlify.app/#tool) | Browse repository metadata, file paths, safe text previews, and a bounded code digest. |
| [Repository Intelligence](https://reporouter.netlify.app/#tool) | Inspect language, stars, issues, license, project structure, and observed manifest signals. |
| [AI Context Builder](https://reporouter.netlify.app/#tool) | Select files by goal, apply an approximate token budget, then copy/download the context. |
| [GitHub URL Tricks](https://reporouter.netlify.app/#tool) | Open the same public repository in official GitHub tools and supported external services. |
| [DeepWiki documentation](https://reporouter.netlify.app/#tool) | Fetch wiki structure, wiki content, or answers when the upstream service is available. |
| [GitMCP search](https://reporouter.netlify.app/#tool) | Search third-party documentation or code search results. |
| [GitDiagram architecture](https://reporouter.netlify.app/#tool) | View an existing diagram and export Mermaid, SVG, or PNG. |
| [Complete usage guide](https://reporouter.netlify.app/guides/how-to-use-repo-router/) | Walkthrough, tool selection, and troubleshooting. |

**Navigation note:** These tools are **tabs within the main repository Explorer**, not separate published pages. Open the main tool, enter a public GitHub `owner/repo` URL, and choose the relevant tab. The links above intentionally lead to the shared tool section rather than pretending each tab has a standalone route.

### Phase 2 — merged into main

| Feature | Purpose | Source |
| --- | --- | --- |
| Repository Health | Report observable README, license, CI, test, dependency, and maintenance signals without inventing a quality score. | [repository-health.js](repository-health.js) |
| Architecture Evidence | Surface potential import relationships between sampled files and link back to GitHub source. | [architecture-evidence.js](architecture-evidence.js) |
| Compare & Changes | Compare public repository metadata or inspect differences between Git branches/tags. | [repository-compare.js](repository-compare.js) |
| My Workspace | Save public repository bookmarks and private notes in local browser storage; import/export JSON. | [repository-workspace.js](repository-workspace.js) |

These views are integrated into the Explorer on `main`. See [the two-phase roadmap](PHASES.md) for exact scope, limitations, and acceptance criteria.

## Guides and tutorials

### GitHub repository exploration

Start with the [GitHub Repository Structure guide](https://reporouter.netlify.app/guides/github-repository-structure/) or [browse all guides](https://reporouter.netlify.app/guides/). The site prioritizes file exploration, architecture evidence, repository comparison and maintenance signals; legacy AI-tool tutorials remain available separately.

### Repository tools

| Guide | Topics covered |
| --- | --- |
| [GitHub Repository Structure](https://reporouter.netlify.app/guides/github-repository-structure/) | View the file tree, understand common folders, and explore public repositories without cloning. |
| [What is MCP?](https://reporouter.netlify.app/guides/what-is-mcp/) | Model Context Protocol, clients, servers, tools, and resources. |
| [GitMCP Guide](https://reporouter.netlify.app/guides/gitmcp-guide/) | Connect public GitHub repositories to compatible MCP clients. |
| [DeepWiki Tutorial](https://reporouter.netlify.app/guides/deepwiki-tutorial/) | Explore AI-generated repository documentation and verify findings. |
| [GitIngest Guide](https://reporouter.netlify.app/guides/gitingest-guide/) | Create LLM-readable repository digests. |
| [UIthub Guide](https://reporouter.netlify.app/guides/uithub-guide/) | Filter repository content into context-friendly text. |
| [GitMCP vs DeepWiki vs GitIngest](https://reporouter.netlify.app/guides/gitmcp-vs-deepwiki-vs-gitingest/) | Choose the appropriate repository tool. |
| [Repository Documentation](https://reporouter.netlify.app/guides/github-repo-documentation/) | README files, architecture notes, `llms.txt`, and `AGENTS.md`. |

### AI-assisted coding workflows

| Guide | Topics covered |
| --- | --- |
| [Cursor MCP Setup](https://reporouter.netlify.app/guides/cursor-mcp-setup/) | Configure a remote MCP server in Cursor. |
| [Claude Desktop MCP Setup](https://reporouter.netlify.app/guides/claude-desktop-mcp-setup/) | Add and verify an MCP server in Claude Desktop. |
| [AI Coding Workflow](https://reporouter.netlify.app/guides/ai-coding-workflow/) | Practical steps for AI-assisted coding with review and testing. |
| [Best AI Developer Tools](https://reporouter.netlify.app/guides/best-ai-developer-tools/) | Compare editors, assistants, and repository utilities. |
| [MCP Security and Privacy](https://reporouter.netlify.app/guides/mcp-security-privacy/) | Safety considerations before linking services or sharing code. |
| [How to Use Repo Router](https://reporouter.netlify.app/guides/how-to-use-repo-router/) | Product walkthrough and troubleshooting. |
| [llms.txt Guide](https://reporouter.netlify.app/guides/llms-txt-guide/) | Curate a Markdown entry point for AI-readable site content. |

[View the complete Guides directory](https://reporouter.netlify.app/guides/) · [Editorial policy](https://reporouter.netlify.app/editorial-policy/) · [About the project](https://reporouter.netlify.app/about/)

## How it works

1. Open [Repo Router](https://reporouter.netlify.app/).
2. Paste a public GitHub repository URL, for example `https://github.com/facebook/react`.
3. Open the repository workspace to browse files, inspect metadata, build context, or use an integrated service.
4. Choose an output: copy a focused digest, download repository context, view documentation/architecture, or open a specialist tool.

Repo Router does **not** clone private repositories, execute untrusted repository code, or guarantee that every third-party provider is available. GitHub API rate limits and large/partial repository trees can affect results.

## Run locally

The application is a static website with optional Netlify functions.

```bash
git clone https://github.com/rahul300rkv/Reporouter.git
cd Reporouter
npm run dev
```

The `dev` script runs `npx serve .`. For static pages and client-side public GitHub features, a local static server is sufficient. Netlify function routes (such as the DeepWiki/GitMCP relays) require an appropriate Netlify development or deployment environment and may not work under `serve` alone.

### Key source files

- [index.html](index.html) — homepage and embedded repository workspace tabs
- [explorer.js](explorer.js) — public GitHub metadata, tree, file preview, and digest
- [repository-intelligence.js](repository-intelligence.js) — Phase 1 intelligence, AI context builder, and URL shortcuts
- [deepwiki.js](deepwiki.js) and [DeepWiki Netlify relay](netlify/functions/deepwiki.cjs) — wiki integration
- [gitmcp.js](gitmcp.js) and [GitMCP Netlify relay](netlify/functions/gitmcp.cjs) — documentation/code search
- [gitdiagram.js](gitdiagram.js) and [gitdiagram-advanced.js](gitdiagram-advanced.js) — diagram viewer and exports
- [repository-health.js](repository-health.js), [architecture-evidence.js](architecture-evidence.js), [repository-compare.js](repository-compare.js), [repository-workspace.js](repository-workspace.js) — Phase 2 branch modules
- [PHASES.md](PHASES.md) — roadmap and implementation boundaries
- [sitemap.xml](sitemap.xml) — published page inventory

## Privacy and limitations

- Repository exploration targets **public GitHub data**. Browsing files and preparing focused context happen in the browser using GitHub's APIs.
- DeepWiki, GitMCP, and GitDiagram integrations depend on third-party availability. Some requests pass through Repo Router's Netlify functions; consult the [Privacy Policy](https://reporouter.netlify.app/privacy-policy/).
- Phase 2 workspace notes remain in browser `localStorage` unless **you explicitly export them**. They do not sync between browsers or devices.
- Architecture relationships detected from source are heuristic observations, **not verified runtime dependency graphs**.
- Health checks are descriptive signals, **not security audits or vulnerability scanning**.
- Review any code or context before sending it to an AI service.

## Site pages and policies

| Page | Link |
| --- | --- |
| About | [About Repo Router](https://reporouter.netlify.app/about/) |
| Contact | [Contact](https://reporouter.netlify.app/contact/) |
| Privacy Policy | [Privacy Policy](https://reporouter.netlify.app/privacy-policy/) |
| Terms of Use | [Terms](https://reporouter.netlify.app/terms/) |
| Disclaimer | [Disclaimer](https://reporouter.netlify.app/disclaimer/) |
| HTML Sitemap | [Site map](https://reporouter.netlify.app/sitemap/) |
| XML Sitemap | [sitemap.xml](https://reporouter.netlify.app/sitemap.xml) |
| Editorial standards | [Editorial Policy](https://reporouter.netlify.app/editorial-policy/) |

---

**Repo Router** — One GitHub URL, multiple ways to understand a codebase.

[Open the website](https://reporouter.netlify.app/) · [Explore the guides](https://reporouter.netlify.app/guides/) · [See Phase 2 PR #5](https://github.com/rahul300rkv/Reporouter/pull/5)
