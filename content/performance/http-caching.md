---
title: "How does HTTP caching work for static assets?"
tags: [performance]
difficulty: medium
---

# Question

What's the difference between `Cache-Control: max-age`, `no-cache`, `no-store`, and `immutable`?

# Answer

- **`max-age=N`** — browser may use the cached copy for N seconds without asking the server. After N seconds the entry is "stale" and needs revalidation.

- **`no-cache`** — confusingly named. The browser **may** cache the response, but **must revalidate** with the server on every use (typically via `If-None-Match`). The server can return `304 Not Modified` to confirm the cached copy is still good. "Check with the server every time."

- **`no-store`** — do not cache at all. The browser must re-download the full response every time. Use for sensitive data (bank statements, one-time tokens). Almost never the right answer for static assets.

- **`immutable`** — promises the resource will never change. The browser skips revalidation entirely for the lifetime of `max-age`. Use on **fingerprinted filenames** (e.g. `main.4f2c1a9b.js`) where any change produces a new URL.

The standard recipe for a modern web app:

```
# HTML — short cache, always revalidate so users get the latest version
Cache-Control: no-cache

# Fingerprinted assets — cache forever
Cache-Control: public, max-age=31536000, immutable
```

HTML is short because it references the asset filenames; once HTML refreshes, the new asset URLs cascade in. Fingerprinted assets can cache for a year because if their content changes, the URL changes.

**Revalidation tokens:**
- `ETag: "abc"` — server fingerprint; browser sends `If-None-Match: "abc"` to ask "still the same?"
- `Last-Modified: ...` — server timestamp; browser sends `If-Modified-Since: ...`.
- Either way, a `304 Not Modified` response has no body, saving the bytes but not the round-trip.

For a static site on S3 + CloudFront: set `immutable` on `_astro/*`/`assets/*`, `no-cache` on HTML files. CloudFront's TTL plus `immutable` means most users never hit the origin for assets.
