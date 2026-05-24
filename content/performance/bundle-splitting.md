---
title: "How does code splitting actually reduce bundle size?"
tags: [performance, tooling]
difficulty: medium
---

# Question

What does code splitting do, and what's the difference between route-based and component-based splitting?

# Answer

Code splitting turns one big JS bundle into many smaller chunks that load on demand. The total bytes shipped over the page's lifetime can be **larger** than a single bundle (chunk boundaries duplicate some code) — what improves is **time-to-interactive on initial load**.

Modern bundlers (Vite, Rollup, esbuild, Turbopack) create a new chunk wherever they see a **dynamic import**:

```js
const Settings = lazy(() => import('./Settings'));
```

That `import()` returns a Promise; the bundler emits `Settings.js` as a separate file that only downloads when the call runs.

**Route-based splitting** — one chunk per route. The dashboard doesn't ship the settings code; visiting `/settings` triggers the download. Almost free with file-system routers (Next, Astro, Remix, SvelteKit) — they wrap your route files in `import()` automatically.

**Component-based splitting** — split inside a single page. Common targets:
- Heavy editors (CodeMirror, Monaco, rich text)
- Charting libraries
- Modals that most users never open
- Below-the-fold widgets

```jsx
const Chart = lazy(() => import('./Chart'));
return <Suspense fallback={<Skeleton />}>{showChart && <Chart />}</Suspense>;
```

What kills splitting:

- **Static imports of huge modules from many entrypoints.** If both routes import lodash statically, every chunk has its share. Use a shared `vendor` chunk or import-on-demand.
- **Over-splitting.** Each chunk is a network round-trip. Splitting tiny components can make things slower on HTTP/1 — fewer, bigger chunks often win until you're shipping >50 KB at once.
- **Prefetching everything.** `<link rel="prefetch">` on every route undoes the gain on slow connections.

The win is real but specific: smaller **initial** download, faster TTI, lazy-load expensive features behind user intent.
