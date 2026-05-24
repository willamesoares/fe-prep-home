# fe-prep

A static site of categorized frontend interview Q&A — free, open content, no account needed to read.

For the product rationale, full stack breakdown, and a record of the alternatives considered for each choice, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). For visual flow diagrams, see [docs/DIAGRAMS.md](docs/DIAGRAMS.md).

## Local dev

```sh
npm install
npm run dev
```

## Adding questions

Open a PR adding a markdown file under `content/<primary-tag>/<slug>.md`. Required frontmatter:

```yaml
---
title: "Short, scannable question"
tags: [react, performance]
difficulty: easy | medium | hard
---
```

Body must contain `# Question` and `# Answer` H1 headings. Triple-backtick code fences get
syntax-highlighted at build time.

```sh
npm run lint:content   # runs the same checks CI does
```

## Deploy (S3)

Push to `main` triggers `.github/workflows/deploy.yml`, which builds and `aws s3 sync`s the output.

GitHub Actions secrets:

- `AWS_ROLE_ARN`, `AWS_REGION`, `S3_BUCKET` — required
- `CLOUDFRONT_DISTRIBUTION_ID` — optional
- `PUBLIC_GITHUB_CLIENT_ID` — OAuth App client_id for the `/propose` page
- `PUBLIC_OAUTH_PROXY_URL` — base URL of a CORS proxy for GitHub's OAuth Device Flow endpoints
  (GitHub's `github.com/login/...` endpoints don't currently send CORS headers, so direct browser
  calls fail). A 30-line Cloudflare Worker is enough.
