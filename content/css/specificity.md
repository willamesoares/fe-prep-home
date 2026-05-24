---
title: "How does CSS specificity work?"
tags: [css]
difficulty: easy
---

# Question

A selector isn't winning even though it appears later in the stylesheet. How does specificity decide which rule applies?

# Answer

When two rules target the same element and set the same property, CSS picks the one with **higher specificity**. Source order only matters when specificity ties.

Specificity is a tuple `(a, b, c)`:

- **a** — number of ID selectors (`#foo`)
- **b** — number of class, attribute, and pseudo-class selectors (`.btn`, `[type="text"]`, `:hover`)
- **c** — number of type and pseudo-element selectors (`div`, `::before`)

Compare left to right. Higher `a` always wins, regardless of `b` and `c`.

```css
#sidebar a       /* (1,0,1) */
nav a.link:hover /* (0,2,2) — loses to the ID rule */
```

Things that don't count: the universal selector `*`, combinators (`>`, `+`, `~`, descendant space), `:where()` (always 0,0,0).

Things that **override specificity entirely**:

1. **`!important`** — bumps the declaration into a higher cascade layer than normal rules. Specificity still decides between competing `!important` declarations.
2. **Inline `style=""`** — outranks any stylesheet selector except `!important`.
3. **Cascade layers (`@layer`)** — later layers win over earlier ones, regardless of specificity inside each layer.

Modern advice: keep specificity flat by sticking to single-class selectors. When you need to scope without raising specificity, use `:where(selector)` — it matches but contributes 0 specificity.
