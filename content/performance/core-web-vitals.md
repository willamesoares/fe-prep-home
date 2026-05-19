---
title: "What are LCP, INP, and CLS, and what causes bad scores?"
tags: [performance]
difficulty: medium
---

# Question

What do Core Web Vitals measure, and what typically makes each one bad?

# Answer

Google's three "user experience" metrics:

**LCP — Largest Contentful Paint** (loading). Time from navigation start until the largest visible element (usually a hero image or headline) finishes rendering. Good: ≤ 2.5s.

Common causes of bad LCP:
- Hero image isn't preloaded; browser discovers it deep in the parser.
- Image is too large or wrong format (no AVIF/WebP).
- LCP element is behind a JS-rendered component (client-side rendering blocks paint).
- Render-blocking CSS or fonts.

Fixes: `<link rel="preload" as="image">` for the LCP image, `fetchpriority="high"` on the image, server-side render the above-the-fold content, ship critical CSS inline, use `font-display: swap`.

**INP — Interaction to Next Paint** (responsiveness). Worst latency between a user interaction and the next visual update, across the page's lifetime. Good: ≤ 200ms.

Common causes of bad INP:
- Long JavaScript tasks blocking the main thread (especially React commits over 50ms).
- Heavy event handlers on click/input.
- Synchronous layout/measurement in handlers (forced reflow).
- Hydration cost on slow devices.

Fixes: split long tasks with `scheduler.yield()` or `setTimeout`, memoize expensive React subtrees, debounce input handlers, virtualize long lists, ship less JS.

**CLS — Cumulative Layout Shift** (visual stability). Sum of unexpected layout shifts during the page's lifetime. Good: ≤ 0.1.

Common causes of bad CLS:
- Images and ads without `width`/`height` (browser reflows when they load).
- Web fonts swapping in at a different metric (FOUT shifting layout).
- Banners or cookie notices injected after first paint.
- Dynamic content pushed in above existing content.

Fixes: always set `width`/`height` (or `aspect-ratio`) on media, reserve space for ads, use `size-adjust` and `ascent-override` on `@font-face` to match fallback metrics, never insert content above existing visible content after load.
