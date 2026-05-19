---
title: "Flexbox vs Grid — when to use each?"
tags: [css]
difficulty: easy
---

# Question

When should you reach for Flexbox vs CSS Grid?

# Answer

- **Flexbox** is **one-dimensional**: items flow along a single axis (row or column). Sizing decisions are based on the items themselves.
- **Grid** is **two-dimensional**: you define rows and columns together, and items are placed into cells.

```css
/* Flex — toolbar of items that should distribute along one axis */
.toolbar { display: flex; gap: 0.5rem; align-items: center; }

/* Grid — page layout with named rows and columns */
.page {
  display: grid;
  grid-template-columns: 240px 1fr;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "sidebar header"
    "sidebar main"
    "sidebar footer";
}
```

Rules of thumb:

- Use **Flex** for navigation bars, button rows, form layouts, anything where "lay these out in a line and let them wrap" is the model.
- Use **Grid** when you need rows and columns to relate to each other — full-page layouts, card grids with consistent gutters, dashboard regions.
- They compose. Grid for the page skeleton, Flex inside individual grid cells.

Specific Grid features Flex can't do: `grid-template-areas` for named regions, `subgrid` so a nested grid aligns with its parent's tracks, `repeat(auto-fill, minmax(...))` for responsive card grids that wrap and reflow without media queries.

Specific Flex features Grid handles awkwardly: distributing leftover space across items with `flex-grow` proportions, "push the rest to the right" via `margin-left: auto`.
