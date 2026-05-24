---
title: "Why does React need a stable `key` on list items?"
tags: [react]
difficulty: easy
---

# Question

Why does React warn when you render a list without a `key`, and what goes wrong if you use the array index?

# Answer

React uses `key` to match the **same logical item** across renders. Without a stable key, React falls back to matching by position — so inserting an item at the top causes every following item to be "re-keyed" and re-mounted from scratch.

Using the index as a key has the same effect for any operation that changes order (insert, delete, sort):

```jsx
// Bad: index changes when you delete item #0
items.map((it, i) => <Row key={i} item={it} />)

// Good: key follows the item itself
items.map((it) => <Row key={it.id} item={it} />)
```

The visible bugs caused by bad keys:

- Component state (e.g. an `<input>`'s value) sticks to the wrong row
- Animations replay on items that didn't change
- Uncontrolled DOM state (focus, scroll position) jumps around
- Excessive DOM operations on what should be a cheap reorder

`key` only needs to be unique **among siblings**, not globally.
