# Process diagrams

Visual companions to [ARCHITECTURE.md](ARCHITECTURE.md). GitHub renders mermaid
inline, so these display when this file is viewed on github.com.

Conventions used below: `[slug]`, `[tag]`, `[owner]`, `[repo]` are placeholders.
`/q/[slug]/` means a literal path with `[slug]` substituted.

---

## 1. Content lifecycle (author → live)

End-to-end: from someone writing a question on `/propose` to it being readable
at `/q/[slug]/`. The only piece of always-on infrastructure in this path is the
Cloudflare Worker that proxies GitHub's OAuth endpoints.

```mermaid
flowchart TD
    A[Author opens /propose] --> B[OAuth Device Flow<br/>via CF Worker proxy]
    B --> C[Octokit fork + branch + commit + PR<br/>all from the browser]
    C --> D{lint-content.yml passes?}
    D -->|fail| E[Author fixes frontmatter or Q/A headings]
    E --> D
    D -->|pass| F[Maintainer review]
    F -->|request changes| E
    F -->|approve + merge to main| G[deploy.yml fires]
    G --> H[Astro build → S3 sync → CloudFront invalidation]
    H --> I[Question live at /q/slug/]
```

---

## 2. Build pipeline

What `npm run build` (and the deploy workflow) produces from the source tree.
Frontmatter is Zod-validated at build time; a bad question fails the build
before anything ships.

```mermaid
flowchart LR
    A["content/[tag]/[slug].md"]:::input
    B["src/content/config.ts<br/>(Zod schema)"]:::input
    C["src/pages/*.astro"]:::input
    D["src/components/*.tsx<br/>(Preact islands)"]:::input

    A --> V{Frontmatter valid?}
    B --> V
    V -->|no| X["Build fails"]:::fail
    V -->|yes| AST["Astro build"]
    C --> AST
    D --> AST

    AST --> O1["/q/[slug]/index.html<br/>0 JS, Shiki at build time"]:::out
    AST --> O2["/index.html<br/>+ QuestionBrowser island"]:::out
    AST --> O3["/quiz/index.html<br/>+ QuizSetup island"]:::out
    AST --> O4["/quiz/run/index.html<br/>+ QuizRunner island"]:::out
    AST --> O5["/quiz-index.json<br/>every Q pre-rendered (Marked + Shiki)"]:::out
    AST --> O6["/propose/index.html<br/>+ Propose island (CodeMirror + Octokit)"]:::out

    classDef input fill:#eef,stroke:#557
    classDef out fill:#efe,stroke:#575
    classDef fail fill:#fee,stroke:#a44
```

---

## 3. Deploy workflow (`.github/workflows/deploy.yml`)

Triggered on push to `main`. Uses OIDC to assume an AWS role (no static keys in
GitHub Secrets) and runs `aws s3 sync` twice — once for hashed assets with a
1-year immutable cache, once for HTML/JSON with `no-cache` so content updates
appear instantly after CloudFront invalidation.

```mermaid
flowchart TD
    A[Push to main] --> B[Checkout + setup-node 22]
    B --> C[npm ci]
    C --> D[npm run build → dist/]
    D --> E[Assume AWS role via OIDC<br/>AWS_ROLE_ARN]
    E --> F["aws s3 sync dist/ s3://BUCKET/<br/>--exclude *.html *.json<br/>--cache-control immutable, 1y"]
    F --> G["aws s3 sync dist/ s3://BUCKET/<br/>--include *.html *.json<br/>--cache-control no-cache"]
    G --> H{CLOUDFRONT_DISTRIBUTION_ID set?}
    H -->|yes| I["CloudFront create-invalidation /*"]
    H -->|no| J[Done]
    I --> J
```

---

## 4. Question proposal — OAuth Device Flow + PR creation

The Cloudflare Worker exists only because GitHub's two OAuth endpoints don't
send CORS headers. Once a token is in `localStorage`, all subsequent GitHub
calls go directly from the browser via Octokit (the GitHub API endpoints *do*
send CORS headers; only the `login/...` endpoints don't).

```mermaid
sequenceDiagram
    actor User
    participant P as /propose (browser)
    participant W as CF Worker proxy
    participant GH as github.com

    Note over User,GH: OAuth Device Flow

    User->>P: Click "Sign in with GitHub"
    P->>W: POST /login/device/code
    W->>GH: POST /login/device/code
    GH-->>W: user_code, verification_uri, device_code
    W-->>P: same payload + CORS headers
    P-->>User: "Enter B3B8-22E3 at github.com/login/device"

    User->>GH: Visit URL, enter code, authorize

    loop Poll until authorized
        P->>W: POST /login/oauth/access_token
        W->>GH: POST /login/oauth/access_token
        alt user not done yet
            GH-->>W: error authorization_pending
            W-->>P: same
        else success
            GH-->>W: access_token
            W-->>P: same
        end
    end

    P->>P: localStorage.setItem('fe-prep:gh-token', token)

    Note over User,GH: PR creation via Octokit (direct, no proxy)

    User->>P: Fill form, click Submit
    P->>GH: POST /repos/[owner]/[repo]/forks
    P->>GH: GET refs/heads/main (on fork)
    P->>GH: POST refs/heads/proposal/[slug]-[ts]
    P->>GH: PUT contents/[filepath]
    P->>GH: POST pulls (head user:branch, base upstream:main)
    GH-->>P: PR URL
    P-->>User: "Thanks — PR opened: [url]"
```

---

## 5. Quiz runtime

The `/quiz` page is a setup form. Submitting it navigates to `/quiz/run/` with
a seed, a tag CSV, and a count in the URL. Everything after that is pure
client-side off a single fetched JSON file.

```mermaid
stateDiagram-v2
    [*] --> Setup: open /quiz
    Setup --> Running: Start (URL gets seed, tags, count)

    state Running {
        [*] --> ShowQuestion
        ShowQuestion --> ShowAnswer: Space / Reveal
        ShowAnswer --> ShowQuestion: Got it (mark right, next)
        ShowAnswer --> ShowQuestion: Review (mark review, next)
        ShowQuestion --> ShowQuestion: ← / → navigate
    }

    Running --> Done: last card answered
    Done --> Setup: Retry missed (review-marked only)
    Done --> [*]: Share URL / leave
```

### Why share URLs reproduce the same quiz

The card order is a pure function of the URL parameters. Open the same URL on
any machine: identical cards, identical order. No server, no shared state.

```mermaid
flowchart LR
    A["URL: seed=foo<br/>tags=react,perf<br/>count=10"] --> B["seedKey = 'foo|react,perf'"]
    B --> C["hashSeed (FNV-1a) → uint32"]
    C --> D["mulberry32 PRNG"]
    D --> E["Fisher-Yates shuffle<br/>over tag-filtered questions"]
    E --> F["slice(0, count)"]
    F --> G["deterministic ordered card list"]
```
