---
title: "CSS custom properties (variables) — what makes them different from Sass variables?"
tags: [css]
difficulty: medium
---

# Question

What can CSS custom properties do that preprocessor variables (Sass, Less) can't?

# Answer

Preprocessor variables are resolved at build time and disappear from the output. Custom properties live in the browser at runtime, which unlocks several things:

**They cascade and inherit.**

```css
:root { --gap: 1rem; }
.card  { --gap: 0.5rem; }
.card > * + * { margin-top: var(--gap); }
```

Each `.card` gets its own `--gap`, overriding the root. Sass variables can't be overridden per-element from CSS.

**They respond to media queries and `:hover`/`:focus`.**

```css
:root { --bg: white; }
@media (prefers-color-scheme: dark) {
  :root { --bg: #111; }
}
body { background: var(--bg); }
```

One variable change cascades to every consumer. No JS, no recompile.

**JavaScript can read and write them.**

```js
element.style.setProperty('--gap', '2rem');
getComputedStyle(element).getPropertyValue('--gap');
```

Great for theme switching, animating arbitrary properties via Houdini's `@property`, or passing layout values to CSS from JS.

**They support fallbacks:** `var(--accent, blue)` uses `blue` if `--accent` isn't set.

When preprocessor variables still win:

- Constants used in selectors or media query values: `var()` doesn't work in `@media (min-width: var(--md))`.
- Math you want done at build time so the browser doesn't recompute it.
- Maps/loops/mixins — preprocessor features that have no CSS equivalent.

In modern projects, custom properties handle theming and runtime values; preprocessors (or modern features like `@layer` and nesting) handle authoring ergonomics.
