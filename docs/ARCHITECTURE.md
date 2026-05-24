# fe-prep architecture

This document explains what fe-prep does, why each piece of the stack is here, how the pieces fit together, and what other approaches were considered and rejected. It is meant for engineers who will maintain or fork this codebase, not for end users.

If you are looking for "how do I run this locally" or "how do I contribute a question," see the [README](../README.md). This document is the layer underneath that.

For mermaid diagrams of the same flows described here in prose (build, deploy, propose, quiz), see [DIAGRAMS.md](DIAGRAMS.md).

---

## 1. Product

### What it is

A static catalogue of frontend interview Q&A flashcards, plus a built-in quiz runner. Anyone can read it for free with no account. Contributors can submit new questions via a GitHub-backed pull-request flow without ever leaving the site.

The codebase is the source of truth: questions live as markdown files in `content/<tag>/<slug>.md`, version-controlled like any other code. A maintainer reviews each PR; once merged, CI rebuilds the site and pushes to S3.

### Three modes of use

| Mode | URL | What the user does |
|---|---|---|
| **Browse** | `/` | Scroll the full catalogue, filter by tag, click into any question. |
| **Quiz** | `/quiz/`, `/quiz/run/?seed=…&tags=…&count=…` | Pick categories and a count, then flip through cards one at a time. Mark each "Got it" or "Review." Get a summary at the end and a sharable URL that reproduces the same quiz for someone else. |
| **Propose** | `/propose/` | Sign in with GitHub once, write a question + answer in markdown, submit. The browser opens a PR on the upstream repo. After review, a maintainer merges and CI deploys. |

### Why these constraints matter

- **Free, no account to read.** This is a study tool, not a product. Friction kills usage. No login, no email gate, no upsell.
- **No backend, no database.** Every dynamic capability is either built-time (content, search index) or pushed to the user's GitHub account (auth, PR submission). The only piece of always-on infrastructure is a 30-line Cloudflare Worker that proxies two CORS-blocked GitHub endpoints.
- **Smallest reasonable JS payload.** Question detail pages — by far the most-visited surface — ship **zero JavaScript**. Code highlighting is baked into HTML at build time. Interactive bits (filters, quiz, propose form) are loaded only on the pages that need them.
- **Open content.** Questions are markdown in a public repo. Contributors get attribution via git history. Anyone can fork.

### Content lifecycle

```
author writes on /propose/
        ↓
browser uses author's GitHub token → forks repo, opens PR
        ↓
GitHub Actions lints the PR (frontmatter shape + Q/A headings)
        ↓
maintainer reviews + merges
        ↓
push to main triggers deploy workflow → S3 sync → CloudFront invalidation
        ↓
question is live at /q/<slug>/ within ~2 minutes
```

There is no "draft," no preview environment, no separate CMS. The PR review *is* the editorial process.

---

## 2. Architecture at a glance

```
                        ┌─────────────────────────────────────┐
                        │             github.com               │
                        │                                       │
       content/*.md ──► │  repo  ────►  Actions: lint + deploy │
                        │   ▲                       │           │
                        │   │ PR                    │ OIDC      │
                        │  fork+commit              ▼           │
                        │   │             aws s3 sync           │
                        └───┼───────────────────────────────────┘
                            │                       │
            Octokit         │                       ▼
           ┌────────────────┘             ┌──────────────────┐
           │                              │   S3 (private)   │
           │                              └────────┬─────────┘
           │                                       │ OAC
           │                                       ▼
           │                              ┌──────────────────┐
           │                              │    CloudFront    │
           │                              └────────┬─────────┘
           │                                       │
           ▼                                       ▼
  ┌──────────────────┐                    ┌──────────────────┐
  │  CF Worker proxy │ ◄──── Device Flow ─│    browser       │
  │ (CORS shim only) │                    │  (Astro output)  │
  └──────────────────┘                    └──────────────────┘
                                                   │
                                          /quiz-index.json
                                          /_astro/*.js (islands)
                                          /q/<slug>/  (0 JS)
```

The only piece on the right side that runs server-side (in the browser-call sense) is the Cloudflare Worker, and even that one is stateless and exists purely to add CORS headers to GitHub's Device Flow endpoints.

---

## 3. Stack choices

For each major decision below: what was picked, what alternatives were considered, and why this one won.

### 3.1 Static site over SSR

**Pick:** Pre-rendered HTML on S3 + CloudFront.

**Why:**
- Cheapest possible hosting (cents/month at any reasonable traffic).
- Fastest possible response (CloudFront edges serve static HTML directly; no cold start, no DB round trip).
- Simplest possible failure mode: if anything is wrong, the worst case is a 24-hour-stale page until the next deploy.

**Alternatives considered:**

| Option | Why not |
|---|---|
| Next.js with SSR / ISR on Vercel | More moving parts, vendor lock-in, runtime costs scale with traffic. None of that buys us anything: content changes rarely, on a defined cadence (merge → deploy). |
| Node server (Express/Fastify) + DB | Would let us avoid the OAuth CORS proxy. Not worth running an always-on server, paying for a managed DB, and shipping passwords/sessions just for that. |
| GitHub Pages | Free, but its build pipeline is opinionated (Jekyll-leaning) and harder to wire to a custom Astro pipeline. CloudFront also gives us proper edge caching, custom headers, and OAC. |
| Netlify | Reasonable, but adds yet another platform to learn and pay for once we cross free-tier limits. S3 + CloudFront is the AWS-native equivalent and the price floor is lower. |

### 3.2 Astro over the alternatives

**Pick:** [Astro 5](https://astro.build) with Content Collections.

**Why:**
- **Zero-JS by default.** Astro components render to plain HTML; JavaScript only ships on pages that explicitly opt in via `client:*` directives ("islands"). The detail page (`/q/<slug>/`) ships no JS at all.
- **First-class markdown + content collections.** Frontmatter is validated with Zod at build time. Type safety extends into Astro pages.
- **Framework-agnostic islands.** We can mix React, Preact, Svelte, Solid, Vue inside the same Astro app. We chose Preact for size; if we ever want a Solid island somewhere, we can just add it.

**Alternatives considered:**

| Option | Pro | Con |
|---|---|---|
| **Next.js (App Router)** | Most popular, biggest ecosystem. | Default output ships React + the App Router runtime on every page (~80 KB JS minimum even for a "static" page). Defeats the "0 JS on detail pages" goal. |
| **Eleventy (11ty)** | True zero-JS markdown site generator. Very fast builds. | No islands story — interactive bits would need separate bundlers (Vite, Webpack) wired by hand. Astro gives that to us out of the box. |
| **Hugo** | Fastest builds (Go), excellent markdown support. | Template language is Go's `html/template`, less familiar than JSX/TSX for a frontend-prep tool whose audience writes React. Onboarding tax for contributors. |
| **SvelteKit / Nuxt** | Modern, fast, good DX. | Same "ship runtime on every page" issue as Next. SvelteKit's `prerender` mode is closer, but Astro's island model is still cleaner for mixing static and dynamic. |
| **Plain Vite + a markdown plugin** | Total control. | We'd reinvent content collections, frontmatter validation, route generation, and asset hashing. Wasted effort. |

### 3.3 Preact over React for islands

**Pick:** [Preact](https://preactjs.com/) via `@astrojs/preact`.

**Why:**
- **~3 KB gzipped vs React's ~40 KB.** For a site whose value proposition includes "small bundle," that 13× difference matters.
- API-compatible with React: hooks, JSX, refs, context all work identically. The code looks like React; readers don't need to learn anything new.
- All the libraries we use (CodeMirror, Octokit) are vanilla JS — they don't care which renderer is on the other side.

**Alternatives considered:**

| Option | Pro | Con |
|---|---|---|
| **React** | Most familiar. Tooling and library coverage. | ~40 KB shipped on every island-bearing page. We get no benefit from this on the bytes we'd be paying for. |
| **Svelte** | Even smaller compiled output than Preact for typical components. | Different mental model than React. Would force contributors who write React to context-switch. Library ecosystem narrower. |
| **Solid** | Best-in-class performance, fine-grained reactivity. | Same context-switch cost as Svelte. Smaller library ecosystem. Overkill for the level of interactivity we have. |
| **Vanilla DOM / no framework** | Even smaller still. | Three islands (filter list, quiz runner, propose form) are non-trivial: state machines, async I/O, form validation. Hand-rolling vanilla DOM for these is more code and more bugs than a 3 KB framework saves. |

### 3.4 Shiki at build time over runtime syntax highlighting

**Pick:** [Shiki](https://shiki.style) via Astro's built-in markdown pipeline.

**Why:**
- Shiki uses the exact same TextMate grammars and themes as VS Code. The output looks like a real editor, not "syntax highlighter aesthetic."
- It runs at build time and emits plain HTML with inline color styles. The browser does nothing — no parsing, no tokenizing, no theme switching JS.
- Result: code blocks on `/q/<slug>/` look great and cost zero kilobytes of runtime JS.

**Alternatives considered:**

| Option | Why not |
|---|---|
| **Prism.js client-side** | Ships JS + grammars to every page that has a code block. Adds ~30 KB. Defeats zero-JS. |
| **highlight.js client-side** | Same problem as Prism. |
| **No highlighting** | Code blocks are everywhere in frontend interview answers. Reading unhighlighted code is painful enough that this would meaningfully degrade the product. |
| **Shiki at runtime** | Yes you can do this; no, you should not. ~600 KB of grammars + WASM. Worst of all worlds. |

### 3.5 Marked v18 for the quiz JSON

**Pick:** [Marked v18](https://marked.js.org/) + a custom Shiki renderer hook in `src/lib/renderMarkdown.ts`.

**Why:**
- The quiz runner is a single client-side island. It fetches one file (`/quiz-index.json`) containing all questions pre-rendered to HTML. That render needs to happen *outside* of Astro's normal markdown pipeline, since we need to split each markdown body into a question half and an answer half before rendering.
- Marked is small, has zero dependencies, and exposes a renderer hook we use to swap in Shiki for code blocks. This gives us identical visual output to the Astro-rendered pages.

**Alternatives considered:**

| Option | Why not |
|---|---|
| **remark / unified** | More powerful (AST transforms), bigger surface area, slower to use for a five-line "split markdown then render two halves" task. |
| **Reusing Astro's content rendering** | Astro's `render(entry)` returns a *component*, not an HTML string. Hard to call from inside an API endpoint and then post-process. |
| **markdown-it** | Functionally equivalent. Slightly larger. We had no specific reason to pick it over Marked. |

### 3.6 CodeMirror 6 for the propose editor

**Pick:** [CodeMirror 6](https://codemirror.net) with `@codemirror/lang-markdown`.

**Why:**
- Modern, modular (you only ship the features you import), and well-maintained.
- Loaded only on `/propose/` via `client:only`. People reading questions never pay this cost.

**Alternatives considered:**

| Option | Why not |
|---|---|
| **Monaco** | The real VS Code editor in a div. Powerful, but ~2 MB minified. Way too heavy for our use case. |
| **Plain `<textarea>`** | Workable, but no syntax highlighting in the editor, no line numbers, no markdown affordances. Worse author experience for the people who matter most (contributors). |
| **TipTap / ProseMirror with markdown** | Rich-text editors. Mismatch: we want to *write* markdown, not be one layer above it. Round-tripping rich text to markdown to PR introduces fidelity bugs. |

### 3.7 Octokit for browser-side PR creation

**Pick:** [Octokit.js](https://github.com/octokit/octokit.js) in the browser, called from the Propose island.

**Why:**
- Official, well-typed, covers every endpoint we need (`createFork`, `getRef`, `createRef`, `createOrUpdateFileContents`, `pulls.create`).
- Saves us writing five `fetch` calls with the right headers, query encoding, and error handling.

**Alternatives considered:**

| Option | Why not |
|---|---|
| **Raw `fetch`** | We'd reimplement everything Octokit does. Each call is non-trivial (base64, branch references, fork-or-reuse). |
| **Server-side PR creation** | Would require a backend to hold a bot token. Adds infrastructure and a credential to manage. Browser-side with a per-user token is simpler and gives proper attribution (the PR shows up as authored by the actual contributor). |

### 3.8 GitHub OAuth Device Flow over OAuth Web Flow

**Pick:** Device Flow, with a Cloudflare Worker CORS proxy in front of `github.com/login/...`.

**Why:**
- Device Flow does not require a backend. It works like this: the browser asks GitHub for a user code, displays it ("enter B3B8-22E3 at github.com/login/device"), and polls for the resulting access token. The token never leaves the user's browser.
- Web Flow (the redirect-based one) requires a confidential client_secret on a server to exchange the auth code for a token. That means a backend, which we don't want.

**The CORS problem and the worker:**
- GitHub's `/login/device/code` and `/login/oauth/access_token` endpoints **do not send CORS headers** as of writing. A browser cannot call them directly.
- We deploy a single Cloudflare Worker (free tier) at `workers/oauth-proxy/` that re-issues those two requests with `Access-Control-Allow-Origin: *`. It does nothing else. No state, no auth, no logging.
- The worker is the *only* piece of always-on infrastructure beyond the static bucket.

**Alternatives considered:**

| Option | Why not |
|---|---|
| **OAuth Web Flow** | Requires a backend to hold the client secret. Avoidable. |
| **GitHub App with installation tokens** | Would let us avoid per-user auth, but then PRs come from a bot account — terrible attribution for contributors. |
| **No proxy; user pastes a personal access token** | Possible but awful UX. Half the people you ask to do this give up. |
| **AWS Lambda or API Gateway as the proxy** | Functionally equivalent. Cloudflare Workers has a generous free tier, simpler config, faster cold start. |

### 3.9 mulberry32 PRNG + Fisher-Yates shuffle

**Pick:** Tiny deterministic PRNG (`mulberry32`) seeded by a string + hashed (`hashSeed` FNV-1a). Shuffle via Fisher-Yates.

**Why:**
- The product feature is "share this URL to give someone the same quiz." That requires the shuffle to be deterministic given the seed.
- `Math.random()` is not seedable and not deterministic across runs. Useless here.
- Modern JS does not ship a stdlib seedable PRNG. The third-party options are all heavier than the ~12 lines of code we wrote.

**Alternatives considered:**

| Option | Why not |
|---|---|
| **Math.random()** | Not deterministic. Breaks share URLs. |
| **`seedrandom` library** | Larger than our 12 lines for no real benefit. |
| **crypto.getRandomValues()** | Not seedable. Same problem as Math.random. |
| **Server-rendered quiz with a stored seed** | Requires a backend. |

### 3.10 Zod via Astro Content Collections

**Pick:** Astro's content collection schema, defined in `src/content/config.ts` with Zod.

**Why:**
- The build *fails* if a markdown frontmatter doesn't match the schema. You cannot ship a malformed question.
- TypeScript types for the schema are inferred and flow into every consumer (`entry.data.title`, etc.).
- We use it to enforce: title length, tag shape (`/^[a-z0-9-]+$/`, max 30 chars), difficulty enum, and required fields.

We also run a CLI lint script (`scripts/lint-content.ts`) on PRs touching `content/`, which catches the same issues plus a few that aren't expressible in Zod (e.g., the markdown body has both `# Question` and `# Answer` H1 headings). Belt-and-suspenders: Zod blocks bad data from reaching the build, the CLI surfaces it earlier in the PR review.

### 3.11 GitHub Actions OIDC into AWS (no static keys)

**Pick:** A GitHub OIDC trust on an AWS IAM role. The role is assumed by the deploy workflow; no static AWS access keys live in GitHub secrets.

**Why:**
- A leaked `AWS_ACCESS_KEY_ID` is a long-lived credential. A leaked OIDC-issued STS token expires in an hour and is bound to a specific workflow run.
- Less to rotate, less to lose.

**Alternatives considered:**

| Option | Why not |
|---|---|
| **Static IAM access keys in GitHub Secrets** | Works, but they're permanent until you remember to rotate them. OIDC removes that whole class of mistake. |
| **AWS Account in OIDC-aware GitHub orgs only** | Same thing, restricted by org-level config. We don't have that infrastructure. |

### 3.12 S3 (private) + CloudFront + OAC

**Pick:** Private S3 bucket fronted by CloudFront with Origin Access Control (OAC) and a CloudFront Function for trailing-slash rewriting.

**Why:**
- **Bucket stays private.** OAC means CloudFront signs requests to S3; S3's bucket policy only allows that specific CloudFront distribution. There is no S3-public-website endpoint exposed.
- **CloudFront does HTTPS, edge caching, and HTTP/2.** S3's website hosting endpoint is HTTP-only without CloudFront in front.
- **Edge function rewrites `/foo/` → `/foo/index.html`.** CloudFront defaults serve `index.html` only for the root request; subpath requests like `/quiz/run/` would 403 without this. The function is ~10 lines of JS, free for the first 2M invocations/month.
- **Two cache-control policies during deploy:**
  - `*.html` and `*.json` → `Cache-Control: no-cache`. Re-validated on every request so content updates appear instantly after a CloudFront invalidation.
  - Everything else (hashed assets like `Propose.C-dUA4V9.js`) → `Cache-Control: public, max-age=31536000, immutable`. These filenames change when content changes, so they can be cached forever.

**Alternatives considered:**

| Option | Why not |
|---|---|
| **S3 static website hosting only** | HTTP only. Public bucket. No edge caching. Bad. |
| **Vercel / Netlify / Cloudflare Pages** | Fine alternatives. We chose S3 + CloudFront for direct AWS integration with OIDC and because it's the price floor. If we ever moved, Cloudflare Pages is the easiest landing pad. |
| **Single cache policy everywhere** | If we treated HTML as immutable, content updates would take 24h to propagate. If we treated assets as no-cache, every visit re-downloads them. The split policy is the right one. |

### 3.13 Cloudflare Worker as the only "backend"

**Pick:** A 30-line Worker in `workers/oauth-proxy/`, deployed to Cloudflare's free tier.

**Why:**
- This is the *only* runtime infrastructure beyond the static bucket. It exists to add CORS headers to two GitHub endpoints. Nothing else.
- Cloudflare's free tier covers 100K requests/day. We will never approach that for OAuth handshakes.
- Free TLS, instant global deploy, ~10 ms cold start.

**Alternatives considered:**

| Option | Why not |
|---|---|
| **AWS Lambda + Function URL** | Works, requires more boilerplate (IAM, function URL config). |
| **Self-host a tiny server (e.g., Fly.io)** | Adds an always-on container; unnecessary for a stateless 30-line proxy. |
| **Drop /propose/ entirely** | Loses the whole contribution flow. The product hinges on this. |

---

## 4. How the pieces interact

### 4.1 Build pipeline

```
content/<tag>/<slug>.md  ──┐
                            │
src/content/config.ts ──────┼──► Astro Content Collection
                            │            │
                            │            ├──► src/pages/q/[...slug].astro
                            │            │      └─► /q/<slug>/index.html (static, 0 JS)
                            │            │             ├─ split Q/A in frontmatter
                            │            │             ├─ render both halves via Marked + Shiki
                            │            │             └─ answer wrapped in <details>
                            │            │
                            │            ├──► src/pages/index.astro
                            │            │      └─► /index.html + QuestionBrowser island
                            │            │
                            │            ├──► src/pages/quiz/index.astro
                            │            │      └─► /quiz/index.html + QuizSetup island
                            │            │
                            │            └──► src/pages/quiz-index.json.ts
                            │                   └─► /quiz-index.json
                            │                          (every question pre-rendered,
                            │                           question half + answer half
                            │                           as ready-to-inject HTML)
                            │
src/components/Propose.tsx ─┴──► /propose/index.html + Propose island (CodeMirror, Octokit)
```

Three of these outputs deserve special note:

- **`/q/<slug>/index.html` ships zero JS.** Everything is inline. Shiki painted the code blocks at build time. The "Show answer" toggle is a native `<details>` element — the browser does it, no script needed.
- **`/quiz-index.json`** is generated by `src/pages/quiz-index.json.ts`, an Astro endpoint. It iterates every entry in the collection, runs `loadAllQuizQuestions()` (which splits each body into Q and A halves and renders both through `renderMarkdown`), and writes the result. The quiz runner fetches this file once at runtime. Everything else about the quiz happens in the browser.
- **`/propose/index.html`** is a thin shell. The actual editor + form is the `<Propose client:only>` island; the heavy bits (CodeMirror, Octokit) are inside that bundle, which is the only place a /propose visitor pays the bandwidth for them.

### 4.2 Submission flow (Propose → live)

```
1. user opens /propose/
2. user clicks "Sign in with GitHub"
   → Propose calls Worker proxy → github.com/login/device/code
   → worker returns user_code + verification_uri (e.g. B3B8-22E3, github.com/login/device)
3. user opens that URL in a new tab, enters the code, authorizes
4. Propose polls Worker proxy → github.com/login/oauth/access_token
   → eventually returns access_token (scope: public_repo)
   → token stored in localStorage (key: fe-prep:gh-token)
5. user fills in title, tags (suggested chips OR free-text custom), difficulty, markdown body
6. user clicks Submit
   → Octokit (in the browser, with user's token):
       a. POST /user/repos/<owner>/<repo>/forks  (no-op if already forked)
       b. Poll until fork exists
       c. GET refs/heads/main on the fork
       d. POST refs/heads/proposal/<slug>-<timestamp>
       e. PUT contents/<filepath> with the new file
       f. POST pulls (head: <user>:<branch>, base: upstream:main)
   → Propose shows "Thanks — PR opened" with a link
7. GitHub fires the lint-content workflow on the new PR
   → runs scripts/lint-content.ts
   → fails the check if frontmatter is malformed or Q/A headings missing
8. maintainer reviews + merges
9. push to main fires deploy workflow
   → builds Astro
   → aws s3 sync (two-pass: long-lived assets, then no-cache HTML/JSON)
   → CloudFront invalidation /*
10. CloudFront edges drop their cache, next request fetches new files
    → question is live at /q/<slug>/
```

The only non-static piece in this entire flow is the Cloudflare Worker in step 2 and step 4.

### 4.3 Quiz flow

```
1. user opens /quiz/
   → QuizSetup island renders, listing tags + counts derived from the content collection
2. user picks tags + count, clicks Start
   → QuizSetup builds URL: /quiz/run/?seed=<random>&tags=<csv>&count=<n>
   → window.location.href = that URL
3. user lands on /quiz/run/
   → static HTML shell (no props baked in)
   → QuizRunner island loads, reads window.location.search on mount
   → derives { seed, tags, count }
   → fetches /quiz-index.json
   → filters by tags, hashes seedKey, runs seededShuffle, slices to count
   → presents one card at a time
4. user flips between question/answer side via Space, ←/→, or buttons
   → on the answer side: Got it / Review buttons mark and advance
5. at end: done screen with X right · Y review · Z skipped
   → "Retry missed" rebuilds the set to only the review-marked cards
   → share box copies the URL
```

The share URL is fully deterministic because (a) the seed is in the URL, (b) `hashSeed("seed|tag,tag,tag")` is a pure function, and (c) the shuffle is deterministic given the hashed seed. Open the same URL on someone else's machine: same cards, same order.

---

## 5. Things deliberately *not* in scope

These came up during design and were explicitly cut for v1:

- **Per-question timer.** Easy to add later as a layer on top of QuizRunner. Adds clutter without obvious value for the "study at your own pace" use case.
- **Spaced repetition / streak tracking.** Would require persistent per-user state. No accounts, no DB — would need localStorage state model and migration story. Defer.
- **User accounts / progress sync across devices.** Same reason.
- **Comments / discussion on questions.** Issues on the GitHub repo already cover this for free. No need to reinvent.
- **Analytics.** No tracking pixels, no GA. If usage data ever becomes needed, CloudFront logs are sufficient.
- **i18n.** All content is English. Could be added later via either separate content collections per locale or a translation field in frontmatter. Not now.

---

## 6. Where to look in the code

| Concern | File(s) |
|---|---|
| Content schema (Zod) | `src/content/config.ts` |
| Tag/difficulty constants | `src/lib/constants.ts` |
| Question detail page | `src/pages/q/[...slug].astro` |
| Homepage list + filter | `src/pages/index.astro` + `src/components/QuestionBrowser.tsx` |
| Quiz setup form | `src/pages/quiz/index.astro` + `src/components/QuizSetup.tsx` |
| Quiz runner | `src/pages/quiz/run.astro` + `src/components/QuizRunner.tsx` |
| Quiz JSON endpoint | `src/pages/quiz-index.json.ts` + `src/lib/loadQuestions.ts` |
| Markdown → HTML for the JSON | `src/lib/renderMarkdown.ts` |
| Q/A splitter | `src/lib/splitQA.ts` (uses `<h1>Answer</h1>` boundary) |
| Seeded shuffle | `src/lib/seededShuffle.ts` |
| Propose editor / form | `src/components/Propose.tsx` |
| GitHub Device Flow client | `src/lib/githubOAuth.ts` |
| Octokit PR helpers | `src/lib/octokit.ts` |
| Content lint (CI) | `scripts/lint-content.ts` + `.github/workflows/lint-content.yml` |
| Deploy (CI) | `.github/workflows/deploy.yml` |
| OAuth CORS proxy | `workers/oauth-proxy/src/index.js` |
| Global styles | `src/styles/global.css` |
