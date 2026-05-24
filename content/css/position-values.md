---
title: "Each `position` value, in one sentence"
tags: [css]
difficulty: easy
---

# Question

What does each value of `position` actually do?

# Answer

- **`static`** — the default. Element follows normal document flow. `top/right/bottom/left` and `z-index` do nothing.

- **`relative`** — flows normally, but you can offset it visually with `top/left/etc.` *without* changing the space it reserves. Other elements still treat it as if it were in its original spot. Establishes a positioning context for `absolute` children.

- **`absolute`** — removed from normal flow (takes no space). Positioned relative to the nearest **positioned** ancestor (any ancestor that isn't `static`); falls back to the initial containing block (≈ viewport).

- **`fixed`** — removed from normal flow. Positioned relative to the **viewport**. Stays put when the page scrolls. (Exception: an ancestor with `transform`, `filter`, or `will-change` becomes the containing block, breaking `fixed`.)

- **`sticky`** — flows normally until it crosses a threshold defined by `top`/`bottom`, then "sticks" within its parent. Behaves like `relative` then like `fixed`. The container must have room to scroll for stickiness to be visible.

```css
.sidebar-header {
  position: sticky;
  top: 0;     /* sticks once it hits the top of the viewport */
}
```

The two most common gotchas:

1. `position: absolute` without a positioned ancestor falls back to the viewport — usually not what you want. Add `position: relative` to the intended container.
2. `position: sticky` silently does nothing if **any** ancestor has `overflow: hidden`, `overflow: auto`, or `overflow: scroll`. The sticky element is trapped inside that scroll container.
