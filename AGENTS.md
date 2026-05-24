# Agent guide — fe-prep

This file is the entry point for any AI coding assistant (Claude Code, Cursor,
Copilot, Codex, Aider, etc.) working in this repo. Read it before making
changes.

For deeper context on *why* the stack looks the way it does, see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). For visual flow diagrams (build,
deploy, propose, quiz), see [docs/DIAGRAMS.md](docs/DIAGRAMS.md). For
beginner-oriented explanations of the underlying concepts (CORS, OAuth Device
Flow, OIDC, CloudFront, etc.), see [docs/CONCEPTS.md](docs/CONCEPTS.md). For
human-facing how-to, see [README.md](README.md).

## What this is

A static site of categorized frontend interview Q&A. Questions live as
markdown under `content/<tag>/<slug>.md`, version-controlled. Built with Astro,
deployed to S3 + CloudFront. The only runtime "backend" is a Cloudflare Worker
that proxies two CORS-blocked GitHub OAuth endpoints.

## Stack

- **Astro 5** with Content Collections (Zod-validated frontmatter)
- **Preact** for interactive islands (not React — chosen for size)
- **TypeScript** throughout
- **Shiki** for build-time code highlighting (no runtime highlighter)
- **Marked** + custom Shiki renderer for the quiz JSON pipeline
- **CodeMirror 6** for the `/propose` markdown editor
- **Octokit** for browser-side PR creation
- **Cloudflare Worker** (`workers/oauth-proxy/`) — only always-on infra

## Repo layout

```
content/<tag>/<slug>.md      question files (the product)
src/pages/                   Astro routes
src/components/              Preact islands (Propose, QuizRunner, QuizSetup,
                             QuestionBrowser)
src/lib/                     constants, OAuth, Octokit helpers, markdown
                             renderer, seeded shuffle, Q/A splitter
src/content/config.ts        Zod schema for question frontmatter
src/styles/global.css        global styles
scripts/lint-content.ts      CI content linter
workers/oauth-proxy/         Cloudflare Worker (CORS proxy for GitHub OAuth)
docs/ARCHITECTURE.md         deep dive: rationale + alternatives considered
.github/workflows/           deploy.yml, lint-content.yml
```

Detailed file pointers in `docs/ARCHITECTURE.md` §6.

## Common commands

```sh
npm install
npm run dev              # local dev server
npm run build            # production build into dist/
npm run preview          # serve the built site
npm run lint:content     # validate every content/**.md (same as CI)
```

Before claiming a task done, run `npm run build` and `npm run lint:content`.
There is no test suite yet.

## Adding a question

1. Create `content/<primary-tag>/<slug>.md`.
2. Frontmatter:
   ```yaml
   ---
   title: "Short, scannable question"
   tags: [react, performance]        # lowercase, hyphens; min 1, max 30 chars each
   difficulty: easy | medium | hard
   author: "github-handle"           # optional
   ---
   ```
3. Body must contain `# Question` and `# Answer` H1 headings. The splitter in
   `src/lib/splitQA.ts` keys on `<h1>Answer</h1>` exactly.
4. Run `npm run lint:content`.

Allowed tags and difficulty values are defined in `src/lib/constants.ts`.

## Conventions

- **Zero-JS on `/q/<slug>/`** is a hard rule. Don't introduce client-side JS
  on the question detail page. The "Show answer" toggle is a native
  `<details>`, not a script.
- **Islands ship only on pages that need them.** Use `client:only` /
  `client:load` deliberately. Prefer doing work at build time.
- **Preact, not React.** Imports come from `preact` / `preact/hooks`. The API
  is React-compatible; do not pull in `react` or `react-dom`.
- **No backend.** Anything dynamic must be either build-time, browser-side
  with the user's GitHub token, or a request to the existing Worker. Do not
  introduce a server or database without an explicit ask.
- **Cache-control split at deploy** (`.github/workflows/deploy.yml`): hashed
  assets are immutable, `*.html` and `*.json` are `no-cache`. Preserve this if
  editing the workflow.

## Code style

- TypeScript strict — keep it that way.
- Path alias `@/*` maps to `src/*` (see `tsconfig.json`).
- No comments unless they explain a non-obvious *why*. Identifier names carry
  the *what*.
- Match existing formatting; there is no Prettier/ESLint config yet, so follow
  what's in adjacent files.

## What NOT to do

- Do not add tracking, analytics, or telemetry.
- Do not add an auth backend, session storage, or a user database.
- Do not migrate Preact → React, or Astro → Next, without explicit ask.
- Do not commit `.env` or anything that looks like a secret. Public env vars
  prefixed `PUBLIC_*` are fine (they're meant to ship to the browser).
- Do not push directly to `main` or bypass the lint workflow.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`: build → OIDC-assume
AWS role → `aws s3 sync` (two-pass for cache headers) → CloudFront
invalidation. No manual steps. The Worker in `workers/oauth-proxy/` is
deployed separately via `wrangler` (see its directory).
