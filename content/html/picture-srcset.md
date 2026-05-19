---
title: "`<picture>` vs `srcset` — which one for what?"
tags: [html, performance]
difficulty: medium
---

# Question

When do you reach for `srcset` on `<img>` vs the `<picture>` element?

# Answer

Both let you ship a different image to different devices. They solve different problems.

**`srcset` + `sizes`** — same image, **different resolutions**. Browser picks the best one based on viewport and device pixel ratio.

```html
<img
  src="hero-800.jpg"
  srcset="hero-400.jpg 400w, hero-800.jpg 800w, hero-1600.jpg 1600w"
  sizes="(min-width: 768px) 50vw, 100vw"
  alt="..."
>
```

`sizes` tells the browser how wide the image will *actually render* at each viewport — without it, the browser assumes 100vw and may pick a too-large file.

**`<picture>`** — **different image sources** (different crops, formats, or art direction).

Format negotiation:

```html
<picture>
  <source type="image/avif" srcset="hero.avif">
  <source type="image/webp" srcset="hero.webp">
  <img src="hero.jpg" alt="...">
</picture>
```

Browser uses the first `<source>` it can decode; `<img>` is the universal fallback. This is how you ship AVIF/WebP without breaking older browsers.

Art direction:

```html
<picture>
  <source media="(max-width: 600px)" srcset="hero-portrait.jpg">
  <img src="hero-landscape.jpg" alt="...">
</picture>
```

Different *crop* on small screens (showing the subject's face instead of a wide landscape).

Rule of thumb: **`srcset` alone for "same image, multiple sizes"; `<picture>` when the source material itself differs by viewport or format.**

Don't forget `loading="lazy"` and `decoding="async"` on below-the-fold images — both work on either approach.
