---
title: "How do you pick image formats and sizes for the web?"
tags: [performance]
difficulty: medium
---

# Question

Walk through the decisions: format (JPEG/PNG/WebP/AVIF/SVG), size, loading strategy.

# Answer

**Format**

- **AVIF** — best compression for photos (often 30-50% smaller than JPEG at equal quality). Slower to encode, ubiquitous browser support since 2024. First choice for photographs.
- **WebP** — strong compression, very fast decode, supports transparency. Fallback for browsers without AVIF.
- **JPEG** — universal fallback for photos.
- **PNG** — when you need lossless or pixel-perfect transparency (logos with hard edges, screenshots). Use SVG instead when possible.
- **SVG** — vector. Use for icons, logos, illustrations. Tiny, scales to any size, can be styled with CSS.
- **GIF** — almost never. Use `<video autoplay muted loop playsinline>` with MP4/WebM for animations; the file is 5-20× smaller.

Serve all three formats with `<picture>`:

```html
<picture>
  <source type="image/avif" srcset="hero.avif">
  <source type="image/webp" srcset="hero.webp">
  <img src="hero.jpg" alt="..." width="800" height="600">
</picture>
```

**Size**

Never ship a 2000px image into a 400px slot. Generate multiple sizes and use `srcset` + `sizes`:

```html
<img
  src="card-400.jpg"
  srcset="card-400.jpg 400w, card-800.jpg 800w, card-1200.jpg 1200w"
  sizes="(min-width: 768px) 33vw, 100vw"
  alt="..."
>
```

Targets: under 200 KB for hero images, under 50 KB for cards/thumbnails. Use a image CDN (Cloudinary, ImageKit, Vercel/Cloudflare Images) that does this on the fly.

**Loading strategy**

- **Above the fold:** `fetchpriority="high"` and preload, no lazy loading. This is your LCP image.
- **Below the fold:** `loading="lazy" decoding="async"`. The browser defers fetching until near the viewport.
- **Always:** `width` and `height` (or `aspect-ratio` via CSS) to reserve space and avoid CLS.
- `alt=""` is required — empty string for purely decorative images, descriptive text otherwise.
