---
title: "Debounce vs throttle — what's the difference?"
tags: [js, performance]
difficulty: medium
---

# Question

What's the difference between debounce and throttle, and when do you use each?

# Answer

Both limit how often a function runs in response to a flood of events. They differ in *which* call gets through.

**Debounce** — wait until the events stop. Fires once, after a quiet period.

```js
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
```

Use for: search-as-you-type (wait until the user stops typing), window resize (only react after they finish dragging), form auto-save.

**Throttle** — fire at most once per interval, regardless of how many events come in.

```js
function throttle(fn, ms) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...args); }
  };
}
```

Use for: scroll handlers (you want updates *during* the scroll, not after), mousemove tracking, infinite scroll triggers.

Quick mental model:
- **Debounce = "wake me when it's quiet."**
- **Throttle = "wake me every N ms while there's noise."**

For UI animations, prefer `requestAnimationFrame` over throttle with a time threshold — it syncs to the browser's paint cycle.
