---
title: "`<script>` vs `defer` vs `async` vs `type=module`"
tags: [html, performance]
difficulty: medium
---

# Question

What's the difference between `<script src>`, `<script defer>`, `<script async>`, and `<script type="module">`?

# Answer

- **`<script src="...">`** (no attribute) — parser stops, downloads the script, executes it, then resumes parsing. Blocks rendering. Avoid in `<head>`.

- **`<script defer src="...">`** — downloads in parallel with parsing. Executes **after** parsing finishes, in document order. Doesn't block rendering. This is what you want for most app scripts.

- **`<script async src="...">`** — downloads in parallel. Executes **as soon as it's downloaded**, possibly mid-parse, possibly out of document order relative to other async scripts. Good for fire-and-forget scripts that don't depend on anything (analytics).

- **`<script type="module" src="...">`** — implicitly `defer`. Module scripts also: have their own scope (no leaking to `window`), use ES module syntax (`import`/`export`), are fetched with CORS, and deduplicate (importing the same module twice loads it once).

- **`<script type="module" async>`** — module with `async` semantics: runs as soon as it and its dependencies are ready, not in document order.

Visual timeline for a head-tag script:

```
no attribute:  parse────[stop:fetch][exec]parse────────
defer:         parse────────────────────────[exec:DOMContentLoaded]
async:         parse────────[exec:any time]parse──────
```

Rule of thumb: **prefer `defer` (or `type="module"`) on every script in the head.** That gives you non-blocking download, predictable order, and execution after the DOM is built.
