---
title: "Why does Context cause performance problems, and how do you fix them?"
tags: [react, performance]
difficulty: hard
---

# Question

A `<ThemeContext.Provider value={{ theme, user }}>` re-renders every consumer on every render of the provider. Why, and what are the standard fixes?

# Answer

Context propagation is based on **referential equality** of `value`. If you pass an inline object, every parent render creates a new object, every consumer sees a "new" value, and every consumer re-renders — even ones that only read `theme`.

```jsx
// Every render: new object reference -> all consumers re-render
<Ctx.Provider value={{ theme, user }}>
```

Fixes, in order of how much they cost to apply:

1. **Memoize the value:**
   ```jsx
   const value = useMemo(() => ({ theme, user }), [theme, user]);
   <Ctx.Provider value={value}>
   ```

2. **Split contexts** by what changes together. If `theme` rarely changes but `user` does, give them separate providers so theme consumers don't re-render on user changes.

3. **Split read vs write.** Put state in one context and dispatch in another — components that only dispatch never re-render when state changes.

4. **`use-context-selector`** or **Zustand/Jotai** when you need fine-grained subscriptions to slices of a single store. React's built-in context can't do partial subscriptions.

Don't reach for Context for high-frequency state (mouse position, form fields). It will re-render the whole subtree.
