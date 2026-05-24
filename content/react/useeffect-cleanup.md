---
title: "What does the function returned from useEffect do?"
tags: [react]
difficulty: easy
---

# Question

What is the purpose of the function returned from a `useEffect` callback, and when does it run?

```jsx
useEffect(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}, []);
```

# Answer

The returned function is the **cleanup function**. React runs it in two situations:

1. **Before the effect runs again** — if the effect's dependencies change, React first runs the previous cleanup, then runs the new effect.
2. **When the component unmounts** — React runs the final cleanup so the effect's side-effects don't leak.

Use it to dispose of anything the effect set up: timers, subscriptions, event listeners, network requests (via `AbortController`), DOM mutations.

```jsx
useEffect(() => {
  const ctrl = new AbortController();
  fetch(url, { signal: ctrl.signal })
    .then((r) => r.json())
    .then(setData);
  return () => ctrl.abort();
}, [url]);
```

Without cleanup, you get memory leaks, stale state updates after unmount, and (in Strict Mode dev) doubled side-effects.
