# Background concepts

This document explains the pieces of this project that sit *outside* the
codebase itself — browser security rules, OAuth, the libraries we lean on,
AWS deploys, and CDN caching. It is written for a developer who has not
done much CI/CD, AWS, or browser-cache work before.

Read top to bottom: each section assumes the ones above it. For *why we
chose* these specific tools (and what we considered instead), see
[ARCHITECTURE.md](ARCHITECTURE.md). For visual flow diagrams of the same
material, see [DIAGRAMS.md](DIAGRAMS.md).

---

## 1. Same-origin policy and CORS

### What an "origin" is

In a browser, an **origin** is the combination of three things in a URL:

- **scheme** (`https`)
- **host** (`fe-prep.example.com`)
- **port** (`443`, implicit for HTTPS)

`https://fe-prep.example.com/quiz/` and `https://fe-prep.example.com/q/foo/`
share an origin. `https://fe-prep.example.com/` and
`https://api.github.com/` do **not** — different host.

### The same-origin policy

By default, JavaScript in page A cannot read responses from a server at
a different origin. This is a core browser security rule. It exists so
that a script on `evil.example.com` cannot quietly read your inbox at
`gmail.com` using your logged-in cookies.

### What CORS does

**CORS** (Cross-Origin Resource Sharing) is the mechanism a server uses
to opt *in* to being called from other origins. The server sends a
response header like:

```
Access-Control-Allow-Origin: https://fe-prep.example.com
```

…and the browser then allows the script that made the request to read
the response. Without that header, the browser blocks the read, even
though the request itself was sent and the server replied.

For requests that aren't simple `GET`s — anything with a custom header,
a JSON body, etc. — the browser first sends a **preflight** `OPTIONS`
request asking "are you OK with this?" The server has to answer with
the right CORS headers before the real request is sent.

### Where this repo hits it

GitHub's `https://github.com/login/device/code` and
`https://github.com/login/oauth/access_token` endpoints **do not** send
CORS response headers. A `fetch()` call to them from any browser page
fails — not because the request is rejected, but because the browser
refuses to hand the response back to the script.

That is the entire reason the Cloudflare Worker in this repo exists.
It calls those two endpoints from a server-side context (where the
same-origin policy doesn't apply) and re-emits the response with CORS
headers added. See §2.

### Learn more

- [MDN — Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy)
- [MDN — CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

---

## 2. OAuth Device Flow + the Cloudflare Worker proxy

### What OAuth is, in one paragraph

**OAuth 2.0** is a protocol for *delegated authorization*. You (the
user) let an application act on your behalf at another service (here,
GitHub), without giving the application your password. The application
ends up with an **access token** — a long random string — that it can
attach to API calls. The token has a defined **scope** (what it's
allowed to do) and can be revoked at any time.

OAuth is for *authorization*, not *authentication*. We don't use it to
log people in to fe-prep. We use it to get permission to open a pull
request on their behalf.

### Two GitHub OAuth flavors: Web Flow vs Device Flow

GitHub offers two ways to do the handshake:

**OAuth Web Flow** (the more common one):
1. App redirects user to `github.com/login/oauth/authorize?...`
2. User clicks "Authorize"; GitHub redirects back to the app with a `code`
3. App's *backend* exchanges the `code` for a token by POSTing to GitHub with a `client_secret`

The `client_secret` is, well, secret. It has to live on a server. So
Web Flow requires a backend.

**OAuth Device Flow** (designed for TVs, CLIs, and… browsers without
backends):
1. App POSTs `client_id` to `github.com/login/device/code`
2. GitHub returns a short `user_code` (like `B3B8-22E3`) and a URL
3. App tells the user "open `github.com/login/device` and enter `B3B8-22E3`"
4. While the user does that, the app polls `github.com/login/oauth/access_token`
5. Once the user has authorized, the next poll returns the access token

No client secret. No backend. The token never leaves the user's browser.

### Why Device Flow for this repo

We wanted no always-on backend. Device Flow lets the browser do the
whole handshake on its own. The tradeoff is the user has to copy a
code into another tab — a small UX cost we accept.

### The CORS catch

Device Flow's two endpoints (steps 1 and 4 above) don't send CORS
headers (see §1). So the browser can't call them directly. We need a
proxy. Hence the Cloudflare Worker.

### What a Cloudflare Worker is

A **Cloudflare Worker** is a small JavaScript function that runs on
Cloudflare's edge network — hundreds of locations worldwide. You write
a `fetch` handler; Cloudflare runs it in response to HTTP requests at
the URL you configure. It's stateless by default, cold-starts in ~10 ms,
and the free tier covers 100,000 requests per day. There is no server
to provision; you `wrangler deploy` and it's live globally.

For our purposes, a Worker is the cheapest possible way to add a tiny
piece of server logic to a static site.

### What our Worker does

Exactly one job: re-issue requests to the two GitHub OAuth endpoints
and add CORS headers to the response. It allows only those two paths
and refuses everything else.

From `workers/oauth-proxy/src/index.js`:

```js
const ALLOWED_PATHS = new Set(['/login/device/code', '/login/oauth/access_token']);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (!ALLOWED_PATHS.has(url.pathname)) {
      return new Response('Not found', { status: 404, headers: CORS_HEADERS });
    }
    const upstream = await fetch(`https://github.com${url.pathname}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: await request.text(),
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { ...CORS_HEADERS, 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
    });
  },
};
```

No state, no logging, no auth. It is a CORS shim.

### What our browser code does

The Device Flow client lives in `src/lib/githubOAuth.ts`. It calls the
proxy (which forwards to GitHub), then polls for the token:

```ts
export async function pollForToken(deviceCode: string, intervalSec: number) {
  let interval = intervalSec;
  while (true) {
    await new Promise((r) => setTimeout(r, interval * 1000));
    const res = await fetch(`${PROXY_BASE}/login/oauth/access_token`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const data = await res.json();
    if (data.access_token) return data.access_token;
    if (data.error === 'authorization_pending') continue;
    if (data.error === 'slow_down') { interval += 5; continue; }
    throw new Error(data.error ?? 'OAuth failed');
  }
}
```

Once we have the token, we store it in `localStorage` under the key
`fe-prep:gh-token`. Its scope is `public_repo` — enough to fork and
open PRs on public repositories, nothing else.

### Learn more

- [GitHub Docs — Authorizing OAuth apps (Device Flow section)](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [Cloudflare Workers — Get started](https://developers.cloudflare.com/workers/)

---

## 3. Browser-side libraries on `/propose` and `/quiz`

Four libraries do most of the heavy lifting on our interactive pages.
Each is small and does one thing well.

### 3.1 Octokit — talking to the GitHub API

**Octokit** is the official GitHub API client, maintained by GitHub.
It's a thin wrapper over `fetch` with full TypeScript types, request
batching, retry logic, and one method per API endpoint.

We use it in the browser, with the user's OAuth token from §2, to
turn "the user clicked Submit" into a real pull request. The sequence
is five API calls:

1. `POST /repos/{owner}/{repo}/forks` — fork the upstream repo (a no-op if already forked)
2. `GET refs/heads/main` on the fork — find the current main SHA
3. `POST refs/heads/proposal/{slug}-{ts}` — create a branch from that SHA
4. `PUT contents/{filepath}` — write the new markdown file on the branch
5. `POST pulls` — open a PR from the fork's branch into the upstream main

Without Octokit we'd hand-write five `fetch` calls with the right
headers, base64-encoded file contents, branch ref shapes, and error
handling. Octokit removes that boilerplate.

### Learn more

- [octokit.js on GitHub](https://github.com/octokit/octokit.js)

### 3.2 CodeMirror 6 — the markdown editor on `/propose`

**CodeMirror 6** is a modular code editor written for the browser.
It gives us syntax highlighting in the editor, line numbers, undo/redo,
keyboard shortcuts, and bracket matching for free. "Modular" matters:
you import only the language packages and features you use, and the
bundle stays small.

We load CodeMirror with `@codemirror/lang-markdown` on the `/propose`
page only, via an Astro `client:only` directive. Visitors who never
touch `/propose` never download it.

Alternatives we passed on: **Monaco** (the real VS Code editor) is
~2 MB minified — way too heavy. A plain `<textarea>` is workable but
provides no editor affordances; contributors who write markdown all
day will notice.

### Learn more

- [codemirror.net](https://codemirror.net/)

### 3.3 Marked — markdown → HTML for the quiz JSON

**Marked** is a small, dependency-free markdown parser. It takes a
markdown string and returns an HTML string.

We need it because the quiz runner is a single-page interactive island
that fetches one big JSON file (`/quiz-index.json`) containing every
question's HTML, pre-rendered. That JSON is built by an Astro endpoint
at build time. For each question, we:

1. Split the markdown body on the `# Answer` H1 heading (`src/lib/splitQA.ts`)
2. Render the question half through Marked
3. Render the answer half through Marked
4. Embed both as ready-to-inject HTML in the JSON

This happens *outside* Astro's normal markdown pipeline because Astro
renders markdown to components, not strings — and we need strings to
put into JSON. Marked is small and does exactly that.

We also plug a custom renderer hook into Marked that runs code blocks
through **Shiki** (see §3.4) so the output looks identical to the
build-time-rendered detail pages.

### Learn more

- [marked.js.org](https://marked.js.org/)

### 3.4 Shiki — syntax highlighting at build time

**Shiki** is a syntax highlighter that uses the exact same TextMate
grammars and themes as VS Code. The output looks like the editor your
visitors already know.

The key word is *build time*. Shiki runs during `npm run build`. It
emits plain HTML with color baked in as inline styles. The browser
does nothing — no parser, no tokenizer, no theme switcher, no JS
download. The detail pages (`/q/[slug]/`) ship zero JavaScript
because of this.

Alternatives ship a syntax highlighter and a stack of grammars to
every page that has a code block. **Prism.js** and **highlight.js**
both work that way. For a site that prioritizes small payloads, Shiki
at build time is the right call.

### Learn more

- [shiki.style](https://shiki.style/)

---

## 4. OIDC + AWS IAM Role (how the deploy talks to AWS)

### What IAM is, in one paragraph

**IAM** (Identity and Access Management) is AWS's permissions system.
Everything in AWS is permission-controlled by IAM. The three nouns to
know:

- **User** — a long-lived identity, usually a human. Has an access key.
- **Role** — a temporary identity that other identities (users, AWS
  services, *external systems like GitHub*) can "assume." A role has
  policies attached saying what it can do.
- **Policy** — a JSON document listing allowed/denied actions on
  specific resources.

When you "assume" a role, AWS gives you a short-lived **STS token**
(usually expiring in an hour) that you use for subsequent API calls.

### The old way: static access keys

Historically, a CI workflow that deployed to AWS would store an IAM
user's `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in GitHub
Secrets. Two problems:

1. **They're permanent.** If they leak, the attacker has them until
   you rotate them (which you have to remember to do).
2. **They're long-lived blast radius.** A leaked key works from any
   IP, any tool, indefinitely.

### What OIDC is

**OIDC** (OpenID Connect) is an identity layer on top of OAuth 2.0.
It standardizes how one system can prove "this request really is
coming from this identity" by exchanging signed tokens.

GitHub Actions ships an OIDC token *to every workflow run*. The token
contains **claims** like "I am from repository `willamesoares/fe-prep-home`,
branch `main`, workflow `deploy.yml`." AWS can be configured to
*trust* tokens from GitHub Actions and grant a role based on those
claims.

### The handshake

1. The workflow asks GitHub Actions for an OIDC token (the
   `id-token: write` permission in `deploy.yml` enables this)
2. The workflow hands the token to the `aws-actions/configure-aws-credentials` action
3. The action calls AWS STS `AssumeRoleWithWebIdentity`, passing the token
4. AWS verifies the token's signature against GitHub's public keys
5. AWS checks the token's claims (repo, branch, workflow) against the role's *trust policy*
6. If everything matches, AWS returns a short-lived STS token
7. The workflow uses that token for `aws s3 sync` and `aws cloudfront create-invalidation`

The STS token expires in an hour. There are no static credentials
anywhere — not in the repo, not in GitHub Secrets.

### What's in the repo

Just this step in `.github/workflows/deploy.yml`:

```yaml
permissions:
  id-token: write     # allow GitHub to issue an OIDC token to this workflow
  contents: read

# ...

- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
    aws-region: ${{ secrets.AWS_REGION }}
```

`AWS_ROLE_ARN` is the ARN of the role to assume (something like
`arn:aws:iam::123456789012:role/fe-prep-deploy`). It's not a secret in
the cryptographic sense — knowing the ARN doesn't let you assume the
role. We just keep it in Secrets to avoid hard-coding the AWS account
number.

### What's in AWS (not in the repo)

The role on the AWS side has a **trust policy** that says, in JSON,
roughly: "tokens signed by `token.actions.githubusercontent.com`, with
the audience `sts.amazonaws.com`, and a `sub` claim matching
`repo:willamesoares/fe-prep-home:ref:refs/heads/main`, may assume me."

This is the security gate. A different repo, a different branch, a
fork — none of them produce a token whose `sub` matches, so none of
them can assume the role.

### Learn more

- [GitHub Docs — Configuring OpenID Connect in AWS](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [`aws-actions/configure-aws-credentials`](https://github.com/aws-actions/configure-aws-credentials)

---

## 5. S3 + CloudFront + OAC (the hosting setup)

### S3, in one paragraph

**Amazon S3** (Simple Storage Service) is object storage. You create a
**bucket**, you `PUT` files into it, and you `GET` them back. S3
itself does not serve HTTPS websites — it has a "static website
hosting" mode, but that mode is HTTP-only and exposes the bucket
publicly. For a real site you put a CDN in front.

In our deploy, S3 is the canonical store of the built site. Every
file in `dist/` ends up as an object in the bucket.

### CloudFront, in one paragraph

**Amazon CloudFront** is AWS's content delivery network (CDN). It
copies content from an **origin** (here, our S3 bucket) to ~400 edge
locations around the world. When a browser in São Paulo requests
`https://fe-prep.example.com/q/closures/`, CloudFront serves it from
the nearest edge — no round trip to S3 in `us-east-1`.

CloudFront adds:

- **HTTPS** with a managed TLS certificate
- **HTTP/2** and HTTP/3
- **Edge caching** with configurable TTLs
- **Edge functions** (small bits of JS that run on requests)

### Why pair them

Neither is sufficient alone:

- S3 alone = HTTP only, no CDN, public bucket
- CloudFront alone = no storage; it needs an origin

S3 holds the truth. CloudFront fans it out to edges with HTTPS.

### OAC — keeping the bucket private

**Origin Access Control** is a CloudFront feature that lets CloudFront
sign requests to S3, and lets S3's bucket policy say "only requests
signed by *this specific CloudFront distribution* are allowed."

Result: the bucket is private — no public read, no `s3-website`
endpoint exposed — but CloudFront can still read it. Anyone trying to
hit the bucket directly gets a `403`.

Without OAC you'd either expose the bucket publicly or use the older
Origin Access Identity (OAI). OAC is the modern, recommended option.

### The trailing-slash CloudFront Function

CloudFront's default behavior is to serve `index.html` for the root
request `/`, but **not** for subpath requests like `/quiz/run/` or
`/q/closures/`. A request for `/quiz/run/` would try to read an
object literally named `quiz/run/` and 404.

The fix is a ~10-line **CloudFront Function** (a tiny JS snippet that
runs on each request) that rewrites paths ending in `/` to append
`index.html`. It's free for the first 2 million invocations per
month.

### The cache-control split

The deploy workflow runs `aws s3 sync` twice with different
`--cache-control` flags:

```yaml
- name: Sync to S3
  run: |
    aws s3 sync dist/ s3://${{ secrets.S3_BUCKET }}/ --delete \
      --cache-control "public, max-age=31536000, immutable" \
      --exclude "*.html" --exclude "*.json"
    aws s3 sync dist/ s3://${{ secrets.S3_BUCKET }}/ \
      --cache-control "no-cache" \
      --exclude "*" --include "*.html" --include "*.json"
```

Two different strategies for two different kinds of files:

- **Hashed assets** (e.g. `Propose.C-dUA4V9.js`) — `max-age=31536000,
  immutable`. Browsers and CDN edges cache these for a year. Safe
  because the filename *changes* whenever the content changes; an
  updated `Propose` component gets a new hash, so visitors always
  fetch the new file.
- **HTML and JSON** — `no-cache`. The browser must re-validate with
  the origin on every visit. Combined with the CloudFront invalidation
  below, this means content changes appear immediately.

If you treated everything as immutable, content updates would never
appear without a fresh URL. If you treated everything as `no-cache`,
every visit re-downloads every asset. The split gets the best of both.

### Learn more

- [Amazon S3 documentation](https://docs.aws.amazon.com/s3/)
- [Amazon CloudFront documentation](https://docs.aws.amazon.com/cloudfront/)
- [CloudFront — Restricting access with OAC](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)

---

## 6. CloudFront invalidation (forcing the cache to refresh)

### The problem

CloudFront edges cache responses according to the `Cache-Control`
headers on the origin response. Even with our `no-cache` HTML, edges
may still hold a copy until it expires or is explicitly purged.

When we deploy a new version of a question, we want it to appear
*immediately*, not whenever the edge happens to refresh.

### What an invalidation is

An **invalidation** is a request to CloudFront that says "treat the
content at these paths as stale; the next time anyone asks for them,
go fetch from the origin." It doesn't delete anything — it just
expires the cached copy.

### Why `/*`

`/*` means "every path on this distribution."

CloudFront charges per **invalidation path**, not per file. `/*` is
one path. So invalidating the whole site costs as much as invalidating
a single file (and the first 1000 invalidation paths per month are
free, which we will not approach).

For a small site, `/*` is the simplest and cheapest option. For a
large site with many edges and many files, you might invalidate only
the changed paths.

### Why we *also* use `no-cache` headers

Two different caches sit between the user and our origin:

1. **The browser's cache.** Controlled by HTTP headers (`Cache-Control`)
   on the response the browser received.
2. **CloudFront's edge caches.** Controlled by the same headers, but
   also explicitly purgeable via invalidation.

Invalidation only addresses the second. Without `no-cache` headers on
HTML and JSON, a returning visitor's browser would still show the
*previous* page from its own local cache until that expired — even
though CloudFront has the fresh version. The `no-cache` header forces
the browser to revalidate on every navigation, which means it fetches
from CloudFront, which (post-invalidation) returns the fresh content.

### End-to-end

The final step of `deploy.yml`:

```yaml
- name: Invalidate CloudFront
  if: env.CLOUDFRONT_DISTRIBUTION_ID != ''
  run: |
    aws cloudfront create-invalidation \
      --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
      --paths "/*"
```

After it runs, the next request from any browser anywhere fetches the
new content from CloudFront, which fetches from S3 if it doesn't have
a fresh copy.

### Learn more

- [CloudFront — Invalidating files](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html)

---

## 7. Glossary

- **CDN** — Content Delivery Network. A set of geographically
  distributed servers that cache content close to users.
- **Edge** — One specific server location in a CDN. "An edge" =
  "an edge server location."
- **Origin** — In CDN terms, the canonical source of content the CDN
  pulls from (here, our S3 bucket). In browser terms, the
  scheme+host+port of a URL (§1).
- **Preflight** — The `OPTIONS` request a browser sends before certain
  cross-origin requests to ask the server if the real request is
  allowed (§1).
- **IAM user vs role** — A user is a long-lived identity (usually a
  human); a role is a temporary identity that other identities can
  assume (§4).
- **STS** — AWS Security Token Service. Issues the short-lived tokens
  you get when you assume a role.
- **OIDC token** — A signed JSON Web Token issued by an identity
  provider (here, GitHub Actions) that proves "this request comes from
  this identity in this context" (§4).
- **Claim** — A field inside an OIDC token (e.g. `sub`, `aud`, `iss`).
  Trust policies match against claims.
- **Audience (`aud`)** — A claim indicating who the token is intended
  for. AWS STS requires `aud=sts.amazonaws.com` for OIDC role
  assumption.
- **OAC** — Origin Access Control. The CloudFront feature that signs
  requests to S3 so the bucket can stay private (§5).
- **Invalidation** — Telling CloudFront "treat these cached paths as
  stale" (§6).
- **TTL** — Time To Live. How long a cache entry remains valid before
  it must be refreshed.
