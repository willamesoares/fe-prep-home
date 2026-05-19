---
title: "What does <Suspense> actually do?"
tags: [react]
difficulty: medium
---

# Question

What problem does `<Suspense>` solve, and what kinds of components can "suspend"?

# Answer

`<Suspense>` is a declarative way to show a fallback UI while a child is still loading data or code. A component "suspends" by throwing a Promise during render; React catches it, shows the nearest `<Suspense fallback={...}>`, and retries rendering when the Promise resolves.

```jsx
<Suspense fallback={<Skeleton />}>
  <UserProfile id={id} /> {/* may suspend on data or lazy code */}
</Suspense>
```

What can suspend today:

- **`React.lazy()`** for code-split components — built in.
- **Framework data fetching** (Next.js App Router, Remix, React Router data APIs, Relay) — the framework wraps fetches so they suspend.
- **`use(promise)`** in React 19+ — first-class API to suspend on any Promise.

What does **not** suspend out of the box: plain `fetch()` inside `useEffect`. Effects run after render, so they can't make render block. You need a cache layer that throws the Promise on read.

Suspense boundaries also nest: an inner boundary can catch its own suspensions so the outer fallback doesn't replace the whole page when one widget reloads. This is the basis for **streaming SSR** — the server flushes HTML up to each `<Suspense>` boundary, then streams the rest as data resolves.
