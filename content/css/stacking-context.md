---
title: "What creates a stacking context?"
tags: [css]
difficulty: hard
---

# Question

A modal with `z-index: 9999` is appearing behind a sibling's child with `z-index: 1`. What's going on?

# Answer

`z-index` only orders elements **within the same stacking context**. A child can never escape its parent's stacking context, no matter how high its `z-index`. So if your modal's stacking context is below another sibling's, the modal's child loses, even at 9999.

Things that create a new stacking context:

- The root element (`<html>`)
- `position` of `relative`, `absolute`, `fixed`, or `sticky` **plus** a `z-index` other than `auto`
- `position: fixed` or `sticky` on its own (no z-index needed)
- `opacity` less than 1
- `transform`, `filter`, `perspective`, `clip-path`, `mask` set to anything other than `none`
- `mix-blend-mode` other than `normal`
- `isolation: isolate`
- `will-change` with a property that itself creates a stacking context
- `contain: layout`, `contain: paint`, or `contain: strict`

Debugging recipe:

1. Open DevTools and walk up the modal's ancestors. The first ancestor with one of the properties above is the stacking context root.
2. If that root is nested inside another element with a competing stacking context and a low z-index, the modal can't escape.
3. Fix: either move the modal in the DOM (a portal to `document.body`), or raise the offending ancestor's z-index.

`isolation: isolate` is the cleanest way to opt into a stacking context without using `z-index` or `transform`.
