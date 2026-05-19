---
title: "When should you use a ref instead of state?"
tags: [react]
difficulty: medium
---

# Question

What's the difference between `useState` and `useRef`, and when is `useRef` the right choice for storing a value?

# Answer

`useState` triggers a re-render when the value changes. `useRef` does not — `ref.current = x` mutates in place and React never notices.

Use `useRef` when the value:

- **Doesn't need to drive UI** (timer IDs, previous values, mutable counters, instance flags like "is this the first render?")
- **Needs to survive renders but is read imperatively** (interval IDs, AbortControllers, third-party library instances)
- **Holds a DOM node** for focus/measurement

```jsx
const intervalId = useRef<number | null>(null);

useEffect(() => {
  intervalId.current = window.setInterval(tick, 1000);
  return () => {
    if (intervalId.current) clearInterval(intervalId.current);
  };
}, []);
```

Use `useState` when changing the value should cause the screen to update.

The gotcha: don't read or write a ref **during render** to drive what's rendered. React's reconciliation assumes render is pure; mutating a ref during render breaks Strict Mode's double-invocation guarantee and concurrent rendering. Mutate refs inside effects or event handlers.
