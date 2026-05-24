---
title: "Why does React render components twice in development?"
tags: [react]
difficulty: medium
---
# Question

When running a React app in development mode, components often appear to render twice — `console.log` statements fire
twice, effects run twice, etc. Why does this happen, and is it a bug?

# Answer

It's intentional. When `<StrictMode>` is enabled (which `create-react-app`, Vite, and Next.js do by default in development), React intentionally double-invokes the following in dev only:

- Component function bodies
- `useState`, `useMemo`, and `useReducer` initializer functions
- `useEffect`, `useLayoutEffect`, and ref callback setup + cleanup

The goal is to surface bugs that depend on a component being mounted only once. The most common one: effects with missing cleanup.

```jsx
useEffect(() => {
  const id = setInterval(tick, 1000);
  // bug: no cleanup
}, []);
```

In production this leaks one timer. In dev with StrictMode, you get **two** timers immediately, so the bug shows up the
first time you load the page instead of after a refactor months later.

**Rules of thumb:**

- Never rely on an effect running exactly once. Write effects so that _setup + cleanup + setup_ gives the same end state
  as _setup_.
- StrictMode does **not** run twice in production builds — your users won't see it.
- If you see something firing twice in dev and it's a problem, the bug is almost always in your code, not React.
