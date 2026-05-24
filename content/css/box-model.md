---
title: "Explain the box model and `box-sizing`"
tags: [css]
difficulty: easy
---

# Question

What's the difference between `box-sizing: content-box` and `box-sizing: border-box`?

# Answer

Every element is a rectangular box with four areas, from inside out: **content**, **padding**, **border**, **margin**.

`box-sizing` controls what `width` and `height` actually measure:

- **`content-box`** (the original CSS default) — `width` is the content area only. Padding and border are added *outside* that.
- **`border-box`** — `width` is the total visible box including padding and border. Padding eats into the content area instead of pushing things wider.

```css
.a {
  box-sizing: content-box;
  width: 200px; padding: 20px; border: 2px solid;
  /* Rendered width: 200 + 20*2 + 2*2 = 244px */
}
.b {
  box-sizing: border-box;
  width: 200px; padding: 20px; border: 2px solid;
  /* Rendered width: 200px exactly */
}
```

`border-box` is what almost every layout intuition expects: "I said 50%, I get 50%". The standard reset is:

```css
*, *::before, *::after { box-sizing: border-box; }
```

Margin sits outside the box and doesn't affect either calculation. Adjacent vertical margins also **collapse** — two stacked elements with `margin-bottom: 20px` and `margin-top: 30px` end up 30px apart, not 50px.
