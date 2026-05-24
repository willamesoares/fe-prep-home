---
title: "Why use semantic HTML instead of just divs?"
tags: [html, a11y]
difficulty: easy
---

# Question

A page built entirely from `<div>`s looks identical to one using `<header>`, `<nav>`, `<main>`, `<article>`. What are you actually losing?

# Answer

The visual rendering is identical. What you lose is everything **non-visual**:

**Screen readers** announce landmarks. A screen reader user can jump to "main", "navigation", or "search" with a single keystroke. With all divs, they have no map of the page.

**Default keyboard behavior.** `<button>` is focusable, fires on Enter and Space, and announces as "button." `<div onClick>` is none of those — you have to manually add `tabindex`, key handlers, and an ARIA role, and you'll still miss edge cases (Windows High Contrast, voice control software).

**Form association.** `<label for="x">` connects to `<input id="x">` so clicking the label focuses the field, and screen readers read the label when the field gets focus. A `<div>` can't replace that.

**Built-in semantics for assistive tech and SEO.**
- `<nav>` → "navigation" landmark
- `<main>` → skip-to-main target, exactly one per page
- `<article>` → standalone unit (a blog post, a comment)
- `<section>` → thematic grouping with a heading
- `<header>`/`<footer>` → page or section header/footer
- `<button>` vs `<a>` — buttons trigger actions, anchors navigate. Search engines and screen readers treat them differently.

**Less code.** A native `<button>` is one tag. A "div button" needs `role="button"`, `tabindex="0"`, key handlers, focus styles, and disabled handling.

Rule of thumb: if a native element exists for the job, use it. Reach for ARIA only when no native element fits.
