---
title: "Walk through the critical rendering path"
tags: [performance]
difficulty: hard
---

# Question

From the moment the HTML byte arrives, what does the browser do to put pixels on the screen?

# Answer

1. **HTML parsing** → DOM. The parser builds the DOM tree incrementally as bytes arrive. A `<script>` without `defer`/`async` stops the parser dead until it executes.

2. **CSS parsing** → CSSOM. CSS is **render-blocking**: the browser won't paint anything until the CSSOM is built, because otherwise it might paint with the wrong styles ("FOUC"). Stylesheets discovered late delay first paint.

3. **Style** — combine DOM + CSSOM to compute styles for every element (cascade, inheritance, custom property resolution).

4. **Layout** — compute geometry: where each box goes, how big it is. Reads styles, produces a layout tree. Mutating layout-affecting properties (`width`, `top`, `display`, …) **invalidates layout**. Reading geometry (`offsetTop`, `getBoundingClientRect`) after a mutation forces a synchronous re-layout (a "forced reflow") — this is the source of most main-thread jank.

5. **Paint** — turn the layout tree into a sequence of draw commands (pixels for backgrounds, borders, text, images).

6. **Composite** — split the page into layers and composite them on the GPU. `transform` and `opacity` changes can usually be done in the compositor without re-layout or re-paint. That's why `transform: translate` is dramatically faster than `top: …` for animations.

The expensive operations are layout and paint. The cheap ones are composite-only changes. Key implications:

- **Defer scripts** (`defer` or `type="module"`) so they don't block parsing.
- **Inline critical CSS** for above-the-fold content so paint isn't blocked by an external stylesheet round-trip.
- **`font-display: swap`** so text paints in a fallback font instead of waiting.
- **Animate `transform`/`opacity`**, not `width`/`top`. Use `will-change` sparingly to hint.
- **Batch DOM reads and writes** to avoid layout thrashing — never do `el.style.x = a; const y = el.offsetTop; el.style.x = b;` in a loop.
